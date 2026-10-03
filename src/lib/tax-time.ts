import type {
  DepreciatingAsset,
  Expense,
  FinancialYear,
  TaxOptions,
  TaxSummary,
  TaxTimeRecord,
  UserSettings,
  WfhEntry,
  WfhMethod,
} from "./types";
import { FY_DATE_RANGES, WFH_FIXED_RATE_PER_HOUR } from "./constants";
import { ASSET_TYPE_TO_CATEGORY, isCoveredByFixedRate } from "./tax-calculator";
import { applyCarClaimCaps } from "./expense-claims";
import { calculateCurrentYearDepreciation } from "./depreciation";
import { MYTAX_WFH, myTaxItemFor } from "./mytax";

// Lodging helpers shared by the iOS Tax time tab, gap finder and Lodge mode.

export const taxTimeFor = (s: UserSettings, fy: FinancialYear = s.financialYear): TaxTimeRecord => s.taxTime?.[fy] ?? {};

export const withTaxTime = (s: UserSettings, fy: FinancialYear, patch: Partial<TaxTimeRecord>): UserSettings => ({
  ...s,
  taxTime: { ...s.taxTime, [fy]: { ...taxTimeFor(s, fy), ...patch } },
});

// ponytail: taxTime rides inside the tax_options jsonb column so it needs no
// migration; give it its own column if it outgrows a settings blob.
export const unpackTaxOptions = (json: unknown): Pick<UserSettings, "taxOptions" | "taxTime"> => {
  const { taxTime, ...taxOptions } = (json ?? {}) as TaxOptions & { taxTime?: UserSettings["taxTime"] };
  return { taxOptions, taxTime };
};
export const packTaxOptions = (s: UserSettings) => ({ ...s.taxOptions, taxTime: s.taxTime });

/** The year to lodge: the FY that ended last 30 June, while self-lodging is open (to 31 October). */
export const lodgingYear = (today: string): FinancialYear | null =>
  (Object.keys(FY_DATE_RANGES) as FinancialYear[]).find((fy) => {
    const end = FY_DATE_RANGES[fy].end;
    return today > end && today <= `${end.slice(0, 4)}-10-31`;
  }) ?? null;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Tax withheld minus the estimated bill: positive is a refund, negative is owing. */
export const refundEstimate = (summary: Pick<TaxSummary, "taxPayable" | "taxPayableWithoutDeductions">, taxWithheld: number) => ({
  withDeductions: round2(taxWithheld - summary.taxPayable),
  withoutDeductions: round2(taxWithheld - summary.taxPayableWithoutDeductions),
});

// ── Weeks ────────────────────────────────────────────────────────────
// Dates are YYYY-MM-DD strings; maths runs in UTC so daylight saving can't shift a day.

const DAY = 86_400_000;
const toTime = (d: string) => Date.parse(`${d}T00:00:00Z`);
export const addDays = (d: string, n: number) => new Date(toTime(d) + n * DAY).toISOString().slice(0, 10);
/** 0 = Monday … 6 = Sunday */
export const weekdayOf = (d: string) => (new Date(toTime(d)).getUTCDay() + 6) % 7;
export const mondayOf = (d: string) => addDays(d, -weekdayOf(d));

export type Week = { monday: string; days: string[] };
export type WeekStatus = "logged" | "away" | "gap" | "future";

/** Monday-to-Sunday weeks with a weekday inside the FY, keeping only the in-FY days. */
export const fyWeeks = (fy: FinancialYear): Week[] => {
  const { start, end } = FY_DATE_RANGES[fy];
  const weeks: Week[] = [];
  for (let monday = mondayOf(start); monday <= end; monday = addDays(monday, 7)) {
    const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i)).filter((d) => d >= start && d <= end);
    if (days.some((d) => weekdayOf(d) < 5)) weeks.push({ monday, days });
  }
  return weeks;
};

/** A week is a gap once it's over (up to lastDay) with no hours and not marked away. */
export const weekStatuses = (fy: FinancialYear, entries: WfhEntry[], awayWeeks: string[], lastDay: string) => {
  const byDate = new Map<string, number>();
  for (const e of entries) byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.hours);
  const away = new Set(awayWeeks);
  return fyWeeks(fy).map((w) => {
    const hours = w.days.reduce((s, d) => s + (byDate.get(d) ?? 0), 0);
    const status: WeekStatus =
      hours > 0 ? "logged" : away.has(w.monday) ? "away" : w.days[w.days.length - 1] > lastDay ? "future" : "gap";
    return { ...w, hours, status };
  });
};

/** Usual hours per weekday (Mon…Sun): the most common value for weekdays worked
 *  in at least half the logged weeks, otherwise 0. */
export const usualWeek = (entries: WfhEntry[]): number[] => {
  const weeks = new Set(entries.filter((e) => e.hours > 0).map((e) => mondayOf(e.date))).size;
  return Array.from({ length: 7 }, (_, wd) => {
    const hours = entries.filter((e) => e.hours > 0 && weekdayOf(e.date) === wd).map((e) => e.hours);
    if (!weeks || hours.length * 2 < weeks) return 0;
    const counts = new Map<number, number>();
    for (const h of hours) counts.set(h, (counts.get(h) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
  });
};

/** Days "fill from usual week" would add: usual weekdays in these weeks not already logged. */
export const fillPlan = (weeks: Week[], usual: number[], logged: Set<string>) =>
  weeks.flatMap((w) =>
    w.days.filter((d) => usual[weekdayOf(d)] > 0 && !logged.has(d)).map((date) => ({ date, hours: usual[weekdayOf(date)] }))
  );

// ── Lodge mode ───────────────────────────────────────────────────────

export type LodgeLine = { label: string; detail: string; amount: number };

/** What makes up one myTax item's total — the same grouping getMyTaxRows sums. */
export const lodgeLines = (
  item: string,
  expenses: Expense[],
  assets: DepreciatingAsset[],
  wfhEntries: WfhEntry[],
  fy: FinancialYear,
  wfhMethod: WfhMethod,
  wfhDeduction: number
): LodgeLine[] => {
  if (item === MYTAX_WFH) {
    const hours = wfhEntries.reduce((s, e) => s + e.hours, 0);
    return [
      wfhMethod === "fixed_rate"
        ? { label: `${hours.toLocaleString("en-AU")} hours × ${Math.round(WFH_FIXED_RATE_PER_HOUR * 100)}c`, detail: "Fixed rate, from your hours diary", amount: wfhDeduction }
        : { label: "Actual running costs", detail: "Entered on the web", amount: wfhDeduction },
    ];
  }
  const fromExpenses = applyCarClaimCaps(expenses)
    .filter((e) => e.claimableAmount > 0 && !isCoveredByFixedRate(e, wfhMethod) && myTaxItemFor(e.category) === item)
    .map((e) => ({
      label: e.description,
      detail: `${e.date} · ${e.workUsePercent}% of ${e.amount.toFixed(2)}`,
      amount: e.claimableAmount,
    }));
  const fromAssets = assets
    .filter((a) => myTaxItemFor(ASSET_TYPE_TO_CATEGORY[a.assetType] ?? "other") === item)
    .map((a) => ({ label: a.name, detail: "Depreciation this year", amount: round2(calculateCurrentYearDepreciation(a, fy)) }))
    .filter((l) => l.amount > 0);
  return [...fromExpenses, ...fromAssets];
};
