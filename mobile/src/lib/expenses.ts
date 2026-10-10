import { Linking } from "react-native";
import type { Expense, TaxSummary, WfhMethod } from "@shared/types";
import { getCategoryBreakdown, isCoveredByFixedRate } from "@shared/tax-calculator";
import { getMyTaxRows } from "@shared/mytax";
import { API_URL } from "./api";
import type { Data } from "./store";
import { expenseReviewStatus } from "@shared/receipt-review";

export const MYTAX_RENTAL = "Rental property (I21)";

/** The totals myTax asks for, grouped the way the web Reports page does, plus rental. */
export const myTaxRows = (data: Data, summary: TaxSummary) => {
  const rows = getMyTaxRows(
    getCategoryBreakdown(data.expenses, data.settings.wfhMethod, data.assets, data.settings.financialYear),
    summary.totalWfhDeduction
  );
  if (summary.rentalDeductions > 0) rows.push({ item: MYTAX_RENTAL, amount: summary.rentalDeductions });
  return rows;
};

export const openWeb = (path: string) => void Linking.openURL(`${API_URL}${path}`);

export const claimNote = (e: Expense, wfhMethod: WfhMethod) =>
  expenseReviewStatus(e) === "pending" ? "Pending review" : isCoveredByFixedRate(e, wfhMethod)
    ? "Covered by the 70c rate"
    : e.workUsePercent === 0
      ? "Personal · no deduction"
      : e.claimType === "depreciation"
        ? "Over $300, so it's depreciated"
        : e.workUsePercent < 100
          ? `${e.workUsePercent}% work use`
          : "Claimed in full";

/** Claimed, but nothing stored to back it up. List rows omit the image, so hasReceipt covers stored ones. */
export const needsReceipt = (e: Expense) => e.workUsePercent > 0 && !e.receiptDataUrl && !e.hasReceipt;

/** "Self-education (D4)" → "D4" and "Self-education" */
export const myTaxCode = (item: string) => item.match(/\(([A-Z]\d+)\)$/)?.[1] ?? "";
export const myTaxName = (item: string) => item.replace(/ \([A-Z]\d+\)$/, "");

export const shortDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short" });

export const plural = (n: number, word: string) => `${n.toLocaleString("en-AU")} ${word}${n === 1 ? "" : "s"}`;
