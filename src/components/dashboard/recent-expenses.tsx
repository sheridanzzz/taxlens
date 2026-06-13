"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, TrendingDown, ScanLine } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { useTax } from "@/context/tax-context";
import { formatCurrency } from "@/lib/tax-calculator";
import { calculateCurrentYearDepreciation } from "@/lib/depreciation";
import { EXPENSE_CATEGORIES, ASSET_EFFECTIVE_LIVES } from "@/lib/constants";
import { cardHover, staggerContainer, staggerItem } from "@/lib/animations";

interface RecentItem {
  id: string;
  name: string;
  date: string;
  amount: number;
  claimable: number;
  badge: string;
  category: string;
  type: "full" | "depreciation";
  href: string;
  source: "scanned" | "manual";
}

const CATEGORY_COLORS: Record<string, string> = {
  office_equipment: "#e2f6d5",
  software: "#E6F1FB",
  phone_internet: "#FAEEDA",
  education: "#e2f6d5",
  travel: "#FAEEDA",
  clothing: "#E6F1FB",
  union_fees: "#f4f5f2",
  other: "#f4f5f2",
};

const isExpenseScanned = (notes?: string, receiptDataUrl?: string): boolean =>
  !!(receiptDataUrl || (notes && notes.toLowerCase().includes("ai scan")));

export const RecentExpenses = () => {
  const { state } = useTax();
  const fy = state.settings.financialYear;
  const prefersReduced = useReducedMotion();

  const recentItems = useMemo<RecentItem[]>(() => {
    const expenses: RecentItem[] = state.expenses.map((e) => ({
      id: e.id,
      name: e.description,
      date: e.date,
      amount: e.amount,
      claimable: e.claimableAmount,
      badge:
        EXPENSE_CATEGORIES[e.category]?.label
          .split(" ")
          .slice(0, 2)
          .join(" ") ?? e.category,
      category: e.category,
      type: "full",
      href: "/expenses",
      source: isExpenseScanned(e.notes, e.receiptDataUrl)
        ? "scanned"
        : "manual",
    }));

    const assets: RecentItem[] = state.assets.map((a) => ({
      id: a.id,
      name: a.name,
      date: a.purchaseDate,
      amount: a.purchasePrice,
      claimable: calculateCurrentYearDepreciation(a, fy),
      badge:
        ASSET_EFFECTIVE_LIVES[a.assetType]?.label
          .split(" ")
          .slice(0, 2)
          .join(" ") ?? a.assetType,
      category: "asset",
      type: "depreciation",
      href: "/assets",
      source: "manual",
    }));

    return [...expenses, ...assets]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [state.expenses, state.assets, fy]);

  const hasItems = recentItems.length > 0;

  return (
    <motion.div
      className="rounded-xl border border-[rgba(14,15,12,0.08)] bg-white dark:border-[rgba(159,232,112,0.08)] dark:bg-[#1a1b18]"
      {...(prefersReduced ? {} : cardHover)}
    >
      <div className="flex items-center justify-between px-5 py-4">
        <p className="text-sm font-medium text-[#0e0f0c] dark:text-[#f4f5f2]">
          Recent activity
        </p>
        <Link
          href="/expenses"
          className="inline-flex items-center gap-1 text-xs font-medium text-[#868685] transition-colors hover:text-[#454745] dark:hover:text-[#a3a5a0]"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {!hasItems ? (
        <div className="px-5 py-8 text-center">
          <motion.div
            animate={
              prefersReduced
                ? undefined
                : { scale: [1, 1.05, 1] }
            }
            transition={{
              repeat: Infinity,
              duration: 3,
              ease: "easeInOut",
            }}
            className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#f4f5f2] dark:bg-white/5"
          >
            <ArrowRight className="h-4 w-4 text-[#868685]" />
          </motion.div>
          <p className="text-[13px] text-[#868685]">
            No expenses yet — add one or scan a receipt
          </p>
        </div>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial={prefersReduced ? false : "initial"}
          animate="animate"
        >
          {recentItems.map((item) => (
            <motion.div key={item.id} variants={staggerItem}>
              <Link
                href={item.href}
                className="flex items-center gap-4 border-t border-[rgba(14,15,12,0.06)] px-5 py-3 transition-colors last:rounded-b-xl hover:bg-[#f9faf7] dark:border-[rgba(255,255,255,0.04)] dark:hover:bg-white/[0.02]"
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor:
                      CATEGORY_COLORS[item.category] ?? "#f4f5f2",
                  }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-[#0e0f0c] dark:text-[#f4f5f2]">
                    {item.name}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[#868685]">
                    <span>{item.badge}</span>
                    <span>·</span>
                    <span>
                      {new Date(item.date).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="stat-number text-[13px] font-medium text-[#0e0f0c] dark:text-[#f4f5f2]">
                    {formatCurrency(item.claimable)}
                  </p>
                  <div className="mt-0.5 flex items-center justify-end gap-1.5">
                    {item.type === "full" ? (
                      item.source === "scanned" ? (
                        <Badge className="h-5 gap-1 rounded-full border-0 bg-[#EAF3DE] px-2 text-[10px] font-medium text-[#3B6D11]">
                          <ScanLine className="h-2.5 w-2.5" />
                          Scanned
                        </Badge>
                      ) : (
                        <Badge className="h-5 rounded-full border-0 bg-[#FAEEDA] px-2 text-[10px] font-medium text-[#854F0B]">
                          Manual
                        </Badge>
                      )
                    ) : (
                      <Badge className="h-5 gap-1 rounded-full border-0 bg-[#f4f5f2] px-2 text-[10px] font-medium text-[#868685] dark:bg-white/5">
                        <TrendingDown className="h-2.5 w-2.5" />
                        Asset
                      </Badge>
                    )}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
};
