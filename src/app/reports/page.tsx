"use client";

import { Download, FileText, Printer } from "lucide-react";
import { motion } from "motion/react";
import { Section, Kpi, Card } from "@/components/ledgr/primitives";
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

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
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

const Row = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => (
  <div className="flex items-baseline justify-between">
    <span className="text-muted-foreground">{label}</span>
    <span className={`font-mono tabular ${bold ? "text-foreground" : "text-muted-foreground"}`}>
      {value}
    </span>
  </div>
);

const ReportsPage = () => {
  const { state, summary } = useTax();
  const fy = state.settings.financialYear;

  if (!state.loaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      </div>
    );
  }

  const breakdown = getCategoryBreakdown(state.expenses, state.assets, fy);
  const wfhFixedTotal = calculateWfhDeductionFixedRate(state.wfhEntries);
  const wfhActualTotal = calculateWfhDeductionActualCost(state.wfhActualCosts);
  const totalHours = state.wfhEntries.reduce((s, e) => s + e.hours, 0);
  const effectiveRate =
    state.settings.annualIncome > 0
      ? (summary.taxPayable / state.settings.annualIncome) * 100
      : 0;

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
    { label: "Tax summary (CSV)", detail: "Full overview + myTax items", handler: handleExportTaxSummary, disabled: false, icon: FileText },
    { label: "Expenses (CSV)", detail: `${state.expenses.length} items`, handler: handleExportExpenses, disabled: state.expenses.length === 0, icon: FileText },
    { label: "WFH hour log (CSV)", detail: `${state.wfhEntries.length} days`, handler: handleExportWfh, disabled: state.wfhEntries.length === 0, icon: FileText },
    { label: "Depreciation schedule (CSV)", detail: `${state.assets.length} assets`, handler: handleExportDepreciation, disabled: state.assets.length === 0, icon: FileText },
    { label: "Receipt pack (print/PDF)", detail: "Audit-ready archive", handler: handleReceiptPack, disabled: state.expenses.length === 0, icon: Printer },
  ];

  return (
    <motion.div
      initial={fadeInUp.initial}
      animate={fadeInUp.animate}
      transition={fadeInUp.transition}
    >
      <Section
        eyebrow="Reports · myTax ready"
        title="Your return, already written."
        action={
          <button
            onClick={handleExportTaxSummary}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-gold px-4 text-sm text-primary-foreground hover:opacity-90"
            aria-label="Export myTax pack"
          >
            <Download className="h-4 w-4" /> Export myTax pack
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Annual income" value={formatCurrency(state.settings.annualIncome)} hint="gross salary" />
        <Kpi
          label="Total deductions"
          value={formatCurrency(summary.totalDeductions)}
          positive={summary.totalDeductions > 0}
        />
        <Kpi
          label="Est. tax saved"
          value={formatCurrency(summary.estimatedTaxSaved)}
          positive={summary.estimatedTaxSaved > 0}
          large
        />
        <Kpi label="Effective rate" value={`${effectiveRate.toFixed(1)}%`} hint="of gross income" />
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="eyebrow">FY {fy} · Deductions summary</div>
          {breakdown.length === 0 && summary.totalWfhDeduction === 0 ? (
            <p className="mt-4 text-[13px] text-muted-foreground">
              Nothing to report yet — add expenses, assets or WFH hours first.
            </p>
          ) : (
            <table className="mt-4 w-full text-sm">
              <tbody>
                {breakdown.map((c, i) => (
                  <tr key={c.category} className="border-b border-border">
                    <td className="py-3">
                      <span
                        className="mr-3 inline-block h-2 w-2 rounded-full"
                        style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      {c.label}
                    </td>
                    <td className="py-3 text-right font-mono tabular">
                      {formatCurrency(c.amount)}
                    </td>
                  </tr>
                ))}
                {summary.totalWfhDeduction > 0 && (
                  <tr className="border-b border-border">
                    <td className="py-3">
                      <span className="mr-3 inline-block h-2 w-2 rounded-full bg-gold" />
                      Working from home (
                      {state.settings.wfhMethod === "fixed_rate" ? "67c fixed rate" : "actual cost"})
                    </td>
                    <td className="py-3 text-right font-mono tabular">
                      {formatCurrency(summary.totalWfhDeduction)}
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="py-4 font-serif text-lg">Total</td>
                  <td className="py-4 text-right font-serif text-lg tabular">
                    {formatCurrency(summary.totalDeductions)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}

          {myTaxRows.length > 0 && (
            <div className="mt-2 border-t border-border pt-4">
              <div className="eyebrow">myTax lodgment items — copy straight in</div>
              <div className="mt-3 space-y-2 text-sm">
                {myTaxRows.map((r) => (
                  <Row key={r.item} label={r.item} value={formatCurrency(r.amount)} bold />
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card>
          <div className="eyebrow">Refund math</div>
          <div className="mt-6 space-y-4 text-sm">
            <Row label="Gross salary" value={formatCurrency(state.settings.annualIncome)} />
            <Row label="Less: deductions" value={`− ${formatCurrency(summary.totalDeductions)}`} />
            <Row label="Taxable income" value={formatCurrency(summary.taxableIncome)} bold />
            <div className="hairline mt-4 pt-4" />
            <Row
              label="Tax without deductions"
              value={formatCurrency(summary.taxPayableWithoutDeductions)}
            />
            <Row label="Tax with deductions" value={formatCurrency(summary.taxPayable)} />
            <div className="hairline mt-4 pt-4" />
            <div className="flex items-baseline justify-between">
              <span className="text-sm">Est. tax saved</span>
              <span className="font-serif text-3xl tabular text-gold">
                {formatCurrency(summary.estimatedTaxSaved)}
              </span>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="mb-4 eyebrow">Downloads</div>
        <div className="grid gap-3 md:grid-cols-3">
          {EXPORTS.map((exp) => {
            const Icon = exp.icon;
            return (
              <button
                key={exp.label}
                onClick={exp.handler}
                disabled={exp.disabled}
                className="surface flex items-center justify-between p-4 text-left hover:border-gold/60 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={`Export ${exp.label}`}
              >
                <span className="flex min-w-0 items-center gap-3 text-sm">
                  <Icon className="h-4 w-4 shrink-0 text-gold" />
                  <span className="min-w-0">
                    <span className="block truncate">{exp.label}</span>
                    <span className="block text-[11px] text-muted-foreground">{exp.detail}</span>
                  </span>
                </span>
                <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            );
          })}
        </div>
      </Card>
    </motion.div>
  );
};

export default ReportsPage;
