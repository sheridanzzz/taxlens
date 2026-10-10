import type { Expense } from "./types";
import { isAiScanned } from "./constants";

export const expenseReviewStatus = (expense: Expense) => expense.reviewStatus ??
  (isAiScanned(expense) && expense.workUsePercent === 0 ? "pending" :
    expense.workUsePercent === 0 ? "personal" : "reviewed");
