"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  Upload,
  Camera,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Settings,
  Info,
  FileText,
  TrendingDown,
  Lightbulb,
  Sparkles,
  ScanLine,
  Receipt,
  Calculator,
} from "lucide-react";
import Link from "next/link";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTax } from "@/context/tax-context";
import { scanReceiptViaServer, type ScanInput } from "@/lib/receipt-ai";
import { formatCurrency } from "@/lib/tax-calculator";
import { calculateDiminishingValue, calculatePrimeCost } from "@/lib/depreciation";
import { EXPENSE_CATEGORIES, INSTANT_DEDUCTION_THRESHOLD, ASSET_EFFECTIVE_LIVES } from "@/lib/constants";
import type { Expense, ReceiptScanResult, ExpenseCategory, ClaimType, AssetType, DepreciationMethod, DepreciatingAsset } from "@/lib/types";

type ScanStep = "upload" | "scanning" | "review" | "error" | "saved";

interface ReceiptScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExpenseCreated: () => void;
}

const MAX_IMAGE_DIMENSION = 1536;
const JPEG_QUALITY = 0.85;

const renderPdfToImage = async (file: File): Promise<{ base64: string; mimeType: string }> => {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);

  const scale = MAX_IMAGE_DIMENSION / Math.max(page.view[2], page.view[3]);
  const viewport = page.getViewport({ scale: Math.min(scale, 2) });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;

  await page.render({ canvas, canvasContext: ctx, viewport }).promise;

  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  return { base64: dataUrl.split(",")[1], mimeType: "image/jpeg" };
};

const compressImage = async (file: File): Promise<{ base64: string; mimeType: string }> => {
  if (file.type === "application/pdf") {
    return renderPdfToImage(file);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        const scale = MAX_IMAGE_DIMENSION / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      resolve({ base64: dataUrl.split(",")[1], mimeType: "image/jpeg" });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
};

const SCAN_STAGES = [
  { icon: ScanLine, text: "Reading receipt", detail: "Extracting text and numbers" },
  { icon: Receipt, text: "Identifying items", detail: "Matching line items and totals" },
  { icon: Sparkles, text: "Analysing claimability", detail: "Checking ATO rules for your occupation" },
  { icon: Calculator, text: "Calculating deductions", detail: "Finding the best tax savings strategy" },
];

const ScanningAnimation = ({ previewUrl, isPdf }: { previewUrl: string | null; isPdf: boolean }) => {
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStageIndex((i) => (i + 1) % SCAN_STAGES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  const stage = SCAN_STAGES[stageIndex];
  const Icon = stage.icon;

  return (
    <div className="flex flex-col items-center gap-5 py-8">
      <div className="relative">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Receipt being scanned"
            className="h-32 w-auto rounded-xl border border-border/50 object-cover"
          />
        ) : (
          <div className="flex h-32 w-24 items-center justify-center rounded-xl border border-border/50 bg-muted/20">
            <FileText className="h-10 w-10 text-muted-foreground/30" />
            {isPdf && <span className="absolute bottom-2 text-[9px] font-medium text-muted-foreground/40">PDF</span>}
          </div>
        )}
        <div className="absolute inset-0 rounded-xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-primary/10 to-primary/5 animate-pulse" />
          <div
            className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent"
            style={{ animation: "scanline 2s ease-in-out infinite", top: "0%" }}
          />
        </div>
        <div className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/30">
          <Sparkles className="h-4 w-4 text-primary-foreground animate-pulse" />
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary animate-pulse" />
          <p className="text-sm font-medium">{stage.text}</p>
        </div>
        <p className="text-[11px] text-muted-foreground transition-opacity duration-300">
          {stage.detail}
        </p>
      </div>

      <div className="flex gap-1.5">
        {SCAN_STAGES.map((_, i) => (
          <div
            key={i}
            className={`h-1 rounded-full transition-all duration-500 ${
              i === stageIndex ? "w-6 bg-primary" : i < stageIndex ? "w-1.5 bg-primary/40" : "w-1.5 bg-muted-foreground/20"
            }`}
          />
        ))}
      </div>

      <style jsx>{`
        @keyframes scanline {
          0%, 100% { top: 10%; opacity: 0; }
          10% { opacity: 1; }
          50% { top: 85%; opacity: 1; }
          60% { opacity: 0; }
        }
      `}</style>
    </div>
  );
};

