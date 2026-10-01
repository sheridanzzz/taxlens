import { sql } from "@/lib/neon";
import type {
  Expense,
  DepreciatingAsset,
  WfhEntry,
  WfhActualCost,
  UserSettings,
  FinancialYear,
  CgtTransaction,
  RentalProperty,
  RentalTransaction,
} from "./types";
import { DEFAULT_SETTINGS, FY_DATE_RANGES } from "./constants";
import { applyCarClaimCaps } from "./expense-claims";
import { validateExpense, validateAsset, validateSettings, validateWfhEntry, validateWfhActualCost, validateCgtTransaction, validateRentalProperty, validateRentalTransaction } from "./validation";

type Row = Record<string, unknown>;
const timestamp = (value: unknown): string => new Date(value as string).toISOString();

const toExpense = (r: Row): Expense => ({
  id: r.id as string,
  date: r.date as string,
  description: r.description as string,
  amount: Number(r.amount),
  category: r.category as Expense["category"],
  claimType: r.claim_type as Expense["claimType"],
  workUsePercent: Number(r.work_use_percent),
  claimableAmount: Number(r.claimable_amount),
  assetId: (r.asset_id as string) || undefined,
  carId: (r.car_id as string) || undefined,
  kilometres: r.kilometres == null ? undefined : Number(r.kilometres),
  receiptDataUrl: (r.receipt_data_url as string) || undefined,
  hasReceipt: Boolean(r.has_receipt ?? r.receipt_data_url),
  notes: (r.notes as string) || undefined,
  financialYear: r.financial_year as FinancialYear,
  createdAt: timestamp(r.created_at),
});

const toAsset = (r: Row): DepreciatingAsset => ({
  id: r.id as string,
  name: r.name as string,
  assetType: r.asset_type as DepreciatingAsset["assetType"],
  purchaseDate: r.purchase_date as string,
  purchasePrice: Number(r.purchase_price),
  effectiveLifeYears: Number(r.effective_life_years),
  depreciationMethod: r.depreciation_method as DepreciatingAsset["depreciationMethod"],
  workUsePercent: Number(r.work_use_percent),
  financialYear: r.financial_year as FinancialYear,
  createdAt: timestamp(r.created_at),
});

const toWfhEntry = (r: Row): WfhEntry => ({
  id: r.id as string,
  date: r.date as string,
  hours: Number(r.hours),
  financialYear: r.financial_year as FinancialYear,
});

const toWfhActualCost = (r: Row): WfhActualCost => ({
  id: r.id as string,
  category: r.category as string,
  annualCost: Number(r.annual_cost),
  workUsePercent: Number(r.work_use_percent),
  financialYear: r.financial_year as FinancialYear,
});

const toRentalProperty = (r: Row): RentalProperty => ({
  id: r.id as string,
  address: r.address as string,
  ownershipPercent: Number(r.ownership_percent),
  acquiredDate: (r.acquired_date as string) || undefined,
  notes: (r.notes as string) || undefined,
  createdAt: timestamp(r.created_at),
});

const toRentalTransaction = (r: Row): RentalTransaction => ({
  id: r.id as string,
  propertyId: r.property_id as string,
  date: r.date as string,
  kind: r.kind as RentalTransaction["kind"],
  category: r.category as RentalTransaction["category"],
  description: r.description as string,
  amount: Number(r.amount),
  deductiblePercent: Number(r.deductible_percent),
  financialYear: r.financial_year as FinancialYear,
  notes: (r.notes as string) || undefined,
  createdAt: timestamp(r.created_at),
});

const toSettings = (r: Row): UserSettings => ({
  financialYear: r.financial_year as FinancialYear,
  annualIncome: Number(r.annual_income),
  occupation: r.occupation as string,
  taxResidentStatus: r.tax_resident_status as UserSettings["taxResidentStatus"],
  defaultWorkUsePercent: Number(r.default_work_use_percent),
  wfhMethod: r.wfh_method as UserSettings["wfhMethod"],
  depreciationMethod: r.depreciation_method as UserSettings["depreciationMethod"],
  hasHelpDebt: Boolean(r.has_help_debt),
  hasPrivateHospitalCover: Boolean(r.has_private_hospital_cover),
  taxOptions: (r.tax_options as UserSettings["taxOptions"]) ?? {},
});

// Every ON CONFLICT (id) upsert below ends in WHERE <table>.user_id =
// EXCLUDED.user_id: an id that belongs to someone else must never let the
// caller overwrite that person's row. The conflicting write is a no-op.

// ── Expenses ───────────────────────────────────────────────────────

