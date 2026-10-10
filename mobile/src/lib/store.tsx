import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  CgtTransaction,
  DepreciatingAsset,
  Expense,
  FinancialYear,
  RentalProperty,
  RentalTransaction,
  TaxTimeRecord,
  UserSettings,
  WfhActualCost,
  WfhEntry,
} from "@shared/types";
import { calculateTaxSummary } from "@shared/tax-calculator";
import { taxTimeFor, withTaxTime } from "@shared/tax-time";
import { calculateCgt } from "@shared/cgt";
import { calculateRentalSummary } from "@shared/rental";
import { api, loadToken, onTokenExpired, saveToken } from "./api";

// The phone's copy of what the web's tax-context holds: the active FY's rows
// plus the whole-history ones, with the summary worked out on-device by the
// same shared functions the web dashboard uses.

export type Data = {
  settings: UserSettings;
  expenses: Expense[];
  assets: DepreciatingAsset[];
  wfhEntries: WfhEntry[];
  wfhActualCosts: WfhActualCost[];
  cgt: CgtTransaction[];
  rentalProperties: RentalProperty[];
  rentalTransactions: RentalTransaction[];
};

// rows the app writes, and the API resource each lives under
type Editable = { expenses: Expense; assets: DepreciatingAsset; wfhEntries: WfhEntry };
const RESOURCE: Record<keyof Editable, string> = {
  expenses: "expenses",
  assets: "assets",
  wfhEntries: "wfh",
};

const list = <T,>(resource: string, fy?: FinancialYear) =>
  api<T>(`/api/mobile/${resource}${fy ? `?fy=${fy}` : ""}`);

