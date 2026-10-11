"use client";

import { Card } from "@/components/ledgr/primitives";
import { useTax } from "@/context/tax-context";
import { wfhPlanningEstimate } from "@/lib/tax-time";
import { formatCurrency } from "@/lib/tax-calculator";

export const WfhEstimate = () => {
  const { state } = useTax();
  const estimate = wfhPlanningEstimate(state.settings);
  if (!estimate) return null;
  return (
    <Card className="mb-6">
      <h2 className="text-lg font-extrabold text-plum">WFH planning estimate · FY {state.settings.financialYear}</h2>
      <div className="mt-3 flex flex-wrap gap-x-10 gap-y-3 text-plum">
        <div><p className="text-sm">Estimated hours</p><p className="text-2xl font-black tabular">{estimate.hours.toLocaleString("en-AU")} h</p></div>
        <div><p className="text-sm">At 70c/hour</p><p className="text-2xl font-black tabular">{formatCurrency(estimate.deduction)}</p></div>
      </div>
      <p className="mt-3 text-sm text-ink-soft">{estimate.homeDaysPerFortnight} home days per fortnight × {estimate.hoursPerDay} hours/day × {estimate.weeks} weeks. Before leave, public holidays, schedule changes and FY boundary adjustments.</p>
      <p className="mt-2 text-sm font-semibold text-plum">Based on your usual pattern; no timesheet. This estimate is excluded from saved claims and tax exports.</p>
    </Card>
  );
};