// receipt payload stays out of list queries — it's fetched on demand via
// getExpenseReceipt. ponytail: receipts live in the same column as always,
// just off the hot path; move to blob storage if they outgrow Postgres.
const EXPENSE_LIST_COLS = `id, user_id, date, description, amount, category,
  claim_type, work_use_percent, claimable_amount, notes, financial_year,
  created_at, asset_id, car_id, kilometres, (receipt_data_url IS NOT NULL AND receipt_data_url <> '') AS has_receipt`;

export const getExpenses = async (userId: string, fy?: FinancialYear): Promise<Expense[]> => {
  const db = sql();
  const rows = fy
    ? await db.query(
        `SELECT ${EXPENSE_LIST_COLS} FROM expenses WHERE user_id = $1 AND financial_year = $2 ORDER BY date DESC`,
        [userId, fy]
      )
    : await db.query(
        `SELECT ${EXPENSE_LIST_COLS} FROM expenses WHERE user_id = $1 ORDER BY date DESC`,
        [userId]
      );
  return applyCarClaimCaps((rows as Row[]).map(toExpense));
};

export const getExpenseReceipt = async (
  userId: string,
  expenseId: string
): Promise<string | null> => {
  const db = sql();
  const rows = await db`SELECT receipt_data_url FROM expenses
    WHERE id = ${expenseId} AND user_id = ${userId}`;
  return (rows[0]?.receipt_data_url as string) || null;
};

export const saveExpense = async (userId: string, e: Expense, asset?: DepreciatingAsset): Promise<void> => {
  e = validateExpense(e);
  if (asset) validateAsset(asset);
  await sql()`SELECT ledger_save_expense(${userId}::uuid, ${JSON.stringify(e)}::jsonb, ${asset ? JSON.stringify(asset) : null}::jsonb)`;
};

export const deleteExpense = async (userId: string, id: string): Promise<void> => {
  await sql()`SELECT ledger_delete_expense(${userId}::uuid, ${id}::uuid)`;
};

// ── Assets ─────────────────────────────────────────────────────────

// An asset keeps deducting for its whole effective life, so a FY view needs
// everything bought on or before that FY ends — not just what was entered in
// it. financial_year stays on the row as the year of purchase, unused here.
export const getAssets = async (userId: string, fy?: FinancialYear): Promise<DepreciatingAsset[]> => {
  const db = sql();
  const rows = fy
    ? await db`SELECT * FROM assets WHERE user_id = ${userId} AND purchase_date <= ${FY_DATE_RANGES[fy].end} ORDER BY purchase_date DESC`
    : await db`SELECT * FROM assets WHERE user_id = ${userId} ORDER BY purchase_date DESC`;
  return rows.map(toAsset);
};

export const saveAsset = async (userId: string, asset: DepreciatingAsset): Promise<void> => {
  validateAsset(asset);
  await sql()`SELECT ledger_save_asset(${userId}::uuid, ${JSON.stringify(asset)}::jsonb)`;
};

export const deleteAsset = async (userId: string, id: string): Promise<void> => {
  await sql()`SELECT ledger_delete_asset(${userId}::uuid, ${id}::uuid)`;
};

// ── WFH Entries ────────────────────────────────────────────────────

export const getWfhEntries = async (userId: string, fy?: FinancialYear): Promise<WfhEntry[]> => {
  const db = sql();
  const rows = fy
    ? await db`SELECT * FROM wfh_entries WHERE user_id = ${userId} AND financial_year = ${fy} ORDER BY date DESC`
    : await db`SELECT * FROM wfh_entries WHERE user_id = ${userId} ORDER BY date DESC`;
  return rows.map(toWfhEntry);
};

export const saveWfhEntry = async (userId: string, e: WfhEntry): Promise<void> => {
  validateWfhEntry(e);
  const db = sql();
  const rows = await db`INSERT INTO wfh_entries (id, user_id, date, hours, financial_year)
     VALUES (${e.id}, ${userId}, ${e.date}, ${e.hours}, ${e.financialYear})
     ON CONFLICT (id) DO UPDATE SET date=EXCLUDED.date, hours=EXCLUDED.hours, financial_year=EXCLUDED.financial_year
     WHERE wfh_entries.user_id = EXCLUDED.user_id RETURNING id`;
  if (!rows.length) throw new Error("Not authorized to update this record.");
};

export const deleteWfhEntry = async (userId: string, id: string): Promise<void> => {
  const db = sql();
  await db`DELETE FROM wfh_entries WHERE id = ${id} AND user_id = ${userId}`;
};

// ── WFH Actual Costs ───────────────────────────────────────────────

