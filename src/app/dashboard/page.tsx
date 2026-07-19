"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowUpRight, ScanLine, Sparkles } from "lucide-react";
import { Section, Kpi, Card, Pill } from "@/components/ledgr/primitives";
import { Onboarding } from "@/components/onboarding";
import { GettingStarted } from "@/components/dashboard/getting-started";
import { useTax } from "@/context/tax-context";
import {
  formatCurrency,
  getCategoryBreakdown,
  getMonthlyDeductionTotals,
} from "@/lib/tax-calculator";
import { fadeInUp } from "@/lib/animations";
import { isAiScanned } from "@/lib/utils";

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
} as const;

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning.";
  if (h < 18) return "Good afternoon.";
  return "Good evening.";
};

const DashboardPage = () => {
  const { state, summary } = useTax();

  if (!state.loaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      </div>
    );
  }

  const fy = state.settings.financialYear;
  const breakdown = getCategoryBreakdown(state.expenses, state.assets, fy);
  const months = getMonthlyDeductionTotals(
    state.expenses,
    state.assets,
    state.wfhEntries,
    state.settings.wfhMethod,
    fy
  );

  // cumulative deduction series up to the current month
  const marginalRatio =
    summary.totalDeductions > 0
      ? summary.estimatedTaxSaved / summary.totalDeductions
      : 0;
  const nowKey = new Date().toISOString().slice(0, 7);
  const lastIndex = months.findIndex((m) => m.key === nowKey);
  const elapsed = lastIndex === -1 ? months : months.slice(0, lastIndex + 1);
  const trend = elapsed.reduce<{ m: string; v: number }[]>((acc, m) => {
    const prev = acc.length ? acc[acc.length - 1].v : 0;
    acc.push({ m: m.month, v: Math.round(prev + m.amount) });
    return acc;
  }, []);

  const wfhHours = state.wfhEntries.reduce((s, e) => s + e.hours, 0);
  const scannedCount = state.expenses.filter(isAiScanned).length;
  const effectiveRate =
    state.settings.annualIncome > 0
      ? (summary.taxPayable / state.settings.annualIncome) * 100
      : 0;

  const recent = [...state.expenses]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);

  const donut = breakdown.map((b, i) => ({
    name: b.label,
    value: Math.round(b.amount),
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <motion.div
      initial={fadeInUp.initial}
      animate={fadeInUp.animate}
      transition={fadeInUp.transition}
    >
      <Onboarding />

      <Section
        eyebrow={`FY ${fy} · live`}
        title={greeting()}
        action={
          <div className="hidden items-center gap-2 md:flex">
            {scannedCount > 0 && (
              <Pill tone="gold">
                <Sparkles className="h-3 w-3" /> {scannedCount} receipt
                {scannedCount === 1 ? "" : "s"} AI-scanned
              </Pill>
            )}
            <Link
              href="/expenses?scan=1"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-4 text-sm text-muted-foreground hover:text-foreground"
            >
              <ScanLine className="h-4 w-4 text-gold" /> Scan receipt
            </Link>
            <Link
              href="/reports"
              className="inline-flex h-9 items-center gap-2 rounded-md bg-gold px-4 text-sm text-primary-foreground hover:opacity-90"
            >
              Export myTax <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        }
      />

      <div className="mb-8">
        <GettingStarted />
      </div>

      {/* KPI row */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi
          label="Est. tax saved"
          value={formatCurrency(summary.estimatedTaxSaved)}
          hint="from deductions"
          positive
          large
        />
        <Kpi
          label="Total deductions"
          value={formatCurrency(summary.totalDeductions)}
          hint={`${state.expenses.length} expense${state.expenses.length === 1 ? "" : "s"}`}
        />
        <Kpi
          label="WFH hours"
          value={`${wfhHours.toLocaleString()} h`}
          hint="70c fixed rate"
        />
        <Kpi
          label="Effective rate"
          value={`${effectiveRate.toFixed(1)}%`}
          hint={`on ${formatCurrency(state.settings.annualIncome)}`}
        />
      </div>

      {/* Deduction trend + category donut */}
      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-6">
            <div className="eyebrow">Deductions over FY</div>
            <div className="mt-1 font-serif text-2xl">
              {trend.length > 0 && summary.totalDeductions > 0
                ? "Building month over month"
                : "Nothing logged yet"}
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-gold)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-gold)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis
                  dataKey="m"
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => [formatCurrency(Number(v) || 0), "Deductions"]}
                />
                <Area
                  dataKey="v"
                  stroke="var(--color-gold)"
                  strokeWidth={2}
                  fill="url(#g1)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <div className="eyebrow">Deductions by category</div>
          <div className="mb-4 mt-1 font-serif text-2xl tabular">
            {formatCurrency(summary.totalDeductions)}
          </div>
          {donut.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              <Link href="/expenses?add=1" className="text-foreground underline underline-offset-2">
                Add expenses
              </Link>{" "}
              to see categories
            </p>
          ) : (
            <>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donut}
                      innerRadius={45}
                      outerRadius={70}
                      dataKey="value"
                      stroke="none"
                      paddingAngle={2}
                    >
                      {donut.map((c, i) => (
                        <Cell key={i} fill={c.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-4 space-y-2 text-xs">
                {donut.map((c) => (
                  <li key={c.name} className="flex items-center justify-between">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: c.color }}
                      />
                      <span className="truncate">{c.name}</span>
                    </span>
                    <span className="font-mono tabular text-muted-foreground">
                      ${c.value.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      {/* Monthly bars + recent expenses */}
      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="eyebrow">Monthly deductions</div>
          <div className="mb-4 mt-1 font-serif text-2xl">Where the year went</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months.map((m) => ({ m: m.month, d: Math.round(m.amount) }))}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis
                  dataKey="m"
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "var(--color-surface-2)" }}
                  formatter={(v) => [formatCurrency(Number(v) || 0), "Deductions"]}
                />
                <Bar dataKey="d" fill="var(--color-gold)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <div className="mb-4">
            <div className="eyebrow">Recent activity</div>
            <div className="mt-1 font-serif text-2xl">
              Last {recent.length || "0"} item{recent.length === 1 ? "" : "s"}
            </div>
          </div>
          {recent.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              Expenses you add will show up here.
            </p>
          ) : (
            <ul className="space-y-3">
              {recent.map((e) => (
                <li
                  key={e.id}
                  className="grid grid-cols-[1fr_auto] gap-2 border-b border-border pb-3 last:border-0"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm">{e.description}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(e.date).toLocaleDateString("en-AU", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono tabular text-sm">
                      ${e.amount.toFixed(2)}
                    </div>
                    <div
                      className={`text-[10px] ${
                        e.claimType === "full" ? "text-positive" : "text-muted-foreground"
                      }`}
                    >
                      {e.claimType === "full"
                        ? e.workUsePercent < 100
                          ? `Apportioned ${e.workUsePercent}%`
                          : "Deductible"
                        : "Depreciate"}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* pace footnote — kept from the old dashboard, engineers liked the projection */}
      {trend.length > 0 && summary.totalDeductions > 0 && (
        <Card>
          <div className="grid grid-cols-3 gap-4">
            {[
              ["Monthly average", formatCurrency(summary.totalDeductions / trend.length)],
              [
                "Best month",
                (() => {
                  const best = elapsed.reduce((a, b) => (b.amount > a.amount ? b : a));
                  return `${best.month} · ${formatCurrency(best.amount)}`;
                })(),
              ],
              [
                "On pace for 30 Jun",
                formatCurrency((summary.totalDeductions / trend.length) * 12),
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="eyebrow">{label}</div>
                <div className="mt-1 truncate font-serif text-xl tabular">{value}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </motion.div>
  );
};

export default DashboardPage;
