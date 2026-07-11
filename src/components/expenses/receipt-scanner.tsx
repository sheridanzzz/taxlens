"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import Link from "next/link";
import {
  X,
  Upload,
  Camera,
  FileText,
  Sparkles,
  ScanLine,
  Check,
  AlertTriangle,
  RotateCw,
  ArrowUpRight,
  Info,
  Loader2,
  Receipt as ReceiptIcon,
} from "lucide-react";
import { Pill } from "@/components/ledgr/primitives";
import { useTax } from "@/context/tax-context";
import { scanReceiptViaServer, type ScanInput } from "@/lib/receipt-ai";
import { formatCurrency, calculateTaxPayable } from "@/lib/tax-calculator";
import { calculateDiminishingValue, calculatePrimeCost } from "@/lib/depreciation";
import { EXPENSE_CATEGORIES, INSTANT_DEDUCTION_THRESHOLD } from "@/lib/constants";
import type {
  Expense,
  ReceiptScanResult,
  ExpenseCategory,
  DepreciationMethod,
  DepreciatingAsset,
} from "@/lib/types";

type ScanStep = "entry" | "scanning" | "review" | "review-notclaimable" | "error" | "saved";
type FileMeta = { name: string; kind: "image" | "pdf" };

interface ReceiptScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExpenseCreated: () => void;
}

const MAX_IMAGE_DIMENSION = 1536;
const JPEG_QUALITY = 0.85;

const STAGES = [
  { label: "Reading receipt", detail: "Extracting merchant, date, totals" },
  { label: "Identifying items", detail: "Parsing line items and GST" },
  { label: "Analysing claimability", detail: "Matching to your occupation" },
  { label: "Calculating deductions", detail: "Instant write-off vs depreciation" },
];

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
  if (file.type === "application/pdf") return renderPdfToImage(file);

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

