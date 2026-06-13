"use client";

import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { Plus, Trash2, Info } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTax } from "@/context/tax-context";
import {
  calculateWfhDeductionFixedRate,
  calculateWfhDeductionActualCost,
  formatCurrency,
} from "@/lib/tax-calculator";
import { WFH_FIXED_RATE_PER_HOUR } from "@/lib/constants";
import type { WfhActualCost } from "@/lib/types";

const DEFAULT_ACTUAL_CATEGORIES = [
  "Electricity",
  "Internet",
  "Mobile Phone",
  "Office Cleaning",
  "Stationery",
];

export const WfhCalculator = () => {
  const {
    state,
    addWfhActualCost,
    updateWfhActualCost,
    removeWfhActualCost,
    updateSettings,
  } = useTax();
  const prefersReduced = useReducedMotion();
  const [newCategory, setNewCategory] = useState("");
  const [newCost, setNewCost] = useState("");
  const [newPercent, setNewPercent] = useState("30");

  const totalHours = state.wfhEntries.reduce((sum, e) => sum + e.hours, 0);
  const fixedRateDeduction = calculateWfhDeductionFixedRate(state.wfhEntries);
  const actualCostDeduction = calculateWfhDeductionActualCost(
    state.wfhActualCosts
  );

  const activeMethod = state.settings.wfhMethod;
  const fixedIsBetter = fixedRateDeduction >= actualCostDeduction;

  const handleAddCost = async () => {
    if (!newCategory.trim() || !newCost) return;
    const cost: WfhActualCost = {
      id: uuidv4(),
      category: newCategory.trim(),
      annualCost: parseFloat(newCost),
      workUsePercent: parseFloat(newPercent) || 30,
      financialYear: state.settings.financialYear,
    };
    await addWfhActualCost(cost);
    setNewCategory("");
    setNewCost("");
    setNewPercent("30");
  };

  const handleMethodToggle = async (method: "fixed_rate" | "actual_cost") => {
    await updateSettings({ ...state.settings, wfhMethod: method });
  };

  const methods = [
    {
      key: "fixed_rate" as const,
      label: "Fixed rate",
      value: fixedRateDeduction,
      detail: `${totalHours.toFixed(1)}hrs × $${WFH_FIXED_RATE_PER_HOUR.toFixed(2)}`,
      recommended: fixedIsBetter,
    },
    {
      key: "actual_cost" as const,
      label: "Actual cost",
      value: actualCostDeduction,
      detail: `${state.wfhActualCosts.length} cost items`,
      recommended: !fixedIsBetter,
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Method comparison</CardTitle>
            <Tooltip>
              <TooltipTrigger className="cursor-help">
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>
                  Fixed rate: {WFH_FIXED_RATE_PER_HOUR * 100}c/hour covers
                  electricity, phone, internet, stationery. Actual cost: claim
                  the real work-use portion of each expense.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl bg-secondary p-1 dark:bg-white/5">
            <div className="relative grid grid-cols-2 gap-1">
              {methods.map((m) => (
                <button
                  key={m.key}
                  onClick={() => handleMethodToggle(m.key)}
                  className="relative z-10 rounded-lg px-3 py-3 text-left transition-colors"
                  aria-label={`Select ${m.label} method`}
                  tabIndex={0}
                >
                  {activeMethod === m.key && (
                    <motion.div
                      layoutId="wfh-method-active"
                      className="absolute inset-0 rounded-lg bg-card shadow-sm dark:bg-card"
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 30,
                      }}
                    />
                  )}
                  <div className="relative z-10">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground dark:text-foreground">
                        {m.label}
                      </span>
                      {m.recommended && (
                        <Badge
                          variant="secondary"
                          className="rounded-full bg-mint text-[10px] font-medium text-foreground"
                        >
                          Better
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xl font-semibold text-foreground dark:text-foreground">
                      {formatCurrency(m.value)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {m.detail}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actual costs</CardTitle>
          <p className="text-xs text-muted-foreground">
            Enter annual costs and work-use percentage for each item
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {state.wfhActualCosts.map((cost) => (
            <div
              key={cost.id}
              className="flex items-center gap-2 rounded-xl border border-border p-3 dark:border-border"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground dark:text-foreground">
                  {cost.category}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(cost.annualCost)}/yr × {cost.workUsePercent}%
                  ={" "}
                  <span className="font-medium text-ink-soft dark:text-muted-foreground">
                    {formatCurrency(
                      (cost.annualCost * cost.workUsePercent) / 100
                    )}
                  </span>
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                onClick={async () => await removeWfhActualCost(cost.id)}
                aria-label={`Remove ${cost.category}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}

          <div className="rounded-xl border border-dashed border-border p-3 dark:border-[rgba(255,255,255,0.08)]">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Add cost item
            </p>
            <div className="grid gap-2 sm:grid-cols-4">
              <div className="sm:col-span-1">
                <Label htmlFor="cost-category" className="sr-only">
                  Category
                </Label>
                <Input
                  id="cost-category"
                  placeholder="Category"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  list="cost-categories"
                  className="text-sm"
                />
                <datalist id="cost-categories">
                  {DEFAULT_ACTUAL_CATEGORIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div>
                <Label htmlFor="cost-annual" className="sr-only">
                  Annual cost
                </Label>
                <Input
                  id="cost-annual"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Annual $"
                  value={newCost}
                  onChange={(e) => setNewCost(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <Label htmlFor="cost-percent" className="sr-only">
                  Work use %
                </Label>
                <Input
                  id="cost-percent"
                  type="number"
                  min="1"
                  max="100"
                  placeholder="Work %"
                  value={newPercent}
                  onChange={(e) => setNewPercent(e.target.value)}
                  className="text-sm"
                />
              </div>
              <Button
                size="sm"
                onClick={handleAddCost}
                disabled={!newCategory.trim() || !newCost}
                className="w-full"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
