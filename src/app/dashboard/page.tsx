"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowUpRight,
  Clock3,
  Package,
  Receipt,
} from "lucide-react";
import { Onboarding } from "@/components/onboarding";
import { GettingStarted } from "@/components/dashboard/getting-started";
import { ReceiptReview } from "@/components/dashboard/receipt-review";
import { useAuth } from "@/context/auth-context";
import { useTax } from "@/context/tax-context";
import { formatCurrency, getCategoryBreakdown, isCoveredByFixedRate } from "@/lib/tax-calculator";
import { getMyTaxRows } from "@/lib/mytax";
import { WFH_FIXED_RATE_PER_HOUR } from "@/lib/constants";
import { fadeInUp } from "@/lib/animations";
import { expenseReviewStatus } from "@/lib/receipt-review";
import type { Expense, WfhMethod } from "@/lib/types";

const DAY = 86_400_000;
const TINTS = ["bg-butter", "bg-mint", "bg-pink", "bg-sky", "bg-lav"];

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Morning";
  if (h < 17) return "Arvo";
  return "Evening";
};

const claimNote = (e: Expense, wfhMethod: WfhMethod) =>
  expenseReviewStatus(e) === "pending" ? "Pending review" : isCoveredByFixedRate(e, wfhMethod)
    ? "Covered by the 70c rate"
    : e.workUsePercent === 0
    ? "Personal · no deduction"
    : e.claimType === "depreciation"
    ? "Over $300, so it’s depreciated"
    : e.workUsePercent < 100
      ? `${e.workUsePercent}% work use`
      : "Claimed in full";

const shortDate = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short" });

const Jar = ({ fill }: { fill: number }) => {
  // the pot fills as the financial year goes on
  const top = 114 - Math.round(56 * Math.min(1, Math.max(0.15, fill)));
  return (
    <svg width="96" height="116" viewBox="0 0 100 120" aria-hidden="true" className="hidden shrink-0 sm:block">
      <rect x="26" y="4" width="48" height="12" rx="4" fill="var(--color-gold)" />
      <path
        d="M18 22h64a8 8 0 0 1 8 8v74a12 12 0 0 1-12 12H22a12 12 0 0 1-12-12V30a8 8 0 0 1 8-8z"
        fill="rgb(255 255 255 / 0.12)"
        stroke="#fff"
        strokeWidth="3"
      />
      <path
        d={`M12 ${top}h76v${104 - top}a10 10 0 0 1-10 10H22a10 10 0 0 1-10-10z`}
        fill="var(--color-butter)"
      />
      <circle cx="34" cy="100" r="6" fill="#f2b63c" />
      <circle cx="60" cy="94" r="6" fill="#f2b63c" />
    </svg>
  );
};

const WeekCard = ({
  href,
  tint,
  icon: Icon,
  title,
  detail,
}: {
  href: string;
  tint: string;
  icon: typeof Receipt;
  title: string;
  detail: string;
}) => (
  <Link
    href={href}
    className={`group flex items-center gap-4 rounded-[24px] p-5 transition-transform hover:-translate-y-0.5 ${tint}`}
  >
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white">
      <Icon className="h-[22px] w-[22px] text-plum" strokeWidth={2} />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-lg font-extrabold leading-tight text-plum">{title}</span>
      <span className="mt-0.5 block text-sm font-medium text-plum/80">{detail}</span>
    </span>
    <ArrowUpRight className="h-5 w-5 shrink-0 text-plum/60 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
  </Link>
);