export const ReceiptScanner = ({ open, onOpenChange, onExpenseCreated }: ReceiptScannerProps) => {
  const { state, summary, addExpense, addAsset } = useTax();

  const [step, setStep] = useState<ScanStep>("entry");
  const [stageIndex, setStageIndex] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [pendingFile, setPendingFile] = useState<FileMeta | null>(null);
  const [scanInput, setScanInput] = useState<ScanInput | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [scanResult, setScanResult] = useState<ReceiptScanResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const [editName, setEditName] = useState("");
  const [editMerchant, setEditMerchant] = useState("");
  const [editAmount, setEditAmount] = useState(0);
  const [editDate, setEditDate] = useState("");
  const [editCategory, setEditCategory] = useState<ExpenseCategory>("other");
  const [editWorkUse, setEditWorkUse] = useState(100);
  const [editDepMethod, setEditDepMethod] = useState<DepreciationMethod>("diminishing");

  const [savedDestination, setSavedDestination] = useState<"expenses" | "assets">("expenses");
  const [savedName, setSavedName] = useState("");
  const [refundImpact, setRefundImpact] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const isDep = editAmount > INSTANT_DEDUCTION_THRESHOLD;
  const effectiveLife = scanResult?.suggestedEffectiveLife ?? 5;
  const claimableAmount = Math.round(editAmount * (editWorkUse / 100) * 100) / 100;

  // real marginal-rate delta from the current ATO bracket, not a flat guess
  const estimateRefundImpact = useCallback(
    (claimable: number) => {
      if (claimable <= 0) return 0;
      const isResident = state.settings.taxResidentStatus === "resident";
      const before = summary.taxableIncome;
      const after = Math.max(0, before - claimable);
      const delta =
        calculateTaxPayable(before, state.settings.financialYear, isResident) -
        calculateTaxPayable(after, state.settings.financialYear, isResident);
      return Math.round(delta * 100) / 100;
    },
    [state.settings.taxResidentStatus, state.settings.financialYear, summary.taxableIncome]
  );

  const handleReset = useCallback(() => {
    setStep("entry");
    setPendingFile(null);
    setScanInput(null);
    setPreviewUrl(null);
    setIsPdf(false);
    setScanResult(null);
    setErrorMessage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }, []);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setTimeout(handleReset, 200);
  }, [onOpenChange, handleReset]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && handleClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  const handleFile = useCallback(async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    const kind: "image" | "pdf" = file.type === "application/pdf" ? "pdf" : "image";
    try {
      const { base64, mimeType } = await compressImage(file);
      setPendingFile({ name: file.name, kind });
      setIsPdf(kind === "pdf");
      setPreviewUrl(kind === "pdf" ? null : `data:${mimeType};base64,${base64}`);
      setScanInput({ base64, mimeType });
    } catch {
      setErrorMessage("Could not read file. Please try a different format.");
      setStep("error");
    }
  }, []);

  // scanning stages cycle for as long as the real scan is in flight
  useEffect(() => {
    if (step !== "scanning" || !scanInput) return;
    let cancelled = false;
    setStageIndex(0);
    const timer = setInterval(() => setStageIndex((i) => (i + 1) % STAGES.length), 1800);

    scanReceiptViaServer(scanInput, state.settings.occupation)
      .then((result) => {
        if (cancelled) return;
        setScanResult(result);
        setEditName(result.itemName);
        setEditMerchant(result.storeName);
        setEditAmount(result.amount);
        setEditDate(result.date);
        setEditCategory(result.suggestedCategory);
        setEditWorkUse(result.suggestedWorkUsePercent);
        setEditDepMethod(result.suggestedDepreciationMethod ?? state.settings.depreciationMethod);
        setStep(result.isRelevantToOccupation ? "review" : "review-notclaimable");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMessage(err instanceof Error ? err.message : "Failed to scan receipt.");
        setStep("error");
      })
      .finally(() => clearInterval(timer));

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, scanInput]);

  const handleManualEntry = useCallback(() => {
    setScanResult(null);
    setEditName("");
    setEditMerchant("");
    setEditAmount(0);
    setEditDate(new Date().toISOString().split("T")[0]);
    setEditCategory("other");
    setEditWorkUse(100);
    setStep("review");
  }, []);

  const handleOverride = useCallback(() => {
    setEditWorkUse((w) => (w > 0 ? w : 100));
    setStep("review");
  }, []);

  const handleSaveExpense = useCallback(async () => {
    if (isNaN(editAmount) || editAmount <= 0 || !editName.trim()) return;

    const name = editName.trim();
    const impact = estimateRefundImpact(claimableAmount);

    if (isDep) {
      const asset: DepreciatingAsset = {
        id: uuidv4(),
        name,
        assetType: scanResult?.suggestedAssetType ?? "other",
        purchaseDate: editDate,
        purchasePrice: editAmount,
        effectiveLifeYears: effectiveLife,
        depreciationMethod: editDepMethod,
        workUsePercent: editWorkUse,
        financialYear: state.settings.financialYear,
        createdAt: new Date().toISOString(),
      };
      await addAsset(asset);
      setSavedDestination("assets");
    } else {
      const expense: Expense = {
        id: uuidv4(),
        date: editDate,
        description: name,
        amount: editAmount,
        category: editCategory,
        claimType: "full",
        workUsePercent: editWorkUse,
        claimableAmount,
        receiptDataUrl: previewUrl ?? undefined,
        notes: scanResult
          ? `AI scan: ${editMerchant}. ${scanResult.relevanceExplanation}`
          : undefined,
        financialYear: state.settings.financialYear,
        createdAt: new Date().toISOString(),
      };
      await addExpense(expense);
      setSavedDestination("expenses");
    }

    setSavedName(name);
    setRefundImpact(impact);
    setStep("saved");
    onExpenseCreated();
  }, [
    editAmount, editName, editDate, editCategory, editWorkUse, editMerchant,
    claimableAmount, effectiveLife, editDepMethod, isDep, previewUrl, scanResult,
    state.settings.financialYear, addExpense, addAsset, onExpenseCreated, estimateRefundImpact,
  ]);

  const handleSaveAsPersonal = useCallback(async () => {
    const name = editName.trim() || "Personal expense";
    const expense: Expense = {
      id: uuidv4(),
      date: editDate,
      description: name,
      amount: editAmount,
      category: "other",
      claimType: "full",
      workUsePercent: 0,
      claimableAmount: 0,
      receiptDataUrl: previewUrl ?? undefined,
      notes: scanResult
        ? `AI scan: ${editMerchant}. ${scanResult.relevanceExplanation}`
        : undefined,
      financialYear: state.settings.financialYear,
      createdAt: new Date().toISOString(),
    };
    await addExpense(expense);
    setSavedDestination("expenses");
    setSavedName(name);
    setRefundImpact(0);
    setStep("saved");
    onExpenseCreated();
  }, [editName, editDate, editAmount, editMerchant, previewUrl, scanResult, state.settings.financialYear, addExpense, onExpenseCreated]);

  if (!open) return null;

  const titleMap: Record<ScanStep, string> = {
    entry: "Scan a receipt",
    scanning: "Scanning",
    review: "Review deduction",
    "review-notclaimable": "Review deduction",
    error: "Something went wrong",
    saved: "Saved",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={handleClose} />
      <div className="surface relative max-h-[92vh] w-full max-w-3xl overflow-y-auto p-0 shadow-2xl">
        <div className="flex h-14 items-center justify-between border-b border-border px-6 md:px-8">
          <div className="flex items-center gap-3">
            <span className="grid h-7 w-7 place-items-center rounded-md border border-gold/30 bg-gold-soft text-gold">
              <ScanLine className="h-4 w-4" />
            </span>
            <div>
              <div className="eyebrow">AI receipt intelligence</div>
              <div className="mt-0.5 font-serif text-lg leading-none">{titleMap[step]}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {(step === "review" || step === "review-notclaimable" || step === "saved") &&
              scanResult?.modelUsed && (
                <span className="hidden text-[11px] text-muted-foreground sm:inline">
                  Read by <span className="text-foreground/80">{scanResult.modelUsed}</span>
                </span>
              )}
            <button
              onClick={handleClose}
              className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-6 md:p-8">
          {step === "entry" && (
            <div>
              <div className="mb-6">
                <div className="eyebrow mb-1">
                  <span className="text-gold">•</span> Step 1 of 3
                </div>
                <h3 className="font-serif text-3xl">Drop a receipt. We&apos;ll do the rest.</h3>
                <p className="mt-2 max-w-lg text-sm text-muted-foreground">
                  Photos or PDFs. We extract every field, judge deductibility against your
                  occupation, and pick the ATO strategy that saves you the most.
                </p>
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  handleFile(e.dataTransfer.files);
                }}
                className={`relative rounded-lg border-2 border-dashed transition-colors ${
                  dragOver ? "border-gold bg-gold-soft/40" : "border-border bg-surface-2/40"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files)}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files)}
                />
                {!pendingFile ? (
                  <div className="p-10 text-center md:p-14">
                    <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full border border-border bg-surface">
                      <Upload className="h-5 w-5 text-gold" strokeWidth={1.5} />
                    </div>
                    <div className="font-serif text-2xl">Drag a receipt here</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      JPG, PNG, HEIC or PDF — resized automatically
                    </div>
                    <div className="mt-6 flex items-center justify-center gap-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex h-9 items-center gap-2 rounded-md bg-gold px-4 text-sm text-primary-foreground hover:opacity-90"
                      >
                        <Upload className="h-4 w-4" /> Browse files
                      </button>
                      <button
                        onClick={() => cameraInputRef.current?.click()}
                        className="inline-flex items-center gap-2 rounded-md border border-border px-4 text-sm md:hidden h-9"
                      >
                        <Camera className="h-4 w-4" /> Camera
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-stretch gap-5 p-5 md:flex-row md:p-6">
                    <div className="grid aspect-[3/4] w-full place-items-center overflow-hidden rounded-md border border-border bg-surface md:w-56">
                      {previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={previewUrl} alt="Receipt" className="h-full w-full object-cover" />
                      ) : (
                        <div className="p-4 text-center">
                          {pendingFile.kind === "pdf" ? (
                            <FileText className="mx-auto h-10 w-10 text-muted-foreground" strokeWidth={1.2} />
                          ) : (
                            <ReceiptIcon className="mx-auto h-10 w-10 text-muted-foreground" strokeWidth={1.2} />
                          )}
                          <div className="mt-2 truncate text-[11px] text-muted-foreground">
                            {pendingFile.name}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col">
                      <div className="eyebrow">Attached</div>
                      <div className="mt-1 truncate font-serif text-2xl">{pendingFile.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Ready to scan. We&apos;ll extract fields and match to your occupation.
                      </div>
                      <div className="mt-auto flex items-center gap-2 pt-6">
                        <button
                          onClick={() => setStep("scanning")}
                          className="inline-flex h-9 items-center gap-2 rounded-md bg-gold px-4 text-sm text-primary-foreground hover:opacity-90"
                        >
                          <ScanLine className="h-4 w-4" /> Scan receipt
                        </button>
                        <button
                          onClick={() => {
                            setPendingFile(null);
                            setScanInput(null);
                            setPreviewUrl(null);
                          }}
                          className="h-9 rounded-md border border-border px-3 text-sm text-muted-foreground hover:text-foreground"
                        >
                          Replace
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
                {[
                  { icon: ScanLine, t: "Line-item extraction", d: "Every item and total, read from the receipt" },
                  { icon: Sparkles, t: "Occupation-aware", d: "Judged against your ATO profile" },
                  { icon: FileText, t: "myTax ready", d: "Category, method, effective life" },
                ].map(({ icon: Icon, t, d }) => (
                  <div key={t} className="flex items-start gap-3 text-sm">
                    <Icon className="mt-0.5 h-4 w-4 text-gold" strokeWidth={1.5} />
                    <div>
                      <div>{t}</div>
                      <div className="text-xs text-muted-foreground">{d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === "scanning" && (
            <div className="grid items-start gap-8 md:grid-cols-[220px_1fr]">
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-md border border-border bg-surface md:w-[220px]">
                <div className="absolute inset-0 grid place-items-center">
                  {previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewUrl} alt="Receipt being scanned" className="h-full w-full object-cover opacity-60" />
                  ) : isPdf ? (
                    <FileText className="h-14 w-14 text-muted-foreground/60" strokeWidth={1} />
                  ) : (
                    <ReceiptIcon className="h-14 w-14 text-muted-foreground/60" strokeWidth={1} />
                  )}
                </div>
                <div
                  className="pointer-events-none absolute inset-x-0 h-14"
                  style={{
                    background:
                      "linear-gradient(180deg, transparent 0%, color-mix(in oklab, var(--color-gold) 40%, transparent) 50%, transparent 100%)",
                    animation: "ledgr-scan 1.8s linear infinite",
                  }}
                />
                <style>{`@keyframes ledgr-scan {0%{transform:translateY(-20%)}100%{transform:translateY(320%)}}`}</style>
              </div>

              <div>
                <div className="eyebrow mb-1">
                  <span className="text-gold">•</span> Working
                </div>
                <h3 className="mb-6 font-serif text-3xl">Reading your receipt.</h3>
                <ol className="space-y-3">
                  {STAGES.map((s, i) => {
                    const doneState = i < stageIndex ? "done" : i === stageIndex ? "active" : "pending";
                    return (
                      <li
                        key={s.label}
                        className={`flex items-start gap-3 rounded-md border p-3 ${
                          doneState === "active" ? "border-gold/40 bg-gold-soft/30" : "border-border"
                        }`}
                      >
                        <span
                          className={`mt-0.5 grid h-5 w-5 place-items-center rounded-full text-[10px] ${
                            doneState === "done"
                              ? "bg-positive/20 text-positive"
                              : doneState === "active"
                                ? "bg-gold text-primary-foreground"
                                : "bg-surface-2 text-muted-foreground"
                          }`}
                        >
                          {doneState === "done" ? (
                            <Check className="h-3 w-3" />
                          ) : doneState === "active" ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            i + 1
                          )}
                        </span>
                        <div className="flex-1">
                          <div className={`text-sm ${doneState === "pending" ? "text-muted-foreground" : ""}`}>
                            {s.label}
                          </div>
                          <div className="text-[11px] text-muted-foreground">{s.detail}</div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          )}

          {(step === "review") && (
            <div>
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    {scanResult && (
                      <Pill tone="gold">
                        <Sparkles className="h-3 w-3" /> AI suggested
                      </Pill>
                    )}
                    <Pill tone={isDep ? "muted" : "positive"}>
                      {isDep ? "Depreciate over time" : "Instant write-off"}
                    </Pill>
                  </div>
                  <h3 className="font-serif text-3xl leading-tight">{editName || "New expense"}</h3>
                  {(editMerchant || editDate) && (
                    <div className="mt-1 text-sm text-muted-foreground">
                      {editMerchant}
                      {editMerchant && editDate ? " · " : ""}
                      {editDate}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="eyebrow">Deductible</div>
                  <div className="font-serif text-4xl tabular text-gold">
                    {formatCurrency(claimableAmount)}
                  </div>
                </div>
              </div>

              {scanResult?.relevanceExplanation && (
                <blockquote className="mb-6 border-l-2 border-gold py-1 pl-4 text-sm italic text-foreground/90">
                  &ldquo;{scanResult.relevanceExplanation}&rdquo;
                </blockquote>
              )}

              <div className="mb-6 grid gap-4 md:grid-cols-2">
                <Field label="Item">
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} className="scan-input" />
                </Field>
                <Field label="Amount (AUD)">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editAmount || ""}
                    onChange={(e) => setEditAmount(parseFloat(e.target.value) || 0)}
                    className="scan-input font-mono tabular"
                  />
                </Field>
                <Field label="Merchant">
                  <input value={editMerchant} onChange={(e) => setEditMerchant(e.target.value)} className="scan-input" />
                </Field>
                <Field label="Date">
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="scan-input font-mono"
                  />
                </Field>
                <Field label="Category">
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as ExpenseCategory)}
                    className="scan-input"
                  >
                    {Object.entries(EXPENSE_CATEGORIES).map(([key, cat]) => (
                      <option key={key} value={key}>{cat.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label={`Work use · ${editWorkUse}%`}>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={editWorkUse}
                    onChange={(e) => setEditWorkUse(Number(e.target.value))}
                    className="mt-2 w-full accent-[var(--color-gold)]"
                  />
                </Field>
              </div>

              {scanResult?.rawItems && scanResult.rawItems.length > 0 && (
                <div className="mb-6">
                  <div className="eyebrow mb-2">Line items</div>
                  <div className="divide-y divide-border rounded-md border border-border">
                    {scanResult.rawItems.map((label, i) => (
                      <div key={i} className="px-3 py-2 text-sm">{label}</div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-6 rounded-md border border-border bg-surface-2/40 p-4">
                {scanResult?.claimAdvice && (
                  <div className="mb-4 flex items-start gap-3">
                    <Info className="mt-0.5 h-4 w-4 text-gold" />
                    <div className="text-sm">
                      <div className="font-medium">Claim strategy</div>
                      <div className="mt-0.5 text-[13px] text-muted-foreground">{scanResult.claimAdvice}</div>
                    </div>
                  </div>
                )}

                {isDep ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {(() => {
                      const dim = calcFirstYearDepreciation(editAmount, effectiveLife, "diminishing", editWorkUse);
                      const prime = calcFirstYearDepreciation(editAmount, effectiveLife, "prime_cost", editWorkUse);
                      return (
                        <>
                          <StrategyCard
                            title="Diminishing value"
                            recommended={editDepMethod === "diminishing"}
                            onClick={() => setEditDepMethod("diminishing")}
                            rows={[
                              ["Year 1", formatCurrency(dim)],
                              ["Lifetime", formatCurrency(claimableAmount)],
                              ["Method", "Declining balance"],
                            ]}
                          />
                          <StrategyCard
                            title="Prime cost"
                            recommended={editDepMethod === "prime_cost"}
                            onClick={() => setEditDepMethod("prime_cost")}
                            rows={[
                              ["Year 1", formatCurrency(prime)],
                              ["Lifetime", formatCurrency(claimableAmount)],
                              ["Method", `Even over ${effectiveLife}yr`],
                            ]}
                          />
                        </>
                      );
                    })()}
                    {scanResult?.depreciationExplanation && (
                      <div className="text-[12px] text-muted-foreground md:col-span-2">
                        {scanResult.depreciationExplanation}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    <StrategyCard
                      title="Instant write-off"
                      recommended
                      rows={[
                        ["This FY", formatCurrency(claimableAmount)],
                        ["Est. refund", `+${formatCurrency(estimateRefundImpact(claimableAmount))}`],
                        ["Method", "Full deduction"],
                      ]}
                    />
                    <StrategyCard
                      title="Depreciate (optional)"
                      rows={[
                        ["This FY", formatCurrency(claimableAmount / 4)],
                        ["Lifetime", formatCurrency(claimableAmount)],
                        ["Method", "Over 4yr"],
                      ]}
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  onClick={handleReset}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm text-muted-foreground hover:text-foreground"
                >
                  <RotateCw className="h-3.5 w-3.5" /> Rescan
                </button>
                <button
                  onClick={handleSaveExpense}
                  disabled={!editName.trim() || editAmount <= 0}
                  className="inline-flex h-9 items-center gap-2 rounded-md bg-gold px-4 text-sm text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isDep ? "Save as asset" : "Save expense"}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {step === "review-notclaimable" && scanResult && (
            <div>
              <div className="mb-6">
                <div className="mb-2 flex items-center gap-2">
                  <Pill tone="negative"><AlertTriangle className="h-3 w-3" /> Not deductible</Pill>
                  <Pill tone="muted">AI reviewed</Pill>
                </div>
                <h3 className="font-serif text-3xl leading-tight">{scanResult.itemName}</h3>
                <div className="mt-1 text-sm text-muted-foreground">
                  {scanResult.storeName} · {scanResult.date} ·{" "}
                  <span className="font-mono tabular">{formatCurrency(scanResult.amount)}</span>
                </div>
              </div>

              <div className="mb-6 rounded-md border border-border bg-surface-2/40 p-4">
                <div className="eyebrow mb-2">Why this isn&apos;t claimable</div>
                <p className="text-sm text-foreground/90">{scanResult.relevanceExplanation}</p>
                {scanResult.claimAdvice && (
                  <p className="mt-3 text-[12px] text-muted-foreground">{scanResult.claimAdvice}</p>
                )}
              </div>

              <div className="mb-6 flex items-start gap-3 rounded-md border border-gold/30 bg-gold-soft/30 p-4">
                <Info className="mt-0.5 h-4 w-4 text-gold" />
                <div className="text-[13px]">
                  <div>Think the AI got this wrong?</div>
                  <div className="mt-0.5 text-muted-foreground">
                    You can override and save it as deductible. You&apos;re responsible for the claim.
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  onClick={handleClose}
                  className="h-9 rounded-md border border-border px-3 text-sm text-muted-foreground hover:text-foreground"
                >
                  Discard
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleOverride}
                    className="h-9 rounded-md border border-border px-3 text-sm"
                  >
                    Override → mark deductible
                  </button>
                  <button
                    onClick={handleSaveAsPersonal}
                    className="inline-flex h-9 items-center gap-2 rounded-md bg-gold px-4 text-sm text-primary-foreground hover:opacity-90"
                  >
                    Save as personal
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === "error" && (
            <div className="mx-auto max-w-md py-6 text-center">
              <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full border border-negative/30 bg-negative/10">
                <AlertTriangle className="h-5 w-5 text-negative" />
              </div>
              <div className="eyebrow mb-1">Scan failed</div>
              <h3 className="font-serif text-3xl">The scanners are catching their breath.</h3>
              <p className="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  onClick={() => setStep("scanning")}
                  disabled={!scanInput}
                  className="inline-flex h-9 items-center gap-2 rounded-md bg-gold px-4 text-sm text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <RotateCw className="h-4 w-4" /> Try again
                </button>
                <button
                  onClick={handleManualEntry}
                  className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  Enter it manually instead
                </button>
              </div>
            </div>
          )}

          {step === "saved" && (
            <div className="mx-auto max-w-md py-6 text-center">
              <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full border border-positive/30 bg-positive/10">
                <Check className="h-5 w-5 text-positive" />
              </div>
              <div className="eyebrow mb-1">Saved to {savedDestination}</div>
              <h3 className="font-serif text-3xl">Filed. Refund just moved.</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {savedName} was added to your{" "}
                <span className="text-foreground">{savedDestination}</span> for FY{" "}
                {state.settings.financialYear}.
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3 text-left">
                <div className="surface p-4">
                  <div className="eyebrow">Deductible added</div>
                  <div className="mt-1 font-serif text-2xl tabular">{formatCurrency(claimableAmount)}</div>
                </div>
                <div className="surface p-4">
                  <div className="eyebrow">Est. refund impact</div>
                  <div className="mt-1 font-serif text-2xl tabular text-positive">
                    +{formatCurrency(refundImpact)}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  onClick={handleReset}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-4 text-sm"
                >
                  Scan another
                </button>
                <Link
                  href={savedDestination === "assets" ? "/assets" : "/expenses"}
                  onClick={handleClose}
                  className="inline-flex h-9 items-center gap-2 rounded-md bg-gold px-4 text-sm text-primary-foreground hover:opacity-90"
                >
                  View {savedDestination} <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="eyebrow mb-1.5">{label}</div>
      {children}
      <style>{`.scan-input{width:100%;height:36px;padding:0 10px;border-radius:6px;background:var(--color-surface-2);border:1px solid var(--color-border);color:var(--color-foreground);font-size:14px;outline:none} .scan-input:focus{border-color:color-mix(in oklab, var(--color-gold) 60%, transparent)}`}</style>
    </label>
  );
}

function StrategyCard({
  title,
  rows,
  recommended,
  onClick,
}: {
  title: string;
  rows: [string, string][];
  recommended?: boolean;
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={`rounded-md border p-3 text-left ${
        recommended ? "border-gold/40 bg-gold-soft/20" : "border-border bg-surface"
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm">{title}</div>
        {recommended && <Pill tone="gold">Recommended</Pill>}
      </div>
      <dl className="space-y-1 text-[12px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-mono tabular">{v}</dd>
          </div>
        ))}
      </dl>
    </Comp>
  );
}
