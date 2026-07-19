"use client";

import { motion } from "motion/react";
import { Section, Kpi, Card } from "@/components/ledgr/primitives";
import { WfhCalendar } from "@/components/wfh/wfh-calendar";
import { WfhCalculator } from "@/components/wfh/wfh-calculator";
import { useTax } from "@/context/tax-context";
import {
  formatCurrency,
  calculateWfhDeductionFixedRate,
  calculateWfhDeductionActualCost,
} from "@/lib/tax-calculator";
import { WFH_FIXED_RATE_PER_HOUR } from "@/lib/constants";
import { fadeInUp } from "@/lib/animations";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKS = 12;

// Monday of the week `offset` weeks before this week
const mondayOf = (offset: number) => {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - day - offset * 7);
  d.setHours(0, 0, 0, 0);
  return d;
};

const HourLogHeatmap = ({ hoursByDate }: { hoursByDate: Map<string, number> }) => {
  const weeks = Array.from({ length: WEEKS }).map((_, i) => {
    const monday = mondayOf(WEEKS - 1 - i);
    return DAYS.map((_, di) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + di);
      const key = d.toISOString().slice(0, 10);
      return { key, label: d.toLocaleDateString("en-AU", { day: "2-digit", month: "short" }), hours: hoursByDate.get(key) ?? 0 };
    });
  });

  return (
    <Card>
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <div className="eyebrow">Hour log</div>
          <div className="mt-1 font-serif text-2xl">Last 12 weeks</div>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          0 h
          {[0.2, 0.4, 0.6, 0.8, 1].map((o) => (
            <span
              key={o}
              className="h-3 w-3 rounded-sm"
              style={{
                background: `color-mix(in oklab, var(--color-gold) ${o * 100}%, transparent)`,
              }}
            />
          ))}
          8 h+
        </div>
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-3">
        <div className="grid grid-rows-7 gap-1 text-[10px] text-muted-foreground">
          {DAYS.map((d) => (
            <div key={d} className="flex h-4 items-center">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-flow-col grid-rows-7 gap-1">
          {weeks.flatMap((week, wi) =>
            week.map((cell, di) => (
              <div
                key={`${wi}-${di}`}
                className="h-4 w-full rounded-sm"
                style={{
                  background:
                    cell.hours === 0
                      ? "var(--color-surface-2)"
                      : `color-mix(in oklab, var(--color-gold) ${Math.min(cell.hours / 8, 1) * 100}%, transparent)`,
                }}
                title={`${cell.label} · ${cell.hours}h`}
              />
            ))
          )}
        </div>
      </div>
    </Card>
  );
};

const WfhPage = () => {
  const { state } = useTax();

  if (!state.loaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      </div>
    );
  }

  const totalHours = state.wfhEntries.reduce((s, e) => s + e.hours, 0);
  const fixedRate = calculateWfhDeductionFixedRate(state.wfhEntries);
  const actualCost = calculateWfhDeductionActualCost(state.wfhActualCosts);
  const fixedWins = fixedRate >= actualCost;

  const hoursByDate = new Map<string, number>();
  for (const e of state.wfhEntries) {
    hoursByDate.set(e.date, (hoursByDate.get(e.date) ?? 0) + e.hours);
  }

  return (
    <motion.div
      initial={fadeInUp.initial}
      animate={fadeInUp.animate}
      transition={fadeInUp.transition}
    >
      <Section eyebrow="WFH · 70c method" title="Home office, hour by hour." />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi
          label="Hours YTD"
          value={`${totalHours.toLocaleString()} h`}
          hint={`FY ${state.settings.financialYear}`}
          large
        />
        <Kpi
          label="Fixed-rate claim"
          value={formatCurrency(fixedRate)}
          hint={`70c × ${totalHours.toLocaleString()} h`}
          positive={fixedWins && fixedRate > 0}
        />
        <Kpi
          label="Actual-cost est."
          value={formatCurrency(actualCost)}
          hint={fixedRate === 0 && actualCost === 0 ? "nothing logged" : fixedWins ? "fixed rate wins" : "actual cost wins"}
          positive={!fixedWins && actualCost > 0}
        />
        <Kpi
          label="Days logged"
          value={`${state.wfhEntries.length}`}
          hint={`$${WFH_FIXED_RATE_PER_HOUR.toFixed(2)}/hr rate`}
        />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <WfhCalendar />
        <WfhCalculator />
      </div>

      <HourLogHeatmap hoursByDate={hoursByDate} />
    </motion.div>
  );
};

export default WfhPage;