export const getWfhActualCosts = async (userId: string, fy?: FinancialYear): Promise<WfhActualCost[]> => {
  const db = sql();
  const rows = fy
    ? await db`SELECT * FROM wfh_actual_costs WHERE user_id = ${userId} AND financial_year = ${fy}`
    : await db`SELECT * FROM wfh_actual_costs WHERE user_id = ${userId}`;
  return rows.map(toWfhActualCost);
};

export const saveWfhActualCost = async (userId: string, c: WfhActualCost): Promise<void> => {
  validateWfhActualCost(c);
  const db = sql();
  const rows = await db`INSERT INTO wfh_actual_costs (id, user_id, category, annual_cost, work_use_percent, financial_year)
     VALUES (${c.id}, ${userId}, ${c.category}, ${c.annualCost}, ${c.workUsePercent}, ${c.financialYear})
     ON CONFLICT (id) DO UPDATE SET category=EXCLUDED.category, annual_cost=EXCLUDED.annual_cost, work_use_percent=EXCLUDED.work_use_percent, financial_year=EXCLUDED.financial_year
     WHERE wfh_actual_costs.user_id = EXCLUDED.user_id RETURNING id`;
  if (!rows.length) throw new Error("Not authorized to update this record.");
};

export const deleteWfhActualCost = async (userId: string, id: string): Promise<void> => {
  const db = sql();
  await db`DELETE FROM wfh_actual_costs WHERE id = ${id} AND user_id = ${userId}`;
};

// ── CGT transactions ───────────────────────────────────────────────

const toCgtTransaction = (r: Row): CgtTransaction => ({
  id: r.id as string,
  kind: r.kind as CgtTransaction["kind"],
  asset: r.asset as string,
  side: r.side as CgtTransaction["side"],
  date: r.date as string,
  quantity: Number(r.quantity),
  unitPrice: Number(r.unit_price),
  fee: Number(r.fee),
  notes: (r.notes as string) || undefined,
  createdAt: timestamp(r.created_at),
});

// never FY-filtered: FIFO matching needs the whole history
export const getCgtTransactions = async (userId: string): Promise<CgtTransaction[]> => {
  const db = sql();
  const rows = await db`SELECT * FROM cgt_transactions WHERE user_id = ${userId} ORDER BY date ASC`;
  return rows.map(toCgtTransaction);
};

export const saveCgtTransaction = async (userId: string, t: CgtTransaction): Promise<void> => {
  validateCgtTransaction(t);
  const db = sql();
  const rows = await db`INSERT INTO cgt_transactions (id, user_id, kind, asset, side, date, quantity, unit_price, fee, notes, created_at)
     VALUES (${t.id}, ${userId}, ${t.kind}, ${t.asset}, ${t.side}, ${t.date}, ${t.quantity}, ${t.unitPrice}, ${t.fee}, ${t.notes ?? null}, ${t.createdAt})
     ON CONFLICT (id) DO UPDATE SET
       kind=EXCLUDED.kind, asset=EXCLUDED.asset, side=EXCLUDED.side, date=EXCLUDED.date,
       quantity=EXCLUDED.quantity, unit_price=EXCLUDED.unit_price, fee=EXCLUDED.fee, notes=EXCLUDED.notes
     WHERE cgt_transactions.user_id = EXCLUDED.user_id RETURNING id`;
  if (!rows.length) throw new Error("Not authorized to update this record.");
};

export const deleteCgtTransaction = async (userId: string, id: string): Promise<void> => {
  const db = sql();
  await db`DELETE FROM cgt_transactions WHERE id = ${id} AND user_id = ${userId}`;
};

// ── Rental properties ──────────────────────────────────────────────

export const getRentalProperties = async (
  userId: string
): Promise<RentalProperty[]> => {
  const db = sql();
  const rows = await db`SELECT * FROM rental_properties
    WHERE user_id = ${userId} ORDER BY created_at ASC`;
  return rows.map(toRentalProperty);
};

export const saveRentalProperty = async (
  userId: string,
  property: RentalProperty
): Promise<void> => {
  validateRentalProperty(property);
  const db = sql();
  const rows = await db`INSERT INTO rental_properties
    (id, user_id, address, ownership_percent, acquired_date, notes, created_at)
    VALUES (${property.id}, ${userId}, ${property.address}, ${property.ownershipPercent},
      ${property.acquiredDate ?? null}, ${property.notes ?? null}, ${property.createdAt})
    ON CONFLICT (id) DO UPDATE SET
      address=EXCLUDED.address, ownership_percent=EXCLUDED.ownership_percent,
      acquired_date=EXCLUDED.acquired_date, notes=EXCLUDED.notes
    WHERE rental_properties.user_id = EXCLUDED.user_id RETURNING id`;
  if (!rows.length) throw new Error("Not authorized to update this record.");
};

