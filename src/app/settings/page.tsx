"use client";

import { toLocalDate } from "@/lib/utils";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Download,
  Upload,
  Trash2,
  Save,
  CheckCircle,
  Info,
  LogOut,
  UserRound,
  SlidersHorizontal,
  Database,
  Plug,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAsyncAction } from "@/hooks/use-async-action";
import { AirtailConnector } from "@/components/settings/airtail-connector";
import { useTax } from "@/context/tax-context";
import { useAuth } from "@/context/auth-context";
import { FINANCIAL_YEARS } from "@/lib/constants";
import {
  exportAllData,
  importAllData,
  clearAllData,
} from "@/lib/storage";
import type {
  FinancialYear,
  DepreciationMethod,
  WfhMethod,
  TaxOptions,
} from "@/lib/types";

const RESIDENCY_LABELS: Record<string, string> = {
  resident: "Australian Resident",
  non_resident: "Non-Resident",
  working_holiday: "Working Holiday",
};

const WFH_METHOD_LABELS: Record<string, string> = {
  fixed_rate: "Fixed Rate (70c/hour)",
  actual_cost: "Actual Cost",
};

const DEP_METHOD_LABELS: Record<string, string> = {
  diminishing: "Diminishing Value",
  prime_cost: "Prime Cost",
};

type InfoTipProps = {
  content: string;
};

const InfoTip = ({ content }: InfoTipProps) => (
  <Tooltip>
    <TooltipTrigger className="cursor-help" aria-label="More info">
      <Info className="h-3 w-3 text-muted-foreground/50" />
    </TooltipTrigger>
    <TooltipContent side="top" className="max-w-[260px]">
      <p>{content}</p>
    </TooltipContent>
  </Tooltip>
);

