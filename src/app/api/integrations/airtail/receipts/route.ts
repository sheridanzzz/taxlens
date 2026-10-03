import { FY_DATE_RANGES } from "@/lib/constants";
import type { FinancialYear } from "@/lib/types";
import { connectorJson, connectorUser, callAirtail } from "@/lib/airtail-server";
import { airtailExpenseId } from "@/lib/airtail-import";

export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const user = await connectorUser(request);
    if (!user) return connectorJson({ error: "Sign in to Ledgr first." }, 401);
    const params = new URL(request.url).searchParams;
    const fy = params.get("fy") as FinancialYear;
    if (!Object.hasOwn(FY_DATE_RANGES, fy)) return connectorJson({ error: "Select a supported financial year." }, 400);
    const range = FY_DATE_RANGES[fy];
    const end = new Date(`${range.end}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    const query = new URLSearchParams({ start: range.start, end: end.toISOString().slice(0, 10) });
    const cursor = params.get("cursor");
    if (cursor) {
      if (!/^[a-f0-9]{24}$/.test(cursor)) return connectorJson({ error: "Invalid page cursor." }, 400);
      query.set("cursor", cursor);
    }
    const data = await callAirtail(user, `receipts?${query}`);
    // the expense id an import gets, so the iOS app can match without bundling uuid
    const receipts = Array.isArray(data.receipts)
      ? data.receipts.map((r: { id: string }) => ({ ...r, expenseId: airtailExpenseId(r.id) }))
      : data.receipts;
    return connectorJson({ ...data, receipts });
  } catch (error) { return connectorJson({ error: error instanceof Error ? error.message : "Could not retrieve receipts." }, 503); }
}
