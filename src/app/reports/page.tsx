"use client";

import { FileSpreadsheet } from "lucide-react";
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

  const handleExportTaxSummary = () => {
    const lines = [
      "TaxLens Tax Summary Report", `Financial Year: FY ${fy}`, `Generated: ${new Date().toLocaleDateString("en-AU")}`, `Occupation: ${state.settings.occupation}`, "",
      "SECTION,ITEM,AMOUNT", `Income,Annual Income,${state.settings.annualIncome}`, "",
      `Deductions,Total Full Claims,${summary.totalFullClaims}`, `Deductions,Total Depreciation Claims,${summary.totalDepreciationClaims}`, `Deductions,Total WFH Deduction,${summary.totalWfhDeduction}`, `Deductions,TOTAL DEDUCTIONS,${summary.totalDeductions}`, "",
      `Tax,Taxable Income,${summary.taxableIncome}`, `Tax,Tax Payable (with deductions),${summary.taxPayable}`, `Tax,Tax Payable (without deductions),${summary.taxPayableWithoutDeductions}`, `Tax,ESTIMATED TAX SAVED,${summary.estimatedTaxSaved}`,
    ];
    downloadCsv(`taxlens-summary-FY${fy}.csv`, lines.join("\n"));
  };

  const handleExportExpenses = () => {
    const header = "Date,Description,Category,Amount,Claim Type,Work Use %,Claimable Amount";
    const rows = state.expenses.map((e) => `${e.date},"${e.description}",${EXPENSE_CATEGORIES[e.category]?.label || e.category},${e.amount},${e.claimType},${e.workUsePercent},${e.claimableAmount}`);
    downloadCsv(`taxlens-expenses-FY${fy}.csv`, [header, ...rows].join("\n"));
  };

  const handleExportWfh = () => {
    const header = "Date,Hours";
    const rows = state.wfhEntries.sort((a, b) => a.date.localeCompare(b.date)).map((e) => `${e.date},${e.hours}`);
    const footer = ["", `Total Hours,${totalHours}`, `Fixed Rate Deduction (${WFH_FIXED_RATE_PER_HOUR * 100}c/hr),${wfhFixedTotal}`, `Actual Cost Deduction,${wfhActualTotal}`, `Active Method,${state.settings.wfhMethod === "fixed_rate" ? "Fixed Rate" : "Actual Cost"}`];
    downloadCsv(`taxlens-wfh-FY${fy}.csv`, [header, ...rows, ...footer].join("\n"));
  };

  const handleExportDepreciation = () => {
    const header = "Asset,Type,Purchase Date,Purchase Price,Effective Life,Method,Work Use %,This Year Deduction,Remaining Value";
    const rows = state.assets.map((a) => {
      const deduction = calculateCurrentYearDepreciation(a, fy);
      const remaining = calculateRemainingValue(a, fy);
      return `"${a.name}",${ASSET_EFFECTIVE_LIVES[a.assetType]?.label || a.assetType},${a.purchaseDate},${a.purchasePrice},${a.effectiveLifeYears},${a.depreciationMethod},${a.workUsePercent},${deduction},${remaining}`;
    });
    downloadCsv(`taxlens-depreciation-FY${fy}.csv`, [header, ...rows].join("\n"));
  };

  const EXPORTS = [
    { label: "Tax summary", detail: "Full overview", handler: handleExportTaxSummary, disabled: false },
    { label: "Expenses", detail: `${state.expenses.length} items`, handler: handleExportExpenses, disabled: state.expenses.length === 0 },
    { label: "WFH log", detail: `${state.wfhEntries.length} days`, handler: handleExportWfh, disabled: state.wfhEntries.length === 0 },
    { label: "Depreciation", detail: `${state.assets.length} assets`, handler: handleExportDepreciation, disabled: state.assets.length === 0 },
  ];

  return (
    <motion.div
      className="mx-auto max-w-3xl space-y-6"
      initial={fadeInUp.initial}
      animate={fadeInUp.animate}
      transition={fadeInUp.transition}
    >
      <div>
        <p className="text-[13px] text-[#868685]">
          FY {fy} summary and CSV exports
        </p>
      </div>

      <div className="rounded-xl border border-[rgba(14,15,12,0.08)] bg-white p-5 dark:border-[rgba(159,232,112,0.08)] dark:bg-[#1a1b18]">
        <p className="text-sm font-medium text-[#0e0f0c] dark:text-[#f4f5f2]">Summary</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Income", value: formatCurrency(state.settings.annualIncome) },
            { label: "Deductions", value: formatCurrency(summary.totalDeductions) },
            { label: "Taxable", value: formatCurrency(summary.taxableIncome) },
            { label: "Tax saved", value: formatCurrency(summary.estimatedTaxSaved), accent: true },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-[11px] text-[#868685]">{item.label}</p>
              <p className={`stat-number mt-0.5 text-lg font-medium ${item.accent ? "text-[#163300] dark:text-[#9fe870]" : "text-[#0e0f0c] dark:text-[#f4f5f2]"}`}>
                {item.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 h-px bg-[rgba(14,15,12,0.06)] dark:bg-[rgba(255,255,255,0.06)]" />

        <div className="mt-4 space-y-2">
          {[
            { label: `Full claims (${state.expenses.filter((e) => e.claimType === "full").length})`, value: summary.totalFullClaims },
            { label: `Depreciation (${state.assets.length})`, value: summary.totalDepreciationClaims },
            { label: `WFH (${state.settings.wfhMethod === "fixed_rate" ? "Fixed" : "Actual"})`, value: summary.totalWfhDeduction },
          ].map((row) => (
            <div key={row.label} className="flex justify-between text-[13px]">
              <span className="text-[#868685]">{row.label}</span>
              <span className="stat-number text-[#0e0f0c] dark:text-[#f4f5f2]">{formatCurrency(row.value)}</span>
            </div>
          ))}
          <div className="h-px bg-[rgba(14,15,12,0.06)] dark:bg-[rgba(255,255,255,0.06)]" />
          <div className="flex justify-between text-[13px] font-medium">
            <span className="text-[#0e0f0c] dark:text-[#f4f5f2]">Total</span>
            <span className="stat-number text-[#0e0f0c] dark:text-[#f4f5f2]">{formatCurrency(summary.totalDeductions)}</span>
          </div>
        </div>

        {breakdown.length > 0 && (
          <>
            <div className="mt-5 h-px bg-[rgba(14,15,12,0.06)] dark:bg-[rgba(255,255,255,0.06)]" />
            <div className="mt-4 space-y-1.5">
              <p className="text-[11px] font-medium text-[#868685]">By category</p>
              {breakdown.map((b) => (
                <div key={b.category} className="flex justify-between text-[13px]">
                  <span className="text-[#868685]">{b.label}</span>
                  <span className="stat-number text-[#0e0f0c] dark:text-[#f4f5f2]">{formatCurrency(b.amount)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="rounded-xl border border-[rgba(14,15,12,0.08)] bg-white p-5 dark:border-[rgba(159,232,112,0.08)] dark:bg-[#1a1b18]">
        <p className="text-sm font-medium text-[#0e0f0c] dark:text-[#f4f5f2]">Export</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {EXPORTS.map((exp) => (
            <motion.button
              key={exp.label}
              onClick={exp.handler}
              disabled={exp.disabled}
              whileHover={exp.disabled ? undefined : { y: -2, boxShadow: "0 4px 16px rgba(14,15,12,0.06)" }}
              whileTap={exp.disabled ? undefined : { scale: 0.97 }}
              className="flex items-center gap-3 rounded-xl border border-[rgba(14,15,12,0.08)] p-3 text-left transition-colors hover:bg-[#f9faf7] disabled:cursor-not-allowed disabled:opacity-40 dark:border-[rgba(159,232,112,0.08)] dark:hover:bg-white/[0.02]"
              aria-label={`Export ${exp.label}`}
              tabIndex={0}
            >
              <FileSpreadsheet className="h-4 w-4 shrink-0 text-[#868685]" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#0e0f0c] dark:text-[#f4f5f2]">{exp.label}</p>
                <p className="text-[10px] text-[#868685]">{exp.detail}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default ReportsPage;
