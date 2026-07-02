"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTax } from "@/context/tax-context";
import { formatCurrency, getMonthlyDeductionTotals } from "@/lib/tax-calculator";
import { cardHover } from "@/lib/animations";

export const DeductionPace = () => {
  const { state, summary } = useTax();
  const prefersReduced = useReducedMotion();

  const months = getMonthlyDeductionTotals(
    state.expenses,
    state.assets,
    state.wfhEntries,
    state.settings.wfhMethod,
    state.settings.financialYear
  );

  const marginalRatio =
    summary.totalDeductions > 0
      ? summary.estimatedTaxSaved / summary.totalDeductions
      : 0;

  // cut the series at the current month so future months don't flatline
  const nowKey = new Date().toISOString().slice(0, 7);
  const lastIndex = months.findIndex((m) => m.key === nowKey);
  const elapsed = lastIndex === -1 ? months : months.slice(0, lastIndex + 1);

  let running = 0;
  const data = elapsed.map((m) => {
    running += m.amount;
    return {
      month: m.month,
      deductions: Math.round(running),
      taxSaved: Math.round(running * marginalRatio),
    };
  });

  const total = running;
  if (total === 0) return null;

  const monthlyAvg = total / data.length;
  const projected = monthlyAvg * 12;
  const best = elapsed.reduce((a, b) => (b.amount > a.amount ? b : a));

  return (
    <motion.div
      className="rounded-xl border border-border bg-card p-5 dark:border-border dark:bg-card"
      {...(prefersReduced ? {} : cardHover)}
    >
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-foreground dark:text-foreground">
          Deduction pace
        </p>
        <p className="text-[11px] text-muted-foreground">
          Cumulative · FY {state.settings.financialYear}
        </p>
      </div>

      <div className="mt-4 h-52">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="pace-deductions" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide domain={[0, "auto"]} />
            <Tooltip
              formatter={(value, name) => [
                formatCurrency(Number(value) || 0),
                name === "deductions" ? "Deductions" : "Est. tax saved",
              ]}
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--muted-foreground)" }}
            />
            <Area
              type="monotone"
              dataKey="deductions"
              stroke="var(--primary)"
              strokeWidth={2}
              fill="url(#pace-deductions)"
              isAnimationActive={!prefersReduced}
            />
            {marginalRatio > 0 && (
              <Area
                type="monotone"
                dataKey="taxSaved"
                stroke="var(--muted-foreground)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                fill="none"
                isAnimationActive={!prefersReduced}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4 border-t border-border pt-4 dark:border-[rgba(255,255,255,0.06)]">
        {[
          ["Monthly average", formatCurrency(monthlyAvg)],
          ["Best month", `${best.month} · ${formatCurrency(best.amount)}`],
          ["On pace for 30 Jun", formatCurrency(projected)],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-[11px] text-muted-foreground">{label}</p>
            <p className="stat-number mt-0.5 truncate text-sm font-medium text-foreground dark:text-foreground">
              {value}
            </p>
          </div>
        ))}
      </div>
    </motion.div>
  );
};