const calcFirstYearDepreciation = (
  cost: number,
  effectiveLife: number,
  method: DepreciationMethod,
  workUsePercent: number,
  daysHeld: number = 365
): number => {
  const raw =
    method === "diminishing"
      ? calculateDiminishingValue(cost, effectiveLife, daysHeld, 0)
      : calculatePrimeCost(cost, effectiveLife, daysHeld);
  return Math.round(raw * (workUsePercent / 100) * 100) / 100;
};

export const ReceiptScanner = ({
  open,
  onOpenChange,
  onExpenseCreated,
}: ReceiptScannerProps) => {
  const { state, addExpense, addAsset } = useTax();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<ScanStep>("upload");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [scanResult, setScanResult] = useState<ReceiptScanResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editCategory, setEditCategory] = useState<ExpenseCategory>("other");
  const [editClaimType, setEditClaimType] = useState<ClaimType>("full");
  const [editWorkUse, setEditWorkUse] = useState("100");
  const [editAssetType, setEditAssetType] = useState<AssetType>("other");
  const [editDepMethod, setEditDepMethod] = useState<DepreciationMethod>("diminishing");
  const [editEffectiveLife, setEditEffectiveLife] = useState("5");
  const [savedAsAsset, setSavedAsAsset] = useState(false);
  const [savedName, setSavedName] = useState("");

  const isDepreciation = editClaimType === "depreciation";
  const amount = parseFloat(editAmount) || 0;
  const workUse = parseFloat(editWorkUse) || 100;
  const effectiveLife = parseFloat(editEffectiveLife) || 5;

  const depreciationPreview = useMemo(() => {
    if (!isDepreciation || amount <= 0) return null;
    const diminishing = calcFirstYearDepreciation(amount, effectiveLife, "diminishing", workUse);
    const primeCost = calcFirstYearDepreciation(amount, effectiveLife, "prime_cost", workUse);
    return { diminishing, primeCost };
  }, [isDepreciation, amount, effectiveLife, workUse]);

  const savingsTips = useMemo(() => {
    const tips: string[] = [];

    if (workUse < 100 && workUse > 0) {
      tips.push(`You're claiming ${workUse}% work use. Keep a diary or log to justify this percentage if audited.`);
    }

    if (isDepreciation) {
      if (depreciationPreview && depreciationPreview.diminishing > depreciationPreview.primeCost) {
        tips.push(`Diminishing Value gives you ${formatCurrency(depreciationPreview.diminishing - depreciationPreview.primeCost)} more this year. Best if you plan to replace this item before its ${effectiveLife}-year life ends.`);
      }
      if (amount > 300 && amount <= 330) {
        tips.push(`This item is just over the $300 threshold. If the receipt includes non-work items, check if the work-related portion is ≤$300 for an instant claim.`);
      }
      tips.push(`Buy before June 30 to start claiming depreciation in this financial year — even a few days of ownership counts.`);
    } else {
      tips.push(`Items under $300 are fully deductible in the year purchased — no need to track depreciation.`);
    }

    if (workUse === 100) {
      tips.push(`Claiming 100% work use means no personal use at all. If you ever use this personally, reduce the percentage to stay ATO-compliant.`);
    }

    tips.push(`Always keep the receipt/invoice for 5 years from the date you lodge your return.`);

    return tips;
  }, [isDepreciation, amount, workUse, effectiveLife, depreciationPreview]);

  const handleReset = useCallback(() => {
    setStep("upload");
    setPreviewUrl(null);
    setIsPdf(false);
    setScanResult(null);
    setErrorMessage("");
    setSavedAsAsset(false);
    setSavedName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setTimeout(handleReset, 200);
  }, [onOpenChange, handleReset]);

  const handleScan = useCallback(
    async (input: ScanInput) => {
      setStep("scanning");

      try {
        const result = await scanReceiptViaServer(input, state.settings.occupation);
        setScanResult(result);
        setEditName(result.itemName);
        setEditAmount(result.amount.toString());
        setEditDate(result.date);
        setEditCategory(result.suggestedCategory);
        setEditClaimType(result.claimType);
        setEditWorkUse(result.suggestedWorkUsePercent.toString());
        setEditAssetType(result.suggestedAssetType ?? "other");
        setEditDepMethod(result.suggestedDepreciationMethod ?? state.settings.depreciationMethod);
        setEditEffectiveLife((result.suggestedEffectiveLife ?? 5).toString());
        setStep("review");
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to scan receipt.");
        setStep("error");
      }
    },
    [state.settings.occupation, state.settings.depreciationMethod]
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const { base64, mimeType } = await compressImage(file);
        const isFilePdf = file.type === "application/pdf";

        setIsPdf(isFilePdf);
        setPreviewUrl(isFilePdf ? null : `data:${mimeType};base64,${base64}`);

        handleScan({ base64, mimeType });
      } catch {
        setErrorMessage("Could not read file. Please try a different format.");
        setStep("error");
      }
    },
    [handleScan]
  );

  const handleSaveExpense = useCallback(async () => {
    if (isNaN(amount) || amount <= 0 || !editName.trim()) return;

    const name = editName.trim();

    if (isDepreciation) {
      const asset: DepreciatingAsset = {
        id: uuidv4(),
        name,
        assetType: editAssetType,
        purchaseDate: editDate,
        purchasePrice: amount,
        effectiveLifeYears: effectiveLife,
        depreciationMethod: editDepMethod,
        workUsePercent: workUse,
        financialYear: state.settings.financialYear,
        createdAt: new Date().toISOString(),
      };
      await addAsset(asset);
      setSavedAsAsset(true);
      setSavedName(name);
      setStep("saved");
      onExpenseCreated();
    } else {
      const claimableAmount = Math.round(amount * (workUse / 100) * 100) / 100;
      const expense: Expense = {
        id: uuidv4(),
        date: editDate,
        description: name,
        amount,
        category: editCategory,
        claimType: "full",
        workUsePercent: workUse,
        claimableAmount,
        receiptDataUrl: previewUrl ?? undefined,
        notes: scanResult
          ? `AI scan: ${scanResult.storeName}. ${scanResult.relevanceExplanation}`
          : undefined,
        financialYear: state.settings.financialYear,
        createdAt: new Date().toISOString(),
      };
      await addExpense(expense);
      setSavedAsAsset(false);
      setSavedName(name);
      setStep("saved");
      onExpenseCreated();
    }
  }, [
    editName, amount, editDate, editCategory, editClaimType, workUse,
    previewUrl, scanResult, state.settings.financialYear,
    isDepreciation, editAssetType, editDepMethod, effectiveLife,
    addExpense, addAsset, onExpenseCreated,
  ]);

  const ReceiptPreview = () => {
    if (previewUrl) {
      return (
        <img
          src={previewUrl}
          alt="Receipt"
          className="h-20 w-auto shrink-0 rounded-lg border border-border/50 object-cover"
        />
      );
    }
    if (isPdf) {
      return (
        <div className="flex h-20 w-16 shrink-0 flex-col items-center justify-center rounded-lg border border-border/50 bg-muted/30">
          <FileText className="h-6 w-6 text-muted-foreground/60" />
          <span className="mt-1 text-[9px] font-medium text-muted-foreground/60">PDF</span>
        </div>
      );
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Scan Receipt
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <p className="text-[13px] text-muted-foreground">
              Upload a receipt image or PDF and AI will extract the details, check if it&apos;s claimable for your occupation, and calculate your deduction.
            </p>

            <div
              className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border/60 p-10 transition-colors hover:border-primary/30 hover:bg-muted/20"
              role="button"
              tabIndex={0}
              aria-label="Upload receipt"
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Upload className="h-5 w-5 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Click to upload receipt</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  JPG, PNG, WebP, HEIC, PDF supported
                </p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="flex items-start gap-2 rounded-lg bg-primary/10 p-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-xs text-muted-foreground">
                AI-powered scanning — receipts are analysed server-side, no API key needed.
              </p>
            </div>
          </div>
        )}

        {step === "scanning" && <ScanningAnimation previewUrl={previewUrl} isPdf={isPdf} />}

        {step === "error" && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <XCircle className="h-5 w-5 text-destructive" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Scan failed</p>
                <p className="mt-1 max-w-xs text-[12px] text-muted-foreground">
                  {errorMessage}
                </p>
              </div>
            </div>
            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Try Again
              </Button>
              {errorMessage.includes("Settings") && (
                <Link href="/settings" onClick={() => onOpenChange(false)}>
                  <Button size="sm">
                    <Settings className="mr-1.5 h-3.5 w-3.5" />
                    Open Settings
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}

        {step === "review" && scanResult && (
          <div className="space-y-5">
            <div className="flex gap-3">
              <ReceiptPreview />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-muted-foreground">{scanResult.storeName}</p>
                <p className="mt-0.5 text-sm font-medium">{scanResult.itemName}</p>
                <p className="stat-number mt-0.5 text-lg font-bold">
                  {formatCurrency(scanResult.amount)}
                </p>
              </div>
            </div>

            <div className={`rounded-lg p-3 ${scanResult.isRelevantToOccupation ? "bg-emerald-500/10" : "bg-amber-500/10"}`}>
              <div className="flex items-center gap-2">
                {scanResult.isRelevantToOccupation ? (
                  <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                )}
                <p className={`text-xs font-medium ${scanResult.isRelevantToOccupation ? "text-emerald-500" : "text-amber-500"}`}>
                  {scanResult.isRelevantToOccupation ? "Likely claimable" : "May not be claimable"}
                </p>
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                {scanResult.relevanceExplanation}
              </p>
            </div>

            <div className="rounded-lg bg-muted/40 p-3">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <p className="text-[11px] font-medium text-foreground">AI tax strategy</p>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                {scanResult.claimAdvice}
              </p>
              {scanResult.depreciationExplanation && (
                <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground border-t border-border/30 pt-2">
                  {scanResult.depreciationExplanation}
                </p>
              )}
            </div>

            {savingsTips.length > 0 && (
              <details className="group" open>
                <summary className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-amber-500 hover:text-amber-400">
                  <Lightbulb className="h-3 w-3" />
                  {savingsTips.length} tip{savingsTips.length > 1 ? "s" : ""} to maximize savings
                </summary>
                <ul className="mt-1.5 space-y-1 pl-[18px]">
                  {savingsTips.map((tip, i) => (
                    <li key={i} className="text-[11px] leading-relaxed text-muted-foreground list-disc">
                      {tip}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {scanResult.rawItems && scanResult.rawItems.length > 1 && (
              <details className="group">
                <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground hover:text-foreground">
                  {scanResult.rawItems.length} line items detected
                </summary>
                <div className="mt-1.5 space-y-0.5 pl-3">
                  {scanResult.rawItems.map((item, i) => (
                    <p key={i} className="text-[11px] text-muted-foreground">{item}</p>
                  ))}
                </div>
              </details>
            )}

            <div className="h-px bg-border/50" />

            <div className="space-y-3">
              <p className="text-xs font-medium">Review & edit</p>

              <div className="space-y-1.5">
                <Label htmlFor="scan-name" className="text-xs">Item Name</Label>
                <Input id="scan-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="scan-amount" className="text-xs">Amount ($)</Label>
                  <Input
                    id="scan-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={editAmount}
                    onChange={(e) => {
                      setEditAmount(e.target.value);
                      const n = parseFloat(e.target.value);
                      if (!isNaN(n) && n > 0) {
                        setEditClaimType(n <= INSTANT_DEDUCTION_THRESHOLD ? "full" : "depreciation");
                      }
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="scan-date" className="text-xs">Date</Label>
                  <Input id="scan-date" type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="scan-category" className="text-xs">Category</Label>
                <Select value={editCategory} onValueChange={(v) => setEditCategory(v as ExpenseCategory)}>
                  <SelectTrigger id="scan-category">
                    <span>{EXPENSE_CATEGORIES[editCategory]?.label ?? editCategory}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EXPENSE_CATEGORIES).map(([key, cat]) => (
                      <SelectItem key={key} value={key}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="scan-claim" className="text-xs">Claim Type</Label>
                  {amount > INSTANT_DEDUCTION_THRESHOLD ? (
                    <div className="flex h-9 items-center rounded-md border border-border/50 bg-muted/30 px-3">
                      <span className="text-sm text-muted-foreground">Depreciation (required over ${INSTANT_DEDUCTION_THRESHOLD})</span>
                    </div>
                  ) : (
                    <Select value={editClaimType} onValueChange={(v) => setEditClaimType(v as ClaimType)}>
                      <SelectTrigger id="scan-claim">
                        <span>{editClaimType === "full" ? "Full Claim (Instant)" : "Depreciation"}</span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">Full Claim (Instant)</SelectItem>
                        <SelectItem value="depreciation">Depreciation</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="scan-work-use" className="text-xs">Work Use %</Label>
                    <Tooltip>
                      <TooltipTrigger className="cursor-help">
                        <Info className="h-3 w-3 text-muted-foreground/50" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[220px]">
                        <p>What portion of this item is used for work? 100% if exclusively for work, lower if also used personally.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input id="scan-work-use" type="number" min="1" max="100" value={editWorkUse} onChange={(e) => setEditWorkUse(e.target.value)} />
                </div>
              </div>

              {isDepreciation && (
                <>
                  <div className="h-px bg-border/50" />
                  <div className="flex items-center gap-1.5">
                    <TrendingDown className="h-3.5 w-3.5 text-primary" />
                    <p className="text-xs font-medium">Depreciation details</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="scan-asset-type" className="text-xs">Asset Type</Label>
                      <Select
                        value={editAssetType}
                        onValueChange={(v) => {
                          const t = v as AssetType;
                          setEditAssetType(t);
                          setEditEffectiveLife(ASSET_EFFECTIVE_LIVES[t].years.toString());
                        }}
                      >
                        <SelectTrigger id="scan-asset-type">
                          <span>{ASSET_EFFECTIVE_LIVES[editAssetType]?.label ?? editAssetType}</span>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ASSET_EFFECTIVE_LIVES).map(([key, val]) => (
                            <SelectItem key={key} value={key}>{val.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Label htmlFor="scan-eff-life" className="text-xs">Effective Life (years)</Label>
                        <Tooltip>
                          <TooltipTrigger className="cursor-help">
                            <Info className="h-3 w-3 text-muted-foreground/50" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[240px]">
                            <p>ATO-specified useful life of the asset. This determines how quickly you can claim the cost over time.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Input id="scan-eff-life" type="number" min="1" max="40" value={editEffectiveLife} onChange={(e) => setEditEffectiveLife(e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="scan-dep-method" className="text-xs">Depreciation Method</Label>
                      <Tooltip>
                        <TooltipTrigger className="cursor-help">
                          <Info className="h-3 w-3 text-muted-foreground/50" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[260px]">
                          <p>Diminishing Value gives bigger deductions early on — best if you replace items often. Prime Cost spreads it evenly — better for long-held assets.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Select value={editDepMethod} onValueChange={(v) => setEditDepMethod(v as DepreciationMethod)}>
                      <SelectTrigger id="scan-dep-method">
                        <span>{editDepMethod === "diminishing" ? "Diminishing Value" : "Prime Cost"}</span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="diminishing">Diminishing Value</SelectItem>
                        <SelectItem value="prime_cost">Prime Cost</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {depreciationPreview && (
                    <div className="rounded-lg bg-primary/5 p-3 space-y-2">
                      <p className="text-xs font-medium text-foreground">First year claimable deduction</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div
                          className={`rounded-md p-2.5 text-center transition-colors ${editDepMethod === "diminishing" ? "bg-primary/10 ring-1 ring-primary/30" : "bg-muted/40"}`}
                          role="button"
                          tabIndex={0}
                          aria-label="Select diminishing value method"
                          onClick={() => setEditDepMethod("diminishing")}
                          onKeyDown={(e) => e.key === "Enter" && setEditDepMethod("diminishing")}
                        >
                          <p className="text-[10px] text-muted-foreground">Diminishing Value</p>
                          <p className={`stat-number mt-0.5 text-base font-bold ${editDepMethod === "diminishing" ? "text-primary" : "text-foreground"}`}>
                            {formatCurrency(depreciationPreview.diminishing)}
                          </p>
                          {depreciationPreview.diminishing >= depreciationPreview.primeCost && (
                            <p className="mt-0.5 text-[9px] font-medium text-emerald-500">Best first year</p>
                          )}
                        </div>
                        <div
                          className={`rounded-md p-2.5 text-center transition-colors ${editDepMethod === "prime_cost" ? "bg-primary/10 ring-1 ring-primary/30" : "bg-muted/40"}`}
                          role="button"
                          tabIndex={0}
                          aria-label="Select prime cost method"
                          onClick={() => setEditDepMethod("prime_cost")}
                          onKeyDown={(e) => e.key === "Enter" && setEditDepMethod("prime_cost")}
                        >
                          <p className="text-[10px] text-muted-foreground">Prime Cost</p>
                          <p className={`stat-number mt-0.5 text-base font-bold ${editDepMethod === "prime_cost" ? "text-primary" : "text-foreground"}`}>
                            {formatCurrency(depreciationPreview.primeCost)}
                          </p>
                          {depreciationPreview.primeCost > depreciationPreview.diminishing && (
                            <p className="mt-0.5 text-[9px] font-medium text-emerald-500">Best first year</p>
                          )}
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Over {effectiveLife} years at {workUse}% work use.
                        {editDepMethod === "diminishing"
                          ? " Diminishing Value front-loads deductions — you claim more in early years."
                          : " Prime Cost gives equal deductions each year."}
                      </p>
                    </div>
                  )}
                </>
              )}

              {!isDepreciation && amount > 0 && (
                <div className="rounded-lg bg-primary/5 p-3">
                  <p className="text-xs text-muted-foreground">
                    Claimable amount:{" "}
                    <span className="stat-number font-semibold text-primary">
                      {formatCurrency(Math.round(amount * (workUse / 100) * 100) / 100)}
                    </span>
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={handleReset}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Scan Another
              </Button>
              <Button size="sm" className="flex-1" onClick={handleSaveExpense} disabled={!editName.trim() || amount <= 0}>
                <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
                {isDepreciation ? "Add Asset" : "Add Expense"}
              </Button>
            </div>

            {isDepreciation && (
              <p className="text-center text-[10px] text-muted-foreground">
                This will be added to your Depreciating Assets and the yearly deduction will be calculated automatically.
              </p>
            )}
          </div>
        )}

        {step === "saved" && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">
                  {savedAsAsset ? "Asset added" : "Expense added"}
                </p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  &ldquo;{savedName}&rdquo; has been saved to your{" "}
                  <span className="font-medium text-foreground">
                    {savedAsAsset ? "Depreciating Assets" : "Expenses"}
                  </span>.
                </p>
                {savedAsAsset && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Yearly depreciation deductions will be calculated automatically.
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Scan Another
              </Button>
              {savedAsAsset ? (
                <Link href="/assets" onClick={() => { onOpenChange(false); setTimeout(handleReset, 200); }}>
                  <Button size="sm">
                    <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
                    View Assets
                  </Button>
                </Link>
              ) : (
                <Button size="sm" onClick={() => { onOpenChange(false); setTimeout(handleReset, 200); }}>
                  Done
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