const DashboardPage = () => {
  const { state, summary } = useTax();
  const { user } = useAuth();
  const [now] = useState(() => Date.now());

  if (!state.loaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      </div>
    );
  }

  const fy = state.settings.financialYear;
  const startYear = parseInt(fy.slice(0, 4), 10);
  const fyStart = new Date(startYear, 6, 1).getTime();
  const fyEnd = new Date(startYear + 1, 5, 30, 23, 59).getTime();
  const lodgeBy = new Date(startYear + 1, 9, 31, 23, 59).getTime();
  const yearDone = (now - fyStart) / (fyEnd - fyStart);
  const status =
    now < fyStart
      ? "Hasn’t started yet"
      : now <= fyEnd
        ? `${Math.max(1, Math.ceil((fyEnd - now) / (30 * DAY)))} months to go`
        : now <= lodgeBy
          ? `Lodge by 31 Oct ${startYear + 1} · ${Math.ceil((lodgeBy - now) / DAY)} days left`
          : "All wrapped up";

  const weekAgo = now - 7 * DAY;
  const weekHours = state.wfhEntries
    .filter((e) => new Date(e.date).getTime() >= weekAgo)
    .reduce((s, e) => s + e.hours, 0);
  const weekClaimed =
    state.expenses
      .filter(
        (e) =>
          new Date(e.createdAt).getTime() >= weekAgo &&
          !isCoveredByFixedRate(e, state.settings.wfhMethod)
      )
      .reduce((s, e) => s + e.claimableAmount, 0) +
    (state.settings.wfhMethod === "fixed_rate" ? weekHours * WFH_FIXED_RATE_PER_HOUR : 0);

  const missingReceipts = state.expenses.filter((e) => e.workUsePercent > 0 && !e.receiptDataUrl && !e.hasReceipt).length;
  const returnRows = getMyTaxRows(
    getCategoryBreakdown(state.expenses, state.settings.wfhMethod, state.assets, fy),
    summary.totalWfhDeduction
  ).map((r) => ({
    code: r.item.match(/\((D\d+)\)/)?.[1] ?? "",
    name: r.item.replace(/ \(D\d+\)$/, ""),
    amount: r.amount,
  }));
  if (summary.rentalDeductions > 0) {
    returnRows.push({ code: "I21", name: "Rental property", amount: summary.rentalDeductions });
  }

  const recent = [...state.expenses]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);

  return (
    <motion.div
      initial={fadeInUp.initial}
      animate={fadeInUp.animate}
      transition={fadeInUp.transition}
      className="w-full"
    >
      <Onboarding />

      {/* scan / add live in the header and sidebar, so the page opens on the pot */}
      <div className="mb-6">
        <div>
          <h1 className="font-serif text-4xl font-black text-plum md:text-5xl">{greeting()}!</h1>
          <p className="mt-1 text-[15px] font-semibold text-muted-foreground">
            FY {fy} · {status}
          </p>
        </div>
      </div>

      <div className="mb-6">
        <GettingStarted />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* the refund pot */}
        <section className="flex flex-col justify-between gap-6 rounded-[32px] min-w-0 bg-plum p-6 text-white sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[15px] font-bold text-butter">Estimated tax savings · FY {fy}</div>
              <div className="mt-2 truncate font-serif text-5xl font-black tabular sm:text-6xl md:text-7xl">
                {formatCurrency(summary.estimatedTaxSaved)}
              </div>
              <p className="mt-2 max-w-sm text-[15px] font-medium text-lav">
                Tax your deductions save you
                {state.settings.annualIncome > 0
                  ? ` on a ${formatCurrency(state.settings.annualIncome)} salary.`
                  : ". Add your salary in Settings for a sharper number."}
              </p>
              <p className="mt-3 max-w-sm text-xs leading-relaxed text-lav/80">
                Your final refund also depends on tax withheld and other income.
              </p>
            </div>
            <Jar fill={yearDone} />
          </div>
          {/* how far through the financial year the pot has had to fill */}
          <div>
            <div className="flex justify-between text-xs font-bold text-lav">
              <span>1 Jul {startYear}</span>
              <span>{Math.round(Math.min(1, Math.max(0, yearDone)) * 100)}% of the year gone</span>
              <span>30 Jun {startYear + 1}</span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-plum-2">
              <div
                className="h-full rounded-full bg-butter"
                style={{ width: `${Math.min(1, Math.max(0, yearDone)) * 100}%` }}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {weekClaimed > 0 && (
              <span className="rounded-full bg-mint px-3 py-1 text-sm font-extrabold text-plum">
                +{formatCurrency(weekClaimed)} claimed this week
              </span>
            )}
            <span className="rounded-full bg-plum-2 px-3 py-1 text-sm font-bold text-lav">
              {formatCurrency(summary.totalDeductions)} in deductions
            </span>
            <span className="rounded-full bg-plum-2 px-3 py-1 text-sm font-bold text-lav">
              Taxable income {formatCurrency(summary.taxableIncome)}
            </span>
          </div>
        </section>

        <ReceiptReview key={`${user?.id ?? "local"}:${fy}`} accountId={user?.id ?? "local"} />
      </div>

      {/* this week, at a glance */}
      <h2 className="mb-3 text-xl font-extrabold text-plum">This week</h2>
      <div className="mb-8 grid grid-cols-1 gap-3 md:grid-cols-3">
        <WeekCard
          href="/expenses"
          tint="bg-butter"
          icon={Receipt}
          title={missingReceipts > 0 ? `${missingReceipts} receipt${missingReceipts === 1 ? "" : "s"} missing` : "Every receipt attached"}
          detail={missingReceipts > 0 ? "Attach them before you lodge" : "Nice — nothing to chase"}
        />
        <WeekCard
          href="/wfh"
          tint="bg-mint"
          icon={Clock3}
          title={weekHours > 0 ? `${weekHours.toLocaleString()} h at home` : "No hours logged"}
          detail={
            weekHours > 0
              ? `${formatCurrency(weekHours * WFH_FIXED_RATE_PER_HOUR)} at 70c an hour`
              : "Worked from home? Log it while you remember"
          }
        />
        <WeekCard
          href="/assets"
          tint="bg-pink"
          icon={Package}
          title={
            state.assets.length > 0
              ? `${state.assets.length} asset${state.assets.length === 1 ? "" : "s"} depreciating`
              : "No assets yet"
          }
          detail={
            state.assets.length > 0
              ? `${formatCurrency(summary.totalDepreciationClaims)} claimed this year`
              : "Laptop over $300? Add it here"
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.2fr_1fr]">
        {/* the return, in the order myTax asks for it */}
        <section className="surface p-6">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="text-xl font-extrabold text-plum">Your return</h2>
            <Link href="/reports" className="text-sm font-bold text-gold hover:underline">
              Export for myTax
            </Link>
          </div>
          {returnRows.length === 0 ? (
            <p className="text-[15px] text-muted-foreground">
              Nothing claimed yet. Scan a receipt or log some hours and it’ll show up here, sorted
              into the labels myTax uses.
            </p>
          ) : (
            <ul>
              {returnRows.map((r) => (
                <li key={r.name} className="flex items-center gap-3 border-t border-border py-3 first:border-0">
                  <span className="grid h-7 min-w-11 place-items-center rounded-lg bg-lav px-2 text-xs font-extrabold text-plum">
                    {r.code}
                  </span>
                  <span className="min-w-0 flex-1 text-[15px] font-semibold leading-snug">{r.name}</span>
                  <span className="font-mono text-[15px] font-bold">{formatCurrency(r.amount)}</span>
                </li>
              ))}
              <li className="flex items-center justify-between border-t-2 border-plum pt-3">
                <span className="text-[15px] font-extrabold">Total</span>
                <span className="font-mono text-lg font-black">
                  {formatCurrency(returnRows.reduce((s, r) => s + r.amount, 0))}
                </span>
              </li>
            </ul>
          )}
        </section>

        <section className="surface p-6">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="text-xl font-extrabold text-plum">Recent</h2>
            <Link href="/expenses" className="text-sm font-bold text-gold hover:underline">
              See all
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-[15px] text-muted-foreground">Expenses you add will land here.</p>
          ) : (
            <ul className="space-y-2">
              {recent.map((e, i) => (
                <li key={e.id} className="flex items-center gap-3 rounded-2xl p-2 hover:bg-surface-2">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${TINTS[i % TINTS.length]}`}>
                    <Receipt className="h-[18px] w-[18px] text-plum" strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold">{e.description}</span>
                    <span className="block text-[13px] font-medium text-muted-foreground">
                      {shortDate(e.date)} · {claimNote(e, state.settings.wfhMethod)}
                    </span>
                  </span>
                  <span className="font-mono text-[15px] font-bold">{formatCurrency(e.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </motion.div>
  );
};

export default DashboardPage;
