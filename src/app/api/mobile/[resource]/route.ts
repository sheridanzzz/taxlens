import { NextResponse } from "next/server";
import * as db from "@/lib/storage-neon";
import { getBearerUserId } from "@/lib/mobile-auth";
import { FY_DATE_RANGES } from "@/lib/constants";
import type { FinancialYear } from "@/lib/types";

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

const RESOURCES: Record<string, Resource> = {
  settings: { get: (u) => db.getSettings(u), put: db.saveSettings },
  expenses: {
    get: (u, q) => db.getExpenses(u, fy(q)),
    put: db.saveExpense,
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
