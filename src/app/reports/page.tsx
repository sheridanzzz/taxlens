"use client";

import { FileSpreadsheet, Printer } from "lucide-react";
import { motion } from "motion/react";
import { useTax } from "@/context/tax-context";
import {
  formatCurrency,
  getCategoryBreakdown,
  calculateWfhDeductionFixedRate,
  calculateWfhDeductionActualCost,
} from "@/lib/tax-calculator";
import {
  calculateCurrentYearDepreciation,
  calculateRemainingValue,
} from "@/lib/depreciation";
import {
  EXPENSE_CATEGORIES,
  ASSET_EFFECTIVE_LIVES,
  WFH_FIXED_RATE_PER_HOUR,
} from "@/lib/constants";
import { fadeInUp } from "@/lib/animations";

// myTax item each category lands under at lodgment. Depreciation follows its
// category (equipment/furniture → D5); WFH is its own D5 question.
const MYTAX_ITEM: Record<string, string> = {
  travel: "Work-related travel (D2)",
  clothing: "Clothing & laundry (D3)",
  professional_development: "Self-education (D4)",
};
const MYTAX_OTHER = "Other work-related expenses (D5)";
const MYTAX_WFH = "Working from home (D5)";
const MYTAX_ORDER = [
  "Work-related travel (D2)",
  "Clothing & laundry (D3)",
  "Self-education (D4)",
  MYTAX_WFH,
  MYTAX_OTHER,
];

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const downloadCsv = (filename: string, csvContent: string) => {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const ReportsPage = () => {
  const { state, summary } = useTax();
  const fy = state.settings.financialYear;

  if (!state.loaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const breakdown = getCategoryBreakdown(state.expenses, state.assets, fy);
  const wfhFixedTotal = calculateWfhDeductionFixedRate(state.wfhEntries);
  const wfhActualTotal = calculateWfhDeductionActualCost(state.wfhActualCosts);
  const totalHours = state.wfhEntries.reduce((s, e) => s + e.hours, 0);

  const myTaxGroups = new Map<string, number>();
  for (const b of breakdown) {
    const item = MYTAX_ITEM[b.category] ?? MYTAX_OTHER;
    myTaxGroups.set(item, (myTaxGroups.get(item) ?? 0) + b.amount);
  }
  if (summary.totalWfhDeduction > 0) {
    myTaxGroups.set(MYTAX_WFH, summary.totalWfhDeduction);
  }
  const myTaxRows = MYTAX_ORDER.filter((i) => (myTaxGroups.get(i) ?? 0) > 0).map(
    (i) => ({ item: i, amount: myTaxGroups.get(i)! })
  );

  const handleExportTaxSummary = () => {
    const lines = [
      "Ledgr Tax Summary Report", `Financial Year: FY ${fy}`, `Generated: ${new Date().toLocaleDateString("en-AU")}`, `Occupation: ${state.settings.occupation}`, "",
      "SECTION,ITEM,AMOUNT", `Income,Annual Income,${state.settings.annualIncome}`, "",
      `Deductions,Total Full Claims,${summary.totalFullClaims}`, `Deductions,Total Depreciation Claims,${summary.totalDepreciationClaims}`, `Deductions,Total WFH Deduction,${summary.totalWfhDeduction}`, `Deductions,TOTAL DEDUCTIONS,${summary.totalDeductions}`, "",
      `Tax,Taxable Income,${summary.taxableIncome}`, `Tax,Tax Payable (with deductions),${summary.taxPayable}`, `Tax,Tax Payable (without deductions),${summary.taxPayableWithoutDeductions}`, `Tax,ESTIMATED TAX SAVED,${summary.estimatedTaxSaved}`, "",
      ...myTaxRows.map((r) => `myTax,"${r.item}",${Math.round(r.amount * 100) / 100}`),
    ];
    downloadCsv(`ledgr-summary-FY${fy}.csv`, lines.join("\n"));
  };

  const handleExportExpenses = () => {
    const header = "Date,Description,Category,Amount,Claim Type,Work Use %,Claimable Amount";
    const rows = state.expenses.map((e) => `${e.date},"${e.description}",${EXPENSE_CATEGORIES[e.category]?.label || e.category},${e.amount},${e.claimType},${e.workUsePercent},${e.claimableAmount}`);
    downloadCsv(`ledgr-expenses-FY${fy}.csv`, [header, ...rows].join("\n"));
  };

  const handleExportWfh = () => {
    const header = "Date,Hours";
    const rows = state.wfhEntries.sort((a, b) => a.date.localeCompare(b.date)).map((e) => `${e.date},${e.hours}`);
    const footer = ["", `Total Hours,${totalHours}`, `Fixed Rate Deduction (${WFH_FIXED_RATE_PER_HOUR * 100}c/hr),${wfhFixedTotal}`, `Actual Cost Deduction,${wfhActualTotal}`, `Active Method,${state.settings.wfhMethod === "fixed_rate" ? "Fixed Rate" : "Actual Cost"}`];
    downloadCsv(`ledgr-wfh-FY${fy}.csv`, [header, ...rows, ...footer].join("\n"));
  };

  const handleExportDepreciation = () => {
    const header = "Asset,Type,Purchase Date,Purchase Price,Effective Life,Method,Work Use %,This Year Deduction,Remaining Value";
    const rows = state.assets.map((a) => {
      const deduction = calculateCurrentYearDepreciation(a, fy);
      const remaining = calculateRemainingValue(a, fy);
      return `"${a.name}",${ASSET_EFFECTIVE_LIVES[a.assetType]?.label || a.assetType},${a.purchaseDate},${a.purchasePrice},${a.effectiveLifeYears},${a.depreciationMethod},${a.workUsePercent},${deduction},${remaining}`;
    });
    downloadCsv(`ledgr-depreciation-FY${fy}.csv`, [header, ...rows].join("\n"));
  };

  const handleReceiptPack = () => {
    const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-AU");
    const byDate = [...state.expenses].sort((a, b) => a.date.localeCompare(b.date));
    const withReceipt = byDate.filter((e) => e.receiptDataUrl);
    const missing = byDate.filter((e) => !e.receiptDataUrl);

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Ledgr receipt pack — FY ${fy}</title>
<style>
  body{font-family:-apple-system,system-ui,sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem;color:#111}
  h1{font-size:1.3rem} h2{font-size:1rem;margin-top:2rem}
  p.meta{color:#555;font-size:.85rem}
  figure{margin:0 0 2rem;page-break-inside:avoid;border-top:1px solid #ddd;padding-top:1rem}
  figcaption{font-size:.85rem;margin-bottom:.5rem}
  img{max-width:100%;max-height:480px;border:1px solid #ddd;border-radius:6px}
  table{width:100%;border-collapse:collapse;font-size:.85rem}
  td,th{text-align:left;padding:.35rem .5rem;border-bottom:1px solid #eee}
  td:last-child,th:last-child{text-align:right}
  @media print{button{display:none}}
</style></head><body>
<h1>Receipt pack — FY ${fy}</h1>
<p class="meta">Generated ${new Date().toLocaleDateString("en-AU")} · ${withReceipt.length} receipts on file · ${missing.length} entries without receipts</p>
<button onclick="window.print()">Print / Save as PDF</button>
${withReceipt
  .map(
    (e) => `<figure><figcaption><strong>${escapeHtml(e.description)}</strong> — ${fmt(e.date)} · $${e.amount.toFixed(2)} · ${escapeHtml(EXPENSE_CATEGORIES[e.category]?.label || e.category)} · ${e.workUsePercent}% work use</figcaption><img src="${e.receiptDataUrl}" alt="Receipt"></figure>`
  )
  .join("")}
${
  missing.length
    ? `<h2>Entries without a stored receipt</h2><table><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th></tr>${missing
        .map(
          (e) => `<tr><td>${fmt(e.date)}</td><td>${escapeHtml(e.description)}</td><td>${escapeHtml(EXPENSE_CATEGORIES[e.category]?.label || e.category)}</td><td>$${e.amount.toFixed(2)}</td></tr>`
        )
        .join("")}</table>`
    : ""
}
</body></html>`;

    window.open(URL.createObjectURL(new Blob([html], { type: "text/html" })), "_blank");
  };

  const EXPORTS = [
    { label: "Tax summary", detail: "Full overview", handler: handleExportTaxSummary, disabled: false },
    { label: "Expenses", detail: `${state.expenses.length} items`, handler: handleExportExpenses, disabled: state.expenses.length === 0 },
    { label: "WFH log", detail: `${state.wfhEntries.length} days`, handler: handleExportWfh, disabled: state.wfhEntries.length === 0 },
    { label: "Depreciation", detail: `${state.assets.length} assets`, handler: handleExportDepreciation, disabled: state.assets.length === 0 },
    { label: "Receipt pack", detail: "Printable audit file", handler: handleReceiptPack, disabled: state.expenses.length === 0, icon: Printer },
  ];

  return (
    <motion.div
      className="mx-auto max-w-3xl space-y-6"
      initial={fadeInUp.initial}
      animate={fadeInUp.animate}
      transition={fadeInUp.transition}
    >
      <div>
        <p className="text-[13px] text-muted-foreground">
          FY {fy} summary and CSV exports
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 dark:border-border dark:bg-card">
        <p className="text-sm font-medium text-foreground dark:text-foreground">Summary</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Income", value: formatCurrency(state.settings.annualIncome) },
            { label: "Deductions", value: formatCurrency(summary.totalDeductions) },
            { label: "Taxable", value: formatCurrency(summary.taxableIncome) },
            { label: "Tax saved", value: formatCurrency(summary.estimatedTaxSaved), accent: true },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-[11px] text-muted-foreground">{item.label}</p>
              <p className={`stat-number mt-0.5 text-lg font-medium ${item.accent ? "text-foreground dark:text-primary" : "text-foreground dark:text-foreground"}`}>
                {item.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 h-px bg-border dark:bg-[rgba(255,255,255,0.06)]" />

        <div className="mt-4 space-y-2">
          {[
            { label: `Full claims (${state.expenses.filter((e) => e.claimType === "full").length})`, value: summary.totalFullClaims },
            { label: `Depreciation (${state.assets.length})`, value: summary.totalDepreciationClaims },
            { label: `WFH (${state.settings.wfhMethod === "fixed_rate" ? "Fixed" : "Actual"})`, value: summary.totalWfhDeduction },
          ].map((row) => (
            <div key={row.label} className="flex justify-between text-[13px]">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="stat-number text-foreground dark:text-foreground">{formatCurrency(row.value)}</span>
            </div>
          ))}
          <div className="h-px bg-border dark:bg-[rgba(255,255,255,0.06)]" />
          <div className="flex justify-between text-[13px] font-medium">
            <span className="text-foreground dark:text-foreground">Total</span>
            <span className="stat-number text-foreground dark:text-foreground">{formatCurrency(summary.totalDeductions)}</span>
          </div>
        </div>

        {myTaxRows.length > 0 && (
          <>
            <div className="mt-5 h-px bg-border dark:bg-[rgba(255,255,255,0.06)]" />
            <div className="mt-4 space-y-1.5">
              <p className="text-[11px] font-medium text-muted-foreground">
                myTax lodgment items — copy these straight in
              </p>
              {myTaxRows.map((r) => (
                <div key={r.item} className="flex justify-between text-[13px]">
                  <span className="text-muted-foreground">{r.item}</span>
                  <span className="stat-number font-medium text-foreground dark:text-foreground">
                    {formatCurrency(r.amount)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {breakdown.length > 0 && (
          <>
            <div className="mt-5 h-px bg-border dark:bg-[rgba(255,255,255,0.06)]" />
            <div className="mt-4 space-y-1.5">
              <p className="text-[11px] font-medium text-muted-foreground">By category</p>
              {breakdown.map((b) => (
                <div key={b.category} className="flex justify-between text-[13px]">
                  <span className="text-muted-foreground">{b.label}</span>
                  <span className="stat-number text-foreground dark:text-foreground">{formatCurrency(b.amount)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 dark:border-border dark:bg-card">
        <p className="text-sm font-medium text-foreground dark:text-foreground">Export</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {EXPORTS.map((exp) => (
            <motion.button
              key={exp.label}
              onClick={exp.handler}
              disabled={exp.disabled}
              whileHover={exp.disabled ? undefined : { y: -2, boxShadow: "0 4px 16px rgba(14,15,12,0.06)" }}
              whileTap={exp.disabled ? undefined : { scale: 0.97 }}
              className="flex items-center gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-40 dark:border-border dark:hover:bg-secondary"
              aria-label={`Export ${exp.label}`}
              tabIndex={0}
            >
              {(() => { const Icon = exp.icon ?? FileSpreadsheet; return <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />; })()}
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground dark:text-foreground">{exp.label}</p>
                <p className="text-[10px] text-muted-foreground">{exp.detail}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default ReportsPage;
