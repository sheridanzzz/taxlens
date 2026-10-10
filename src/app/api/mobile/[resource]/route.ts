import { NextResponse } from "next/server";
import * as db from "@/lib/storage-neon";
import { getBearerUserId } from "@/lib/mobile-auth";
import { FY_DATE_RANGES } from "@/lib/constants";
import type { FinancialYear } from "@/lib/types";
import type { Expense, DepreciatingAsset } from "@/lib/types";
import { makeReceiptArchive, makeReceiptFiguresHtml, readEmailEvidence, receiptMime } from "@/lib/receipt-evidence";

export const maxDuration = 60;

// The iOS app's data API: a bearer-auth shell over storage-neon, which already
// scopes every query to the user id it's handed.
//   GET    /api/mobile/<resource>?fy=2025-26   list
//   PUT    /api/mobile/<resource>               upsert the JSON body
//   DELETE /api/mobile/<resource>?id=…          remove
// ponytail: writes only for what the app edits; the rest is read-only here
// because rental, CGT and actual-cost WFH stay web-only for now.

type Params = { params: Promise<{ resource: string }> };
type Resource = {
  get: (userId: string, q: URLSearchParams) => Promise<unknown>;
  put?: (userId: string, body: never) => Promise<void>;
  del?: (userId: string, id: string) => Promise<void>;
};

const fy = (q: URLSearchParams) => {
  const value = q.get("fy");
  return value && value in FY_DATE_RANGES ? (value as FinancialYear) : undefined;
};

const receiptId = (q: URLSearchParams) => {
  const id = q.get("id") ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error("Invalid receipt id.");
  return id;
};

const receiptRows = async (userId: string, q: URLSearchParams) => {
  const year = fy(q);
  if (!year) throw new Error("Choose a valid financial year.");
  const expenses = await db.getExpenses(userId, year);
  const originals: Record<string, string | null> = {};
  for (let i = 0; i < expenses.length; i += 500)
    Object.assign(originals, await db.getExpenseReceipts(userId, expenses.slice(i, i + 500).map(e => e.id)));
  return { year, expenses: expenses.map(e => ({ ...e, receiptDataUrl: originals[e.id] ?? undefined })) };
};

const RESOURCES: Record<string, Resource> = {
  data: { get: async u => {
    const settings = await db.getSettings(u);
    const year = settings.financialYear;
    const [expenses, assets, wfhEntries, wfhActualCosts, cgt, rentalProperties, rentalTransactions] = await Promise.all([
      db.getExpenses(u, year), db.getAssets(u, year), db.getWfhEntries(u, year), db.getWfhActualCosts(u, year),
      db.getCgtTransactions(u), db.getRentalProperties(u), db.getRentalTransactions(u, year),
    ]);
    return { settings, expenses, assets, wfhEntries, wfhActualCosts, cgt, rentalProperties, rentalTransactions };
  } },
  settings: { get: (u) => db.getSettings(u), put: db.saveSettings },
  expenses: {
    get: (u, q) => db.getExpenses(u, fy(q)),
    put: (u, body: Expense & { linkedAsset?: DepreciatingAsset }) => db.saveExpense(u, body, body.linkedAsset),
    del: db.deleteExpense,
  },
  assets: { get: (u, q) => db.getAssets(u, fy(q)), put: db.saveAsset },
  wfh: {
    get: (u, q) => db.getWfhEntries(u, fy(q)),
    put: db.saveWfhEntry,
    del: db.deleteWfhEntry,
  },
  "wfh-costs": { get: (u, q) => db.getWfhActualCosts(u, fy(q)) },
  cgt: { get: (u) => db.getCgtTransactions(u) },
  "rental-properties": { get: (u) => db.getRentalProperties(u) },
  "rental-transactions": { get: (u, q) => db.getRentalTransactions(u, fy(q)) },
  "receipt-evidence": { get: async (u, q) => {
    const dataUrl = await db.getExpenseReceipt(u, receiptId(q));
    if (!dataUrl || receiptMime(dataUrl) !== "message/rfc822") return { dataUrl, email: null };
    try { return { dataUrl, email: await readEmailEvidence(dataUrl) }; }
    catch { return { dataUrl, email: null, previewError: "Email preview unavailable. The original email and its attachments are still available." }; }
  } },
  "receipt-pack": { get: async (u, q) => {
    const { expenses } = await receiptRows(u, q);
    // Printed PDFs cannot use HTML download links. Keep the original payloads
    // in the ZIP so email/PDF base64 isn't duplicated in this response.
    return { html: await makeReceiptFiguresHtml(expenses, false), missing: expenses.filter(e => !e.receiptDataUrl).map(e => e.id) };
  } },
  "receipt-archive": { get: async (u, q) => {
    const { expenses, year } = await receiptRows(u, q);
    return { base64: Buffer.from(makeReceiptArchive(expenses, year)).toString("base64"), missing: expenses.filter(e => !e.receiptDataUrl).length };
  } },
  // one expense's stored receipt (image, PDF or email) as a data URL, or null
  receipt: {
    get: (u, q) => {
      const id = q.get("id") ?? "";
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? db.getExpenseReceipt(u, id) : Promise.resolve(null);
    },
  },
};

const handle = async (
  request: Request,
  { params }: Params,
  run: (userId: string, resource: Resource) => Promise<Response>
) => {
  const userId = await getBearerUserId(request);
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const resource = RESOURCES[(await params).resource];
  if (!resource) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    return await run(userId, resource);
  } catch (error) {
    console.warn("mobile api failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Couldn't reach your data. Try again." }, { status: 500 });
  }
};

const notAllowed = () => NextResponse.json({ error: "Not allowed" }, { status: 405 });

export const GET = (request: Request, ctx: Params) =>
  handle(request, ctx, async (userId, r) =>
    NextResponse.json(await r.get(userId, new URL(request.url).searchParams))
  );

export const PUT = (request: Request, ctx: Params) =>
  handle(request, ctx, async (userId, r) => {
    if (!r.put) return notAllowed();
    const body = await request.json().catch(() => null);
    // settings are keyed by user; every other row needs its own id
    const isSettings = r === RESOURCES.settings;
    if (!body || typeof body !== "object" || (!isSettings && typeof body.id !== "string")) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    await r.put(userId, body as never);
    return new Response(null, { status: 204 });
  });

export const DELETE = (request: Request, ctx: Params) =>
  handle(request, ctx, async (userId, r) => {
    const id = new URL(request.url).searchParams.get("id");
    if (!r.del) return notAllowed();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    await r.del(userId, id);
    return new Response(null, { status: 204 });
  });
