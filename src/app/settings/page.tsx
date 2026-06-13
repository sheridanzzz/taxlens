"use client";

import { useState, useRef } from "react";
import {
  Download,
  Upload,
  Trash2,
  Save,
  CheckCircle,
  Info,
  Eye,
  EyeOff,
  Camera,
  LogOut,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useTax } from "@/context/tax-context";
import { useAuth } from "@/context/auth-context";
import { FINANCIAL_YEARS } from "@/lib/constants";
import {
  exportAllData,
  importAllData,
  clearAllData,
  getApiKey,
  saveApiKey,
} from "@/lib/storage";
import type {
  FinancialYear,
  DepreciationMethod,
  WfhMethod,
} from "@/lib/types";

const RESIDENCY_LABELS: Record<string, string> = {
  resident: "Australian Resident",
  non_resident: "Non-Resident",
  working_holiday: "Working Holiday",
};

const WFH_METHOD_LABELS: Record<string, string> = {
  fixed_rate: "Fixed Rate (67c/hour)",
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
  const { user, signOut, supabaseEnabled } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [importError, setImportError] = useState("");

  const [apiKey, setApiKey] = useState(() => getApiKey());
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);

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

  const handleSave = async () => {
    await updateSettings({
      annualIncome: parseFloat(income) || 0,
      occupation,
      financialYear: fy,
      taxResidentStatus: residency,
      defaultWorkUsePercent: parseFloat(defaultWorkUse) || 100,
      wfhMethod,
      depreciationMethod: depMethod,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleExport = async () => {
    const data = await exportAllData();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `taxlens-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const json = ev.target?.result as string;
      const success = await importAllData(json);
      if (success) {
        await refreshData();
        setImportError("");
      } else {
        setImportError("Invalid backup file format.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClearAll = async () => {
    await clearAllData();
    await refreshData();
    setClearDialogOpen(false);
  };

  if (!state.loaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const fyLabel = FINANCIAL_YEARS.find((f) => f.value === fy)?.label ?? fy;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-[13px] text-[#868685]">
          Tax profile and preferences
        </p>
      </div>

      {supabaseEnabled ? (
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
      ) : (
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
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/50">
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
          </CardContent>
        </Card>

        <Card className="border-border/50">
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
                <InfoTip content="Fixed Rate is simpler -- claim 67c for every hour worked from home (covers electricity, phone, internet, stationery). Actual Cost lets you claim the real work-portion of each bill, which can be higher if your bills are large. TaxLens compares both so you can pick whichever saves more." />
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
                    Fixed Rate (67c/hour)
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

            <Button onClick={handleSave} className="mt-2 w-full" size="sm">
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
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">AI Receipt Scanning</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Paste your Google Gemini API key to enable receipt scanning. Uses
            Gemini 2.0 Flash to read receipts, extract details, and assess
            claimability. Your key is stored locally and only sent to
            Google&apos;s API.
          </p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="settings-api-key" className="text-xs">
                Gemini API Key
              </Label>
              <InfoTip content="Get your key from aistudio.google.com/apikey. Gemini Flash has a generous free tier. Your key stays in your browser's local storage." />
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="settings-api-key"
                  type={showApiKey ? "text" : "password"}
                  placeholder="AIza..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pr-10 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground"
                  aria-label={showApiKey ? "Hide API key" : "Show API key"}
                  tabIndex={0}
                >
                  {showApiKey ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  saveApiKey(apiKey.trim());
                  setApiKeySaved(true);
                  setTimeout(() => setApiKeySaved(false), 2000);
                }}
              >
                {apiKeySaved ? (
                  <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                ) : (
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                )}
                {apiKeySaved ? "Saved" : "Save"}
              </Button>
            </div>
          </div>
          {apiKey && (
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <p className="text-[11px] text-emerald-500">
                Key configured — receipt scanning enabled
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50">
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
              This will permanently delete all your expenses, assets, WFH
              entries, and settings. Consider exporting a backup first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAll}>
              Clear Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SettingsPage;
