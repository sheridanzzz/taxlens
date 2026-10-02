import { FY_DATE_RANGES } from "@/lib/constants";
import type { FinancialYear } from "@/lib/types";
import { connectorJson, connectorUser, callAirtail } from "@/lib/airtail-server";

export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const user = await connectorUser();
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
    return connectorJson(await callAirtail(user, `receipts?${query}`));
  } catch (error) { return connectorJson({ error: error instanceof Error ? error.message : "Could not retrieve receipts." }, 503); }
}
