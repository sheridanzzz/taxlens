import type { AirtailReceipt, ImportedReceipt, ReceiptEvidence } from "@shared/airtail-receipt";
import type { Expense, FinancialYear } from "@shared/types";
import { addDays } from "@shared/tax-time";
import { api } from "./api";
import { needsReceipt } from "./expenses";

// The web connector's API (/api/integrations/airtail), called with the app's
// bearer token. Connecting a mailbox stays on the web.

/** List rows carry the id an import would get, worked out on the server. */
export type ListedReceipt = AirtailReceipt & { expenseId: string };
export type AirtailStatus = { configured: boolean; signedIn: boolean; connected: boolean; accountEmail?: string; expired: boolean };

export const airtailStatus = () => api<AirtailStatus>("/api/integrations/airtail");
export const airtailReceipts = (fy: FinancialYear, cursor?: string | null) =>
  api<{ receipts: ListedReceipt[]; nextCursor?: string | null }>(
    `/api/integrations/airtail/receipts?fy=${fy}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`
  );
export const airtailEvidence = (id: string) => api<ReceiptEvidence>(`/api/integrations/airtail/receipts/${id}`);

/** Already in Ledgr: imported as its own expense, or attached to one. */
export const isSaved = (r: ListedReceipt, expenses: Expense[]) =>
  expenses.some((e) => e.id === r.expenseId || !!e.notes?.includes(`Airtail import: ${r.id}`));

/** An expense still missing its receipt with the same AUD amount, within 3 days. */
export const matchFor = (r: ListedReceipt, expenses: Expense[]) =>
  r.currency !== "AUD"
    ? undefined
    : expenses.find(
        (e) => needsReceipt(e) && Math.abs(e.amount - r.amount) < 0.005 && e.date >= addDays(r.date, -3) && e.date <= addDays(r.date, 3)
      );

// ponytail: the original email can run to megabytes, too big for route params,
// so the review screen hands it to the expense form through this one slot.
let pending: ImportedReceipt | null = null;
export const handOffImport = (r: ImportedReceipt) => {
  pending = r;
};
export const pendingImport = () => pending;
export const clearImport = () => {
  pending = null;
};