export const deleteRentalProperty = async (
  userId: string,
  id: string
): Promise<void> => {
  const db = sql();
  await db`DELETE FROM rental_properties WHERE id = ${id} AND user_id = ${userId}`;
};

export const getRentalTransactions = async (
  userId: string,
  fy?: FinancialYear
): Promise<RentalTransaction[]> => {
  const db = sql();
  const rows = fy
    ? await db`SELECT * FROM rental_transactions
        WHERE user_id = ${userId} AND financial_year = ${fy}
        ORDER BY date DESC, created_at DESC`
    : await db`SELECT * FROM rental_transactions
        WHERE user_id = ${userId} ORDER BY date DESC, created_at DESC`;
  return rows.map(toRentalTransaction);
};

export const saveRentalTransaction = async (
  userId: string,
  transaction: RentalTransaction
): Promise<void> => {
  validateRentalTransaction(transaction);
  const db = sql();
  const rows = await db`INSERT INTO rental_transactions
    (id, user_id, property_id, date, kind, category, description, amount,
      deductible_percent, financial_year, notes, created_at)
    VALUES (${transaction.id}, ${userId}, ${transaction.propertyId},
      ${transaction.date}, ${transaction.kind}, ${transaction.category},
      ${transaction.description}, ${transaction.amount},
      ${transaction.deductiblePercent}, ${transaction.financialYear},
      ${transaction.notes ?? null}, ${transaction.createdAt})
    ON CONFLICT (id) DO UPDATE SET
      property_id=EXCLUDED.property_id, date=EXCLUDED.date, kind=EXCLUDED.kind,
      category=EXCLUDED.category, description=EXCLUDED.description,
      amount=EXCLUDED.amount, deductible_percent=EXCLUDED.deductible_percent,
      financial_year=EXCLUDED.financial_year, notes=EXCLUDED.notes
    WHERE rental_transactions.user_id = EXCLUDED.user_id RETURNING id`;
  if (!rows.length) throw new Error("Not authorized to update this record.");
};

export const deleteRentalTransaction = async (
  userId: string,
  id: string
): Promise<void> => {
  const db = sql();
  await db`DELETE FROM rental_transactions WHERE id = ${id} AND user_id = ${userId}`;
};

// ── Settings ───────────────────────────────────────────────────────

export const getSettings = async (userId: string): Promise<UserSettings> => {
  const db = sql();
  const rows = await db`SELECT * FROM user_settings WHERE user_id = ${userId}`;
  if (!rows[0]) return DEFAULT_SETTINGS;
  return toSettings(rows[0]);
};

export const saveSettings = async (userId: string, s: UserSettings): Promise<void> => {
  validateSettings(s);
  const db = sql();
  await db`INSERT INTO user_settings (user_id, financial_year, annual_income, occupation, tax_resident_status, default_work_use_percent, wfh_method, depreciation_method, has_help_debt, has_private_hospital_cover, tax_options)
     VALUES (${userId}, ${s.financialYear}, ${s.annualIncome}, ${s.occupation}, ${s.taxResidentStatus}, ${s.defaultWorkUsePercent}, ${s.wfhMethod}, ${s.depreciationMethod}, ${s.hasHelpDebt}, ${s.hasPrivateHospitalCover}, ${JSON.stringify(s.taxOptions ?? {})}::jsonb)
     ON CONFLICT (user_id) DO UPDATE SET
       financial_year=EXCLUDED.financial_year, annual_income=EXCLUDED.annual_income, occupation=EXCLUDED.occupation,
       tax_resident_status=EXCLUDED.tax_resident_status, default_work_use_percent=EXCLUDED.default_work_use_percent,
       wfh_method=EXCLUDED.wfh_method, depreciation_method=EXCLUDED.depreciation_method,
       has_help_debt=EXCLUDED.has_help_debt, has_private_hospital_cover=EXCLUDED.has_private_hospital_cover, tax_options=EXCLUDED.tax_options`;
};

// ── Account ────────────────────────────────────────────────────────

// expenses, assets, wfh_* and user_settings cascade from users; the CGT and
// rental tables have no FK to users, so they're cleared explicitly first.
export const deleteUser = async (userId: string): Promise<void> => {
  const db = sql();
  await db.transaction([
    db`DELETE FROM cgt_transactions WHERE user_id = ${userId}`,
    db`DELETE FROM rental_transactions WHERE user_id = ${userId}`,
    db`DELETE FROM rental_properties WHERE user_id = ${userId}`,
    db`DELETE FROM users WHERE id = ${userId}`,
  ]);
};

export const clearAllData = async (userId: string): Promise<void> => {
  await sql()`SELECT ledger_clear_data(${userId}::uuid)`;
};
