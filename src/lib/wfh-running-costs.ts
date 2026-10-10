import type { Expense } from "./types";

export const isWfhRunningCost = (expense: Pick<Expense, "category"> & Partial<Pick<Expense, "description" | "claimType">>) => {
  if (expense.claimType === "depreciation") return false;
  if (["internet_phone", "electricity", "stationery_consumables"].includes(expense.category)) return true;
  // Older imports used Other. Match bills and consumables, without treating
  // unrelated expenses or physical electrical equipment as household bills.
  return expense.category === "other" && /\b(electricity (?:bill|payment)|electric bill|energy (?:bill|payment)|gas (?:bill|payment)|stationery|printer ink|ink cartridges?|toner cartridges?|printing paper)\b/i.test(expense.description ?? "");
};
