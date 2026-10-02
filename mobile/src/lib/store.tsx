import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  CgtTransaction,
  DepreciatingAsset,
  Expense,
  FinancialYear,
  RentalProperty,
  RentalTransaction,
  UserSettings,
  WfhActualCost,
  WfhEntry,
} from "@shared/types";
import { calculateTaxSummary } from "@shared/tax-calculator";
import { calculateCgt } from "@shared/cgt";
import { calculateRentalSummary } from "@shared/rental";
import { api, loadToken, onTokenExpired, saveToken } from "./api";

// The phone's copy of what the web's tax-context holds: the active FY's rows
// plus the whole-history ones, with the summary worked out on-device by the
// same shared functions the web dashboard uses.

type Data = {
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
      const settings = await api<UserSettings>("/api/mobile/settings");
      fy.current = settings.financialYear;
      const [expenses, assets, wfhEntries, wfhActualCosts, cgt, rentalProperties, rentalTransactions] =
        await Promise.all([
          list<Expense[]>("expenses", fy.current),
          list<DepreciatingAsset[]>("assets", fy.current),
          list<WfhEntry[]>("wfh", fy.current),
          list<WfhActualCost[]>("wfh-costs", fy.current),
          // never FY-filtered: FIFO matching needs the whole history
          list<CgtTransaction[]>("cgt"),
          list<RentalProperty[]>("rental-properties"),
          list<RentalTransaction[]>("rental-transactions", fy.current),
        ]);
      setData({ settings, expenses, assets, wfhEntries, wfhActualCosts, cgt, rentalProperties, rentalTransactions });
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
    },
    [reload]
  );

  const remove = useCallback(
    async (key: "expenses" | "wfhEntries", id: string) => {
      await api(`/api/mobile/${RESOURCE[key]}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      await reload(key);
    },
    [reload]
  );

  const saveSettings = useCallback(
    async (settings: UserSettings) => {
      await api("/api/mobile/settings", { method: "PUT", body: settings });
      // the FY may have changed, and every FY-scoped list with it
      await refresh();
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
      s.taxResidentStatus === "resident",
      { hasHelpDebt: s.hasHelpDebt, hasPrivateHospitalCover: s.hasPrivateHospitalCover },
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
    remove,
    saveSettings,
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
