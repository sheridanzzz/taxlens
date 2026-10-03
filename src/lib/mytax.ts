import type { CategoryBreakdown } from "./types";

// myTax item each category lands under at lodgment. Depreciation follows its
// category (equipment/furniture → D5); WFH is its own D5 question.
const MYTAX_ITEM: Record<string, string> = {
  car_km: "Work-related car (D1)",
  travel: "Work-related travel (D2)",
  clothing: "Clothing & laundry (D3)",
  professional_development: "Self-education (D4)",
  donations: "Gifts & donations (D9)",
  tax_affairs: "Cost of managing tax affairs (D10)",
};
const MYTAX_OTHER = "Other work-related expenses (D5)";
export const MYTAX_WFH = "Working from home (D5)";
export const myTaxItemFor = (category: string) => MYTAX_ITEM[category] ?? MYTAX_OTHER;
const MYTAX_ORDER = [
  "Work-related car (D1)",
  "Work-related travel (D2)",
  "Clothing & laundry (D3)",
  "Self-education (D4)",
  MYTAX_WFH,
  MYTAX_OTHER,
  "Gifts & donations (D9)",
  "Cost of managing tax affairs (D10)",
];

export const getMyTaxRows = (breakdown: CategoryBreakdown[], wfhDeduction: number) => {
  const groups = new Map<string, number>();
  for (const b of breakdown) {
    const item = myTaxItemFor(b.category);
    groups.set(item, (groups.get(item) ?? 0) + b.amount);
  }
  if (wfhDeduction > 0) groups.set(MYTAX_WFH, wfhDeduction);
  return MYTAX_ORDER.filter((i) => (groups.get(i) ?? 0) > 0).map((i) => ({
    item: i,
    amount: groups.get(i)!,
  }));
};