const useStoreValue = () => {
  // null while the keychain is being read at launch
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const fy = useRef<FinancialYear | undefined>(undefined);

  const refresh = useCallback(async () => {
    try {
      const account = await api<Data>("/api/mobile/data");
      fy.current = account.settings.financialYear;
      setData(account);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your data.");
    }
  }, []);

  const signOut = useCallback(async () => {
    await saveToken(null);
    // review progress and AI consent belong to whoever was signed in
    localStorage.clear();
    setData(null);
    setSignedIn(false);
  }, []);

  useEffect(() => {
    onTokenExpired(() => void signOut());
    loadToken().then((token) => setSignedIn(!!token));
  }, [signOut]);

  useEffect(() => {
    // Sign-in starts an async request; its completion updates the account state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (signedIn) void refresh();
  }, [signedIn, refresh]);

  const signIn = useCallback(async (email: string, password: string, signup: boolean) => {
    const { token } = await api<{ token: string }>("/api/mobile/token", {
      method: "POST",
      body: { email, password, action: signup ? "signup" : undefined },
    });
    await saveToken(token);
    setSignedIn(true);
  }, []);

  const deleteAccount = useCallback(async () => {
    await api("/api/mobile/account", { method: "DELETE" });
    await signOut();
  }, [signOut]);

  const reload = useCallback(async <K extends keyof Editable>(key: K) => {
    const rows = await list<Editable[K][]>(RESOURCE[key], fy.current);
    setData((d) => (d ? { ...d, [key]: rows } : d));
  }, []);

  const save = useCallback(
    async <K extends keyof Editable>(key: K, row: Editable[K]) => {
      await api(`/api/mobile/${RESOURCE[key]}`, { method: "PUT", body: row });
      await reload(key);
      if (key === "expenses" && (row as Expense).assetId) await reload("assets");
    },
    [reload]
  );

  const saveExpense = useCallback(async (expense: Expense, linkedAsset?: DepreciatingAsset) => {
    await api("/api/mobile/expenses", { method: "PUT", body: { ...expense, linkedAsset } });
    await Promise.all([reload("expenses"), ...(expense.assetId ? [reload("assets")] : [])]);
  }, [reload]);

  /** Several rows, six at a time, one list reload. Stops at the first failed batch; earlier rows stay saved. */
  const saveMany = useCallback(
    async <K extends keyof Editable>(key: K, rows: Editable[K][]) => {
      try {
        for (let i = 0; i < rows.length; i += 6) {
          await Promise.all(rows.slice(i, i + 6).map((row) => api(`/api/mobile/${RESOURCE[key]}`, { method: "PUT", body: row })));
        }
      } finally {
        await reload(key);
      }
    },
    [reload]
  );

  const remove = useCallback(
    async (key: "expenses" | "wfhEntries", id: string) => {
      await api(`/api/mobile/${RESOURCE[key]}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      await Promise.all([reload(key), ...(key === "expenses" ? [reload("assets")] : [])]);
    },
    [reload]
  );

  const saveSettings = useCallback(
    async (settings: UserSettings) => {
      await api("/api/mobile/settings", { method: "PUT", body: settings });
      // a new FY means every FY-scoped list changes; otherwise only settings did
      if (settings.financialYear !== fy.current) await refresh();
      else setData((d) => (d ? { ...d, settings } : d));
    },
    [refresh]
  );

  // Lodging saves queue up and each builds on the last, so two quick taps
  // (ticking two bills) can't both start from the same stale settings.
  const latestSettings = useRef<UserSettings | null>(null);
  const settings = data?.settings;
  useEffect(() => {
    latestSettings.current = settings ?? null;
  }, [settings]);
  const taxTimeQueue = useRef(Promise.resolve());

  /** Merge into one FY's lodging record (tax withheld, bills, Lodge mode progress…).
   *  Pass a function to build on the latest record, e.g. to add to a list. */
  const saveTaxTime = useCallback(
    (patch: Partial<TaxTimeRecord> | ((record: TaxTimeRecord) => Partial<TaxTimeRecord>), year?: FinancialYear) => {
      const run = taxTimeQueue.current.then(async () => {
        const current = latestSettings.current;
        if (!current) return;
        const target = year ?? current.financialYear;
        const next = withTaxTime(current, target, typeof patch === "function" ? patch(taxTimeFor(current, target)) : patch);
        latestSettings.current = next;
        // shown straight away so switches don't snap back mid-save; a failure reloads what's stored
        setData((d) => (d ? { ...d, settings: next } : d));
        try {
          await api("/api/mobile/settings", { method: "PUT", body: next });
        } catch (e) {
          await refresh();
          throw e;
        }
      });
      taxTimeQueue.current = run.catch(() => {});
      return run;
    },
    [refresh]
  );

  /** Another FY's expenses, for the duplicate check — data only holds the active one. */
  const expensesFor = useCallback((year: FinancialYear) => list<Expense[]>("expenses", year), []);

  const summary = useMemo(() => {
    if (!data) return null;
    const { settings: s } = data;
    const cgt = calculateCgt(data.cgt, s.financialYear);
    const rental = calculateRentalSummary(data.rentalProperties, data.rentalTransactions);
    return calculateTaxSummary(
      data.expenses,
      data.assets,
      data.wfhEntries,
      data.wfhActualCosts,
      s.annualIncome,
      s.financialYear,
      s.wfhMethod,
      // same inputs as the web's tax-context, so both show the same numbers
      s.taxResidentStatus,
      { ...s.taxOptions, hasHelpDebt: s.hasHelpDebt, hasPrivateHospitalCover: s.hasPrivateHospitalCover },
      cgt.netCapitalGain,
      rental.assessableIncome,
      rental.deductibleExpenses
    );
  }, [data]);

  return {
    signedIn,
    data,
    summary,
    error,
    refresh,
    signIn,
    signOut,
    deleteAccount,
    save,
    saveExpense,
    saveMany,
    remove,
    saveSettings,
    saveTaxTime,
    expensesFor,
  };
};

const StoreContext = createContext<ReturnType<typeof useStoreValue> | null>(null);

export const StoreProvider = ({ children }: { children: ReactNode }) => (
  <StoreContext.Provider value={useStoreValue()}>{children}</StoreContext.Provider>
);

export const useStore = () => {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used within StoreProvider");
  return store;
};

/** For screens that only render once data has loaded (the tabs gate on it). */
export const useData = () => {
  const store = useStore();
  if (!store.data || !store.summary) throw new Error("useData before data loaded");
  return { ...store, data: store.data, summary: store.summary };
};
