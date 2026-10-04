import { FY_DATE_RANGES } from "@/lib/constants";
import type { FinancialYear } from "@/lib/types";
import { connectorJson, connectorUser, callAirtail } from "@/lib/airtail-server";
import { airtailExpenseId } from "@/lib/airtail-import";
import { suggestReceiptBatch } from "@/lib/receipt-shortlist-server";
import type { AirtailReceipt } from "@/lib/airtail-receipt";
import { sql } from "@/lib/neon";
import { DEFAULT_SETTINGS } from "@/lib/constants";

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
    const settingsPromise = user.supabase
      ? user.supabase.from("user_settings").select("occupation,wfh_method").eq("user_id", user.id).maybeSingle().then(({ data, error }) => {
          if (error) throw new Error("Could not load your work profile. Try again.");
          return { occupation: data?.occupation || "", wfhMethod: data?.wfh_method || DEFAULT_SETTINGS.wfhMethod };
        })
      : sql().query("SELECT occupation, wfh_method FROM user_settings WHERE user_id = $1", [user.id]).then(rows => ({ occupation: rows[0]?.occupation || "", wfhMethod: rows[0]?.wfh_method || DEFAULT_SETTINGS.wfhMethod }));
    const [data, profile] = await Promise.all([callAirtail(user, `receipts?${query}`, "GET", 25_000), settingsPromise]);
    const items: AirtailReceipt[] = Array.isArray(data.receipts) ? data.receipts.slice(0, 50) : [];
    const shortlist = await suggestReceiptBatch(items, profile, params.get("smart") === "1");
    // the expense id an import gets, so the iOS app can match without bundling uuid
    const receipts = items.map(r => ({ ...r, expenseId: airtailExpenseId(r.id), suggestion: shortlist.suggestions[r.id] }));
    return connectorJson({ ...data, receipts, shortlist: { mode: shortlist.mode, occupation: profile.occupation } });
  } catch (error) { return connectorJson({ error: error instanceof Error ? error.message : "Could not retrieve receipts." }, 503); }
}
