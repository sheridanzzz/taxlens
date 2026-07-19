"use server";

import { auth } from "@/lib/auth";
import * as neonDb from "@/lib/storage-neon";
import type {
  Expense,
  DepreciatingAsset,
  WfhEntry,
  WfhActualCost,
  UserSettings,
  FinancialYear,
} from "./types";

const getUserId = async (): Promise<string> => {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
};

export const neonGetExpenses = async (fy?: FinancialYear): Promise<Expense[]> => {
  const userId = await getUserId();
  return neonDb.getExpenses(userId, fy);
};

export const neonSaveExpense = async (expense: Expense): Promise<void> => {
  const userId = await getUserId();
  await neonDb.saveExpense(userId, expense);
};

export const neonDeleteExpense = async (id: string): Promise<void> => {
  const userId = await getUserId();
  await neonDb.deleteExpense(userId, id);
};

export const neonGetExpenseReceipt = async (id: string): Promise<string | null> => {
  const userId = await getUserId();
  return neonDb.getExpenseReceipt(userId, id);
};

export const neonGetAssets = async (fy?: FinancialYear): Promise<DepreciatingAsset[]> => {
  const userId = await getUserId();
  return neonDb.getAssets(userId, fy);
};

export const neonSaveAsset = async (asset: DepreciatingAsset): Promise<void> => {
  const userId = await getUserId();
  await neonDb.saveAsset(userId, asset);
};

export const neonDeleteAsset = async (id: string): Promise<void> => {
  const userId = await getUserId();
  await neonDb.deleteAsset(userId, id);
};

export const neonGetWfhEntries = async (fy?: FinancialYear): Promise<WfhEntry[]> => {
  const userId = await getUserId();
  return neonDb.getWfhEntries(userId, fy);
};

export const neonSaveWfhEntry = async (entry: WfhEntry): Promise<void> => {
  const userId = await getUserId();
  await neonDb.saveWfhEntry(userId, entry);
};

export const neonDeleteWfhEntry = async (id: string): Promise<void> => {
  const userId = await getUserId();
  await neonDb.deleteWfhEntry(userId, id);
};

export const neonGetWfhActualCosts = async (fy?: FinancialYear): Promise<WfhActualCost[]> => {
  const userId = await getUserId();
  return neonDb.getWfhActualCosts(userId, fy);
};

export const neonSaveWfhActualCost = async (cost: WfhActualCost): Promise<void> => {
  const userId = await getUserId();
  await neonDb.saveWfhActualCost(userId, cost);
};

export const neonDeleteWfhActualCost = async (id: string): Promise<void> => {
  const userId = await getUserId();
  await neonDb.deleteWfhActualCost(userId, id);
};

export const neonGetSettings = async (): Promise<UserSettings> => {
  const userId = await getUserId();
  return neonDb.getSettings(userId);
};

export const neonSaveSettings = async (settings: UserSettings): Promise<void> => {
  const userId = await getUserId();
  await neonDb.saveSettings(userId, settings);
};
