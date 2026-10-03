import type { RunningCostBill } from "@shared/types";
import { FY_DATE_RANGES } from "@shared/constants";
import { formatCurrency } from "@shared/tax-calculator";
import { taxTimeFor, weekStatuses } from "@shared/tax-time";
import { uncheckedScans } from "@/components/receipt-review";
import { needsReceipt, plural } from "./expenses";
import type { Data } from "./store";

export const BILLS: { key: RunningCostBill; label: string }[] = [
  { key: "electricity", label: "Electricity or gas" },
  { key: "phone", label: "Phone" },
  { key: "internet", label: "Internet" },
];

export type CheckItem = { id: "income" | "gaps" | "bills" | "receipts" | "scans"; title: string; detail: string; done: boolean };

/** Every week of the settings FY with its hours and status, up to today. */
export const yearWeeks = (data: Data, today: string) => {
  const fy = data.settings.financialYear;
  const end = FY_DATE_RANGES[fy].end;
  return weekStatuses(fy, data.wfhEntries, taxTimeFor(data.settings).awayWeeks ?? [], today < end ? today : end);
};

/** What's left before lodging the settings FY. Hours and bills only count when there's a 70c claim. */
export const checklist = (data: Data, today: string): CheckItem[] => {
  const record = taxTimeFor(data.settings);
  const claimsHours = data.settings.wfhMethod === "fixed_rate" && data.wfhEntries.length > 0;
  const gaps = claimsHours ? yearWeeks(data, today).filter((w) => w.status === "gap").length : 0;
  const bills = BILLS.filter((b) => record.bills?.[b.key]).length;
  const missing = data.expenses.filter(needsReceipt).length;
  const unchecked = uncheckedScans(data.expenses).length;

  const items: CheckItem[] = [
    record.taxWithheld === undefined
      ? { id: "income", title: "Add your income statement", detail: "The tax withheld, from myGov under Employment income statements", done: false }
      : { id: "income", title: "Income statement added", detail: `${formatCurrency(record.taxWithheld)} withheld`, done: true },
  ];
  if (claimsHours) {
    items.push(
      gaps
        ? { id: "gaps", title: `${plural(gaps, "week")} with no hours`, detail: "Log the days you worked from home, or mark the week office or leave", done: false }
        : { id: "gaps", title: "Hours diary complete", detail: "Every week has hours or is marked away", done: true },
      {
        id: "bills",
        title: bills === BILLS.length ? "70c bills kept" : `${bills} of ${BILLS.length} bills kept`,
        detail: "The 70c rate needs one bill for each running cost you pay",
        done: bills === BILLS.length,
      }
    );
  }
  items.push(
    missing
      ? { id: "receipts", title: `${plural(missing, "receipt")} missing`, detail: "Attach a photo or email, or mark it personal", done: false }
      : { id: "receipts", title: "Every receipt attached", detail: "Each claimed expense has its record", done: true },
    unchecked
      ? { id: "scans", title: `${plural(unchecked, "scan")} to check`, detail: "AI-read receipts you haven't looked over yet", done: false }
      : { id: "scans", title: "Scans checked", detail: "Every AI-read receipt has had a look", done: true }
  );
  return items;
};
