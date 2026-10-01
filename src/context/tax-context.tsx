"use client";

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  Expense,
  DepreciatingAsset,
  WfhEntry,
  WfhActualCost,
  UserSettings,
  FinancialYear,
  TaxSummary,
  CgtTransaction,
  RentalProperty,
  RentalTransaction,
} from "@/lib/types";
import * as storage from "@/lib/storage";
import { calculateTaxSummary } from "@/lib/tax-calculator";
import { calculateCgt, type CgtSummary } from "@/lib/cgt";
import { calculateRentalSummary, type RentalSummary } from "@/lib/rental";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { useAuth } from "@/context/auth-context";

interface TaxState {
  settings: UserSettings;
  expenses: Expense[];
  assets: DepreciatingAsset[];
  wfhEntries: WfhEntry[];
  wfhActualCosts: WfhActualCost[];
  /** Every trade ever, not just this FY — FIFO needs the whole history. */
  cgtTransactions: CgtTransaction[];
  rentalProperties: RentalProperty[];
  rentalTransactions: RentalTransaction[];
  loaded: boolean;
}

type TaxAction =
  | { type: "LOAD_ALL"; payload: Omit<TaxState, "loaded"> }
  | { type: "SET_CLAIMS"; expenses: Expense[]; assets: DepreciatingAsset[] }
  | { type: "RESET" }
  | { type: "SET_SETTINGS"; payload: UserSettings }
  | { type: "SET_EXPENSES"; payload: Expense[] }
  | { type: "SET_ASSETS"; payload: DepreciatingAsset[] }
  | { type: "SET_WFH_ENTRIES"; payload: WfhEntry[] }
  | { type: "SET_WFH_ACTUAL_COSTS"; payload: WfhActualCost[] }
  | { type: "SET_CGT"; payload: CgtTransaction[] }
  | { type: "SET_RENTAL_PROPERTIES"; payload: RentalProperty[] }
  | { type: "SET_RENTAL_TRANSACTIONS"; payload: RentalTransaction[] };

const taxReducer = (state: TaxState, action: TaxAction): TaxState => {
  switch (action.type) {
    case "RESET": return initialState;
    case "SET_CLAIMS": return { ...state, expenses: action.expenses, assets: action.assets };
    case "LOAD_ALL":
      return { ...action.payload, loaded: true };
    case "SET_SETTINGS":
      return { ...state, settings: action.payload };
    case "SET_EXPENSES":
      return { ...state, expenses: action.payload };
    case "SET_ASSETS":
      return { ...state, assets: action.payload };
    case "SET_WFH_ENTRIES":
      return { ...state, wfhEntries: action.payload };
    case "SET_WFH_ACTUAL_COSTS":
      return { ...state, wfhActualCosts: action.payload };
    case "SET_CGT":
      return { ...state, cgtTransactions: action.payload };
    case "SET_RENTAL_PROPERTIES":
      return { ...state, rentalProperties: action.payload };
    case "SET_RENTAL_TRANSACTIONS":
      return { ...state, rentalTransactions: action.payload };
    default:
      return state;
  }
};

interface TaxContextValue {
  state: TaxState;
  summary: TaxSummary;
  updateSettings: (settings: UserSettings) => Promise<void>;
  addExpense: (expense: Expense, asset?: DepreciatingAsset) => Promise<void>;
  getSummaryForFy: (fy: FinancialYear) => Promise<TaxSummary>;
  updateExpense: (expense: Expense) => Promise<void>;
  removeExpense: (id: string) => Promise<void>;
  addAsset: (asset: DepreciatingAsset) => Promise<void>;
  updateAsset: (asset: DepreciatingAsset) => Promise<void>;
  removeAsset: (id: string) => Promise<void>;
  addWfhEntry: (entry: WfhEntry) => Promise<void>;
  addWfhEntries: (entries: WfhEntry[]) => Promise<void>;
  removeWfhEntry: (id: string) => Promise<void>;
  addWfhActualCost: (cost: WfhActualCost) => Promise<void>;
  updateWfhActualCost: (cost: WfhActualCost) => Promise<void>;
  removeWfhActualCost: (id: string) => Promise<void>;
  cgt: CgtSummary;
  addCgtTransaction: (tx: CgtTransaction) => Promise<void>;
  addCgtTransactions: (txs: CgtTransaction[]) => Promise<void>;
  removeCgtTransaction: (id: string) => Promise<void>;
  rental: RentalSummary;
  addRentalProperty: (property: RentalProperty) => Promise<void>;
  removeRentalProperty: (id: string) => Promise<void>;
  addRentalTransaction: (transaction: RentalTransaction) => Promise<void>;
  removeRentalTransaction: (id: string) => Promise<void>;
  refreshData: () => Promise<void>;
  /** Expenses for an arbitrary FY — state.expenses only holds the active one. */
  getExpensesForFy: (fy: FinancialYear) => Promise<Expense[]>;
}