const SettingsPage = () => {
  const { state, updateSettings, refreshData } = useTax();
  const { user, signOut, cloudEnabled } = useAuth();
  const action = useAsyncAction();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const occupationInputRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [importError, setImportError] = useState("");
  const [activeTab, setActiveTab] = useState<"profile" | "preferences" | "data" | "connections">(
    "profile"
  );
  const [connectionsVisited, setConnectionsVisited] = useState(false);
  const selectTab = useCallback((tab: typeof activeTab) => {
    setActiveTab(tab);
    if (tab === "connections") setConnectionsVisited(true);
  }, []);

  const editOccupation = () => {
    selectTab("profile");
    requestAnimationFrame(() => {
      occupationInputRef.current?.focus();
      occupationInputRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  };

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("airtail")) queueMicrotask(() => selectTab("connections"));
  }, [selectTab]);

  const [income, setIncome] = useState(state.settings.annualIncome.toString());
  const [occupation, setOccupation] = useState(state.settings.occupation);
  const [fy, setFy] = useState<FinancialYear>(state.settings.financialYear);
  const [residency, setResidency] = useState(state.settings.taxResidentStatus);
  const [defaultWorkUse, setDefaultWorkUse] = useState(
    state.settings.defaultWorkUsePercent.toString()
  );
  const [wfhMethod, setWfhMethod] = useState<WfhMethod>(
    state.settings.wfhMethod
  );
  const [depMethod, setDepMethod] = useState<DepreciationMethod>(
    state.settings.depreciationMethod
  );
  const [helpDebt, setHelpDebt] = useState(state.settings.hasHelpDebt);
  const [taxOptions, setTaxOptions] = useState<TaxOptions>(state.settings.taxOptions ?? {});
  const [privateCover, setPrivateCover] = useState(
    state.settings.hasPrivateHospitalCover
  );

  // Settings load async — re-seed the form once they arrive, or a hard
  // reload of this page shows defaults and Save wipes the real values.
  useEffect(() => {
    if (!state.loaded) return;
    // Hydrate drafts only when the asynchronous account load completes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIncome(state.settings.annualIncome.toString());
    setOccupation(state.settings.occupation);
    setFy(state.settings.financialYear);
    setResidency(state.settings.taxResidentStatus);
    setDefaultWorkUse(state.settings.defaultWorkUsePercent.toString());
    setWfhMethod(state.settings.wfhMethod);
    setDepMethod(state.settings.depreciationMethod);
    setHelpDebt(state.settings.hasHelpDebt);
    setPrivateCover(state.settings.hasPrivateHospitalCover);
    setTaxOptions(state.settings.taxOptions ?? {});
    // The Airtail callback, login and the iOS app all land here with ?airtail=…
    if (new URLSearchParams(window.location.search).has("airtail")) selectTab("connections");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.loaded]);

  const handleSave = () => action.run(async () => {
    await updateSettings({
      ...state.settings,
      annualIncome: Number(income),
      occupation,
      financialYear: fy,
      taxResidentStatus: residency,
      defaultWorkUsePercent: Number(defaultWorkUse),
      wfhMethod,
      depreciationMethod: depMethod,
      hasHelpDebt: helpDebt,
      hasPrivateHospitalCover: privateCover,
      taxOptions,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  });

  const handleExport = () => action.run(async () => {
    const data = await exportAllData();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledgr-backup-${toLocalDate()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    void action.run(async () => {
      const success = await importAllData(await file.text());
      if (!success) throw new Error("Could not import this backup. Check the file and storage connection, then retry.");
      await refreshData();
      setImportError("");
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClearAll = () => action.run(async () => {
    await clearAllData();
    await refreshData();
    setClearDialogOpen(false);
  });

  if (!state.loaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      </div>
    );
  }

  const fyLabel = FINANCIAL_YEARS.find((f) => f.value === fy)?.label ?? fy;

  return (
    <div className="w-full max-w-5xl space-y-6">
      <section>
        <h1 className="font-serif text-3xl leading-tight md:text-[40px]">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your tax profile, preferences and data.</p>
        <p className="mt-2 text-xs text-muted-foreground">Estimates assume a single adult and a full tax year. Family thresholds, senior offsets and part-year residency need separate assessment. The 2026–27 Medicare threshold uses current law until the annual update.</p>
      </section>

      {!clearDialogOpen && action.error && <p role="alert" className="text-sm text-destructive">{action.error}</p>}
      <div
        className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface-2/60 p-1"
        role="tablist"
        aria-label="Settings sections"
      >
        {[
          { id: "profile", label: "Profile", icon: UserRound },
          { id: "preferences", label: "Preferences", icon: SlidersHorizontal },
          { id: "data", label: "Data & account", icon: Database },
          { id: "connections", label: "Connections", icon: Plug },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            onClick={() =>
              selectTab(id as "profile" | "preferences" | "data" | "connections")
            }
            className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-md px-4 text-sm transition-colors ${
              activeTab === id
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {connectionsVisited && <div hidden={activeTab !== "connections"}>
        <AirtailConnector onEditOccupation={editOccupation} />
      </div>}

      {cloudEnabled && activeTab === "profile" ? (
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm">Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{user?.email}</p>
                <p className="text-[11px] text-muted-foreground">
                  Signed in &middot; Data synced to cloud
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut className="mr-1.5 h-3.5 w-3.5" />
                Sign out
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : !cloudEnabled && activeTab === "data" ? (
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm">Storage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Running in local mode: data stays in this browser&apos;s storage.
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              To enable sign-in and cloud sync, add{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                NEXT_PUBLIC_SUPABASE_URL
              </code>{" "}
              and{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                NEXT_PUBLIC_SUPABASE_ANON_KEY
              </code>{" "}
              to <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">.env.local</code>{" "}
              (see <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">.env.local.example</code>
              ), run the SQL migration in Supabase, then restart the dev server.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4">
        <Card
          className={`border-border/50 ${
            activeTab === "profile" ? "" : "hidden"
          }`}
        >
          <CardHeader className="pb-4">
            <CardTitle className="text-sm">Tax Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="settings-income" className="text-xs">
                  Annual Income ($)
                </Label>
                <InfoTip content="Your gross annual salary before tax. Used to calculate your marginal tax rate and estimate how much your deductions will save you." />
              </div>
              <Input
                id="settings-income"
                type="number"
                step="1"
                min="0"
                placeholder="e.g. 120000"
                value={income}
                onChange={(e) => setIncome(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="settings-occupation" className="text-xs">
                  Occupation
                </Label>
                <InfoTip content="Your job title as it appears on your tax return. This helps identify which deductions are relevant to your role." />
              </div>
              <Input
                id="settings-occupation"
                ref={occupationInputRef}
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="settings-fy" className="text-xs">
                  Financial Year
                </Label>
                <InfoTip content="The Australian financial year runs July 1 to June 30. Select the year you're preparing deductions for." />
              </div>
              <Select
                value={fy}
                onValueChange={(v) => setFy(v as FinancialYear)}
              >
                <SelectTrigger id="settings-fy">
                  <span>{fyLabel}</span>
                </SelectTrigger>
                <SelectContent>
                  {FINANCIAL_YEARS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="settings-residency" className="text-xs">
                  Tax Residency
                </Label>
                <InfoTip content="Your tax residency status determines your tax brackets and thresholds. Most people working in Australia full-time are 'Australian Resident' -- this gives you the tax-free threshold of $18,200." />
              </div>
              <Select
                value={residency}
                onValueChange={(v) =>
                  setResidency(v as typeof residency)
                }
              >
                <SelectTrigger id="settings-residency">
                  <span>
                    {RESIDENCY_LABELS[residency] ?? residency}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="resident">
                    Australian Resident
                  </SelectItem>
                  <SelectItem value="non_resident">Non-Resident</SelectItem>
                  <SelectItem value="working_holiday">
                    Working Holiday
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <details className="space-y-3 rounded-lg border border-border p-3">
              <summary className="cursor-pointer text-sm">Repayment income and exemptions</summary>
              <p className="text-xs text-muted-foreground">Rental losses are added back automatically. Enter other reportable amounts once; these affect HELP and surcharge thresholds.</p>
              {([
                ["reportableSuperContributions", "Reportable super contributions"],
                ["reportableFringeBenefits", "Reportable fringe benefits"],
                ["otherNetInvestmentLosses", "Other net investment losses"],
                ["exemptForeignEmploymentIncome", "Exempt foreign employment income"],
                ["helpDebtBalance", "Remaining HELP debt (optional)"],
              ] as const).map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <Label htmlFor={`tax-${key}`} className="text-xs">{label} ($)</Label>
                  <Input id={`tax-${key}`} type="number" min="0" step="0.01" value={taxOptions[key] ?? ""}
                    onChange={(e) => setTaxOptions({ ...taxOptions, [key]: e.target.value === "" ? undefined : Number(e.target.value) })} />
                </div>
              ))}
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="tax-medicare-exempt" className="text-xs">Eligible for full Medicare levy exemption</Label>
                <Switch id="tax-medicare-exempt" checked={!!taxOptions.medicareExempt} onCheckedChange={(value) => setTaxOptions({ ...taxOptions, medicareExempt: value })} />
              </div>
              {residency === "working_holiday" && <>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="tax-whm-resident" className="text-xs">Australian tax resident while on working holiday visa</Label>
                  <Switch id="tax-whm-resident" checked={!!taxOptions.workingHolidayResident} onCheckedChange={(value) => setTaxOptions({ ...taxOptions, workingHolidayResident: value, workingHolidayTreatyResident: value ? taxOptions.workingHolidayTreatyResident : false })} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="tax-whm-treaty" className="text-xs">Resident eligible for treaty non-discrimination rates</Label>
                  <Switch id="tax-whm-treaty" disabled={!taxOptions.workingHolidayResident} checked={!!taxOptions.workingHolidayTreatyResident} onCheckedChange={(value) => setTaxOptions({ ...taxOptions, workingHolidayTreatyResident: value })} />
                </div>
                <p className="text-xs text-muted-foreground">Treaty rates require both Australian tax residency and an eligible nationality. Confirm eligibility with the ATO.</p>
              </>}
            </details>
          </CardContent>
        </Card>

        <Card
          className={`border-border/50 ${
            activeTab === "preferences" ? "" : "hidden"
          }`}
        >
          <CardHeader className="pb-4">
            <CardTitle className="text-sm">Defaults</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="settings-work-use" className="text-xs">
                  Default Work Use %
                </Label>
                <InfoTip content="The percentage of an item used for work vs personal. For a laptop used 100% for work, set 100%. If you also use it personally, a common split is 70-80%. The ATO may ask for evidence of this split." />
              </div>
              <Input
                id="settings-work-use"
                type="number"
                min="1"
                max="100"
                value={defaultWorkUse}
                onChange={(e) => setDefaultWorkUse(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="settings-wfh-method" className="text-xs">
                  WFH Method
                </Label>
                <InfoTip content="Fixed Rate is simpler -- claim 70c for every hour worked from home (covers electricity, phone, internet, stationery). Actual Cost lets you claim the real work-portion of each bill, which can be higher if your bills are large. Ledgr compares both so you can pick whichever saves more." />
              </div>
              <Select
                value={wfhMethod}
                onValueChange={(v) =>
                  setWfhMethod(v as WfhMethod)
                }
              >
                <SelectTrigger id="settings-wfh-method">
                  <span>
                    {WFH_METHOD_LABELS[wfhMethod] ?? wfhMethod}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed_rate">
                    Fixed Rate (70c/hour)
                  </SelectItem>
                  <SelectItem value="actual_cost">Actual Cost</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="settings-dep-method" className="text-xs">
                  Default Depreciation Method
                </Label>
                <InfoTip content="Diminishing Value gives you larger deductions in the early years (best for items that lose value fast like laptops). Prime Cost spreads deductions evenly across the asset's life. For IT gear, Diminishing Value usually maximises your refund." />
              </div>
              <Select
                value={depMethod}
                onValueChange={(v) =>
                  setDepMethod(v as DepreciationMethod)
                }
              >
                <SelectTrigger id="settings-dep-method">
                  <span>
                    {DEP_METHOD_LABELS[depMethod] ?? depMethod}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="diminishing">
                    Diminishing Value
                  </SelectItem>
                  <SelectItem value="prime_cost">Prime Cost</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="settings-help-debt" className="text-xs">
                  HELP / HECS debt
                </Label>
                <InfoTip content="HELP uses repayment income: taxable income plus reportable amounts and net investment losses. Marginal repayments are capped at 10% of repayment income and the remaining debt; thresholds depend on the financial year." />
              </div>
              <Switch
                id="settings-help-debt"
                checked={helpDebt}
                onCheckedChange={setHelpDebt}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="settings-private-cover" className="text-xs">
                  Private hospital cover
                </Label>
                <InfoTip content="Without hospital cover, income over the singles threshold (about $101,000 in FY 2025-26) attracts the Medicare levy surcharge of 1-1.5%. Deductions that push you under the threshold remove it entirely." />
              </div>
              <Switch
                id="settings-private-cover"
                checked={privateCover}
                onCheckedChange={setPrivateCover}
              />
            </div>


          </CardContent>
        </Card>
      </div>

      {(activeTab === "profile" || activeTab === "preferences") && (<Button onClick={handleSave} disabled={action.busy} className="mt-2 w-full" size="sm">
              {saved ? (
                <>
                  <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                  Save Settings
                </>
              )}
            </Button>)}

      <Card
        className={`border-border/50 ${activeTab === "data" ? "" : "hidden"}`}
      >
        <CardHeader className="pb-4">
          <CardTitle className="text-sm">Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export
            </Button>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
                id="import-file"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                Import
              </Button>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setClearDialogOpen(true)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Clear All
            </Button>
          </div>
          {importError && (
            <p className="text-xs text-destructive">{importError}</p>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your expenses, assets, WFH entries,
              investments, rental property ledgers, and settings. Consider
              exporting a backup first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {action.error && <p role="alert" className="text-sm text-destructive">{action.error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={action.busy} onClick={(event) => { event.preventDefault(); void handleClearAll(); }}>
              Clear Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SettingsPage;