const TaxContext = createContext<TaxContextValue | null>(null);

const initialState: TaxState = {
  settings: DEFAULT_SETTINGS,
  expenses: [],
  assets: [],
  wfhEntries: [],
  wfhActualCosts: [],
  cgtTransactions: [],
  rentalProperties: [],
  rentalTransactions: [],
  loaded: false,
};

const emptySummary: TaxSummary = {
  totalExpenses: 0,
  totalFullClaims: 0,
  totalDepreciationClaims: 0,
  totalWfhDeduction: 0,
  totalDeductions: 0,
  estimatedTaxSaved: 0,
  netCapitalGain: 0,
  rentalIncome: 0,
  rentalDeductions: 0,
  netRentalResult: 0,
  taxableIncome: 0,
  taxPayable: 0,
  taxPayableWithoutDeductions: 0,
};

export const TaxProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(taxReducer, initialState);
  const { user, cloudEnabled } = useAuth();
  const [loadError, setLoadError] = useState("");
  const activeFy = useRef(state.settings.financialYear);
  const generation = useRef(0);
  const claimsRequest = useRef(0);

  const loadAll = useCallback(async () => {
    if (cloudEnabled && !user) return;
    const request = ++generation.current;
    const settings = await storage.getSettings();
    const fy = settings.financialYear;
    const [
      expenses,
      assets,
      wfhEntries,
      wfhActualCosts,
      cgtTransactions,
      rentalProperties,
      rentalTransactions,
    ] =
      await Promise.all([
        storage.getExpenses(fy),
        storage.getAssets(fy),
        storage.getWfhEntries(fy),
        storage.getWfhActualCosts(fy),
        storage.getCgtTransactions(),
        storage.getRentalProperties(),
        storage.getRentalTransactions(fy),
      ]);
    if (request !== generation.current) return;
    setLoadError("");
    activeFy.current = fy;
    dispatch({
      type: "LOAD_ALL",
      payload: {
        settings,
        expenses,
        assets,
        wfhEntries,
        wfhActualCosts,
        cgtTransactions,
        rentalProperties,
        rentalTransactions,
      },
    });
  }, [user, cloudEnabled]);

  useEffect(() => {
    dispatch({ type: "RESET" });
    void loadAll().catch(() => setLoadError("Could not load your records. Please try again."));
    // This is a request generation counter, not a DOM ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { generation.current++; };
  }, [loadAll]);

  const cgt = calculateCgt(
    state.cgtTransactions,
    state.settings.financialYear
  );
  const rental = calculateRentalSummary(
    state.rentalProperties,
    state.rentalTransactions
  );

  const summary = state.loaded
    ? calculateTaxSummary(
        state.expenses,
        state.assets,
        state.wfhEntries,
        state.wfhActualCosts,
        state.settings.annualIncome,
        state.settings.financialYear,
        state.settings.wfhMethod,
        state.settings.taxResidentStatus,
        {
          ...state.settings.taxOptions,
          hasHelpDebt: state.settings.hasHelpDebt,
          hasPrivateHospitalCover: state.settings.hasPrivateHospitalCover,
        },
        cgt.netCapitalGain,
        rental.assessableIncome,
        rental.deductibleExpenses
      )
    : emptySummary;

  const updateSettings = useCallback(async (settings: UserSettings) => {
    await storage.saveSettings(settings);
    await loadAll();
  }, [loadAll]);

  const refreshClaims = useCallback(async () => {
    const fy = activeFy.current;
    const request = ++claimsRequest.current;
    const account = generation.current;
    const [expenses, assets] = await Promise.all([storage.getExpenses(fy), storage.getAssets(fy)]);
    if (activeFy.current === fy && account === generation.current && request === claimsRequest.current)
      dispatch({ type: "SET_CLAIMS", expenses, assets });
  }, []);

  const getSummaryForFy = useCallback(async (fy: FinancialYear) => {
    const [expenses, assets, hours, costs, rentals] = await Promise.all([
      storage.getExpenses(fy), storage.getAssets(fy), storage.getWfhEntries(fy),
      storage.getWfhActualCosts(fy), storage.getRentalTransactions(fy),
    ]);
    const rent = calculateRentalSummary(state.rentalProperties, rentals);
    return calculateTaxSummary(expenses, assets, hours, costs, state.settings.annualIncome,
      fy, state.settings.wfhMethod, state.settings.taxResidentStatus,
      { ...state.settings.taxOptions, hasHelpDebt: state.settings.hasHelpDebt,
        hasPrivateHospitalCover: state.settings.hasPrivateHospitalCover },
      calculateCgt(state.cgtTransactions, fy).netCapitalGain, rent.assessableIncome, rent.deductibleExpenses);
  }, [state.settings, state.rentalProperties, state.cgtTransactions]);

  const addExpense = useCallback(
    async (expense: Expense, asset?: DepreciatingAsset) => {
      await storage.saveExpense(expense, asset);
      await refreshClaims();
    },
    [refreshClaims]
  );

  const updateExpense = useCallback(
    async (expense: Expense) => {
      await storage.saveExpense(expense);
      await refreshClaims();
    },
    [refreshClaims]
  );

  const removeExpense = useCallback(
    async (id: string) => {
      await storage.deleteExpense(id);
      await refreshClaims();
    },
    [refreshClaims]
  );

  const addAsset = useCallback(
    async (asset: DepreciatingAsset) => {
      await storage.saveAsset(asset);
      await refreshClaims();
    },
    [refreshClaims]
  );

  const updateAsset = useCallback(
    async (asset: DepreciatingAsset) => {
      await storage.saveAsset(asset);
      await refreshClaims();
    },
    [refreshClaims]
  );

  const removeAsset = useCallback(
    async (id: string) => {
      await storage.deleteAsset(id);
      await refreshClaims();
    },
    [refreshClaims]
  );

  const addWfhEntry = useCallback(
    async (entry: WfhEntry) => {
      await storage.saveWfhEntry(entry);
      await loadAll();
    },
    [loadAll]
  );

  const addWfhEntries = useCallback(
    async (entries: WfhEntry[]) => {
      await Promise.all(entries.map((e) => storage.saveWfhEntry(e)));
      await loadAll();
    },
    [loadAll]
  );

  const removeWfhEntry = useCallback(
    async (id: string) => {
      await storage.deleteWfhEntry(id);
      await loadAll();
    },
    [loadAll]
  );

  const addWfhActualCost = useCallback(
    async (cost: WfhActualCost) => {
      await storage.saveWfhActualCost(cost);
      await loadAll();
    },
    [loadAll]
  );

  const updateWfhActualCost = useCallback(
    async (cost: WfhActualCost) => {
      await storage.saveWfhActualCost(cost);
      await loadAll();
    },
    [loadAll]
  );

  const removeWfhActualCost = useCallback(
    async (id: string) => {
      await storage.deleteWfhActualCost(id);
      await loadAll();
    },
    [loadAll]
  );

  const addCgtTransaction = useCallback(async (tx: CgtTransaction) => {
    await storage.saveCgtTransaction(tx);
    await loadAll();
  }, [loadAll]);

  // one refresh for a whole CSV import instead of one per row
  const addCgtTransactions = useCallback(async (txs: CgtTransaction[]) => {
    for (const tx of txs) await storage.saveCgtTransaction(tx);
    await loadAll();
  }, [loadAll]);

  const removeCgtTransaction = useCallback(async (id: string) => {
    await storage.deleteCgtTransaction(id);
    await loadAll();
  }, [loadAll]);

  const addRentalProperty = useCallback(async (property: RentalProperty) => {
    await storage.saveRentalProperty(property);
    await loadAll();
  }, [loadAll]);

  const removeRentalProperty = useCallback(
    async (id: string) => {
      await storage.deleteRentalProperty(id);
      await loadAll();
    },
    [loadAll]
  );

  const addRentalTransaction = useCallback(
    async (transaction: RentalTransaction) => {
      await storage.saveRentalTransaction(transaction);
      await loadAll();
    },
    [loadAll]
  );

  const removeRentalTransaction = useCallback(
    async (id: string) => {
      await storage.deleteRentalTransaction(id);
      await loadAll();
    },
    [loadAll]
  );

  return (
    <TaxContext.Provider
      value={{
        state,
        summary,
        cgt,
        rental,
        addCgtTransaction,
        addCgtTransactions,
        removeCgtTransaction,
        addRentalProperty,
        removeRentalProperty,
        addRentalTransaction,
        removeRentalTransaction,
        updateSettings,
        addExpense,
        getSummaryForFy,
        updateExpense,
        removeExpense,
        addAsset,
        updateAsset,
        removeAsset,
        addWfhEntry,
        addWfhEntries,
        removeWfhEntry,
        addWfhActualCost,
        updateWfhActualCost,
        removeWfhActualCost,
        refreshData: loadAll,
        getExpensesForFy: storage.getExpenses,
      }}
    >
      {loadError ? <div role="alert" className="m-4 rounded-xl border border-red-300 bg-white p-4 text-sm">
        <p>{loadError}</p><button className="mt-2 underline" onClick={() => void loadAll().catch(() => setLoadError("Could not load your records. Please try again."))}>Try again</button>
      </div> : children}
    </TaxContext.Provider>
  );
};

export const useTax = (): TaxContextValue => {
  const ctx = useContext(TaxContext);
  if (!ctx) throw new Error("useTax must be used within TaxProvider");
  return ctx;
};
