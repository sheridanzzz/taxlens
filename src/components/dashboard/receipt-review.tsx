"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { ArrowLeft, ArrowRight, Check, PencilLine, Receipt, RotateCcw, ScanLine, X } from "lucide-react";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { useTax } from "@/context/tax-context";
import { useLaunchers } from "@/components/layout/app-shell";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { formatCurrency, isCoveredByFixedRate } from "@/lib/tax-calculator";
import { expenseReviewStatus } from "@/lib/receipt-review";
import { isAiScanned } from "@/lib/utils";
import type { Expense } from "@/lib/types";

// Saved review decisions sync through the normal expense store. Legacy browser
// acknowledgements remain account-scoped, with fingerprints to detect edits.
const fingerprint = (e: Expense) => JSON.stringify([
  e.id, e.date, e.description, e.amount, e.category, e.claimType,
  e.workUsePercent, e.claimableAmount, e.notes, e.assetId, e.carId, e.kilometres, e.reviewStatus ?? null,
]);
const readReviews = (key: string): string[] => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
};

type Decision = "personal" | "confirm";
type Review = { before: Expense; after: Expense; decision: Decision };

export function ReceiptReview({ accountId }: { accountId: string }) {
  const { state, updateExpense } = useTax();
  const { openScanner } = useLaunchers();
  const storageKey = `ledgr_reviewed_scans:${accountId}`;
  const [checked, setChecked] = useState(() => {
    const reviews = readReviews(storageKey);
    // Preserve acknowledgements from the original dashboard without trusting
    // malformed storage or applying another account's expense IDs.
    try {
      if (localStorage.getItem(storageKey) !== null) return reviews;
      const legacy = readReviews("ledgr_checked_scans");
      return state.expenses.filter((e) => legacy.includes(e.id)).map(fingerprint);
    } catch {
      return reviews;
    }
  });
  const [history, setHistory] = useState<Review[]>([]);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const coolingDown = useRef(false);
  const sectionRef = useRef<HTMLElement>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const reducedMotion = useReducedMotion();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 0, 220], reducedMotion ? [0, 0, 0] : [-10, 0, 10]);
  const personalOpacity = useTransform(x, [-90, -15], [1, 0]);
  const confirmOpacity = useTransform(x, [15, 90], [0, 1]);
  const queue = state.expenses.filter((e) => isAiScanned(e) && e.reviewStatus !== "reviewed" && e.reviewStatus !== "personal" && !checked.includes(fingerprint(e)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const top = queue[0];
  const last = history.at(-1);
  const canUndo = last && state.expenses.some((e) => fingerprint(e) === fingerprint(last.after));
  const count = history.length + queue.length;

  const remember = (next: string[]) => {
    setChecked(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      setMessage("Reviewed for this visit. This browser could not remember your review progress.");
    }
  };

  const decide = async (decision: Decision, keyboard = false) => {
    if (!top || lock.current || editing) return;
    if (!keyboard && coolingDown.current) {
      void animate(x, 0, { duration: reducedMotion ? 0 : 0.18 });
      return;
    }
    if (decision === "personal" && top.claimType === "depreciation" && !top.assetId) {
      setError("This receipt has a separate asset record. Update its work use in Assets so the depreciation changes too.");
      void animate(x, 0, { duration: 0.18 });
      return;
    }
    if (decision === "confirm" && expenseReviewStatus(top) === "pending" && top.workUsePercent === 0) {
      setMessage("Set your work use before confirming, or choose Personal to keep a zero deduction.");
      setEditing(top);
      void animate(x, 0, { duration: reducedMotion ? 0 : 0.18 });
      return;
    }
    coolingDown.current = true;
    window.setTimeout(() => { coolingDown.current = false; }, 300);
    lock.current = true;
    setBusy(true);
    setError("");
    const after: Expense = decision === "personal" ? { ...top, workUsePercent: 0, claimableAmount: 0, reviewStatus: "personal" } : { ...top, reviewStatus: "reviewed" };
    try {
      // Wait for persistence before removing the card. A failed save stays actionable.
      await updateExpense(after);
      await animate(x, reducedMotion ? 0 : decision === "personal" ? -500 : 500, { duration: reducedMotion ? 0 : 0.22 });
      setHistory((items) => [...items, { before: top, after, decision }]);
      setMessage(decision === "personal" ? `${top.description} marked personal. Receipt kept; claim set to $0.` : `${top.description} checked. Amount unchanged.`);
      remember([...checked, fingerprint(after)]);
      x.set(0);
      if (queue.length === 1 && sectionRef.current?.contains(document.activeElement)) {
        requestAnimationFrame(() => sectionRef.current?.focus({ preventScroll: true }));
      }
    } catch {
      coolingDown.current = false;
      setError("Couldn’t save this review. Your card is still here — please try again.");
      void animate(x, 0, { duration: reducedMotion ? 0 : 0.18 });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const undo = async () => {
    if (!last || !canUndo || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await updateExpense({ ...last.before, reviewStatus: last.before.reviewStatus ?? null });
      setMessage(`Undone. ${last.before.description} is ready to review again.`);
      remember(checked.filter((item) => item !== fingerprint(last.after)));
      setHistory((items) => items.slice(0, -1));
      coolingDown.current = false;
    } catch {
      setError("Couldn’t undo yet. Please try again.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <section ref={sectionRef} tabIndex={-1} aria-label="Review scanned receipts" aria-busy={busy} className="min-w-0 rounded-[28px] bg-lav/50 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold text-plum">Check your scans</h2>
        <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-plum">{queue.length ? `${queue.length} to check` : "All caught up"}</span>
      </div>
      {count > 0 && (
        <div role="progressbar" aria-label="Receipt review progress" aria-valuemin={0} aria-valuemax={count} aria-valuenow={history.length} className="mb-4 h-1.5 overflow-hidden rounded-full bg-plum/10">
          <div className="h-full rounded-full bg-plum transition-[width]" style={{ width: `${history.length / count * 100}%` }} />
        </div>
      )}
      <div className="relative isolate">
        {top ? (
          <>
            <div className="relative">
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-3 inset-y-1 translate-y-2 rotate-2 rounded-[22px] bg-mint" />
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-1 inset-y-1 translate-y-1 -rotate-1 rounded-[22px] bg-pink" />
            <div className="relative overflow-hidden rounded-[22px]">
              <motion.div
                role="group"
                aria-label={`Review ${top.description}`}
                aria-describedby="review-instructions"
                aria-keyshortcuts="ArrowLeft ArrowRight"
                tabIndex={0}
                style={{ x, rotate, touchAction: "pan-y" }}
                drag={busy || editing ? false : "x"}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.8}
                dragMomentum={false}
                onDragEnd={(_, info) => {
                  if (Math.abs(info.offset.x) >= 90 || (Math.abs(info.offset.x) >= 35 && Math.abs(info.velocity.x) >= 650)) {
                    void decide(info.offset.x < 0 ? "personal" : "confirm");
                  } else {
                    void animate(x, 0, { duration: reducedMotion ? 0 : 0.2 });
                  }
                }}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
                  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                    event.preventDefault();
                    void decide(event.key === "ArrowLeft" ? "personal" : "confirm", true);
                  }
                }}
                className="relative min-h-[215px] cursor-grab select-none rounded-[22px] border border-border bg-surface p-5 active:cursor-grabbing focus-visible:outline-offset-[-4px]"
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-butter"><Receipt className="h-5 w-5 text-plum" /></span>
                  <div className="min-w-0">
                    <h3 className="break-words text-lg font-extrabold leading-tight">{top.description}</h3>
                    <p className="mt-1 text-xs font-medium text-muted-foreground">{new Date(`${top.date}T12:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short" })} · {EXPENSE_CATEGORIES[top.category]?.label ?? top.category}</p>
                  </div>
                </div>
                <p className="mt-5 text-xs font-bold text-muted-foreground">{top.claimType === "depreciation" ? "Receipt total · claimed through Assets" : isCoveredByFixedRate(top, state.settings.wfhMethod) ? "Covered by the 70c rate · not claimed separately" : "Recorded deduction"}</p>
                <p className="mt-1 break-all font-serif text-4xl font-black tabular text-plum">{formatCurrency(top.claimType === "depreciation" ? top.amount : isCoveredByFixedRate(top, state.settings.wfhMethod) ? 0 : top.claimableAmount)}</p>
                <p className="mt-2 text-sm text-muted-foreground">{expenseReviewStatus(top) === "pending" ? "Pending review · set work use before claiming" : top.workUsePercent === 0 ? "Personal · no deduction" : `${top.workUsePercent}% work use · ${formatCurrency(top.amount)} paid`}</p>
                <motion.div aria-hidden="true" style={{ opacity: personalOpacity }} className="pointer-events-none absolute inset-0 grid place-items-center rounded-[22px] bg-pink/95"><span className="-rotate-12 rounded-xl border-4 border-plum px-4 py-2 text-2xl font-black text-plum">PERSONAL</span></motion.div>
                <motion.div aria-hidden="true" style={{ opacity: confirmOpacity }} className="pointer-events-none absolute inset-0 grid place-items-center rounded-[22px] bg-mint/95"><span className="rotate-12 rounded-xl border-4 border-plum px-4 py-2 text-2xl font-black text-plum">LOOKS RIGHT</span></motion.div>
              </motion.div>
            </div>
            </div>
            <p id="review-instructions" className="mt-4 flex items-center justify-between gap-2 text-xs font-semibold text-plum/80">
              <span className="sr-only">You can also focus the card and use the left or right arrow key.</span>
              <span className="flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Swipe personal</span>
              <span className="flex items-center gap-1">Swipe to confirm <ArrowRight className="h-3 w-3" /></span>
            </p>
            <div className="mt-3 grid grid-cols-[1fr_auto_1fr] gap-2">
              <button disabled={busy} onClick={() => void decide("personal")} className="flex min-h-12 items-center justify-center gap-1.5 rounded-full bg-pink px-3 text-sm font-bold text-plum transition-colors hover:bg-pink/70 disabled:opacity-50"><X className="h-4 w-4" /> Personal</button>
              <button disabled={busy} onClick={() => { setError(""); setEditing(top); }} className="flex min-h-12 items-center justify-center gap-1.5 rounded-full border border-plum/20 bg-surface px-3 text-sm font-bold text-plum hover:bg-surface-2 disabled:opacity-50"><PencilLine className="h-4 w-4" /><span className="sr-only sm:not-sr-only">Fix it</span></button>
              <button disabled={busy} onClick={() => void decide("confirm")} className="flex min-h-12 items-center justify-center gap-1.5 rounded-full bg-plum px-3 text-sm font-bold text-white hover:bg-plum-2 disabled:opacity-50"><Check className="h-4 w-4" /> Looks right</button>
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">Review work use before confirming. Personal keeps the receipt.</p>
          </>
        ) : (
          <div className="flex min-h-[260px] flex-col items-start justify-center rounded-[22px] bg-butter p-6">
            <span className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-plum text-butter"><Check className="h-6 w-6" /></span>
            <h3 className="font-serif text-3xl font-black text-plum">{history.length ? "Nice. All sorted." : "All sorted."}</h3>
            <p className="mt-2 text-sm text-plum/80">{history.length ? `${history.length} receipt${history.length === 1 ? "" : "s"} checked. You can still undo your last review below.` : "Nothing waiting for a look. Add your next receipt whenever you’re ready."}</p>
            <button onClick={openScanner} className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-full bg-plum px-5 text-sm font-bold text-white"><ScanLine className="h-4 w-4" /> Scan a receipt</button>
          </div>
        )}
      </div>
      <div className="mt-3 flex min-h-8 items-start justify-between gap-3">
        <p role="status" className="min-w-0 text-xs leading-relaxed text-muted-foreground">{busy ? "Saving…" : message || "Saved decisions sync with your account."}</p>
        {history.length > 0 && <button disabled={busy || !canUndo} onClick={() => void undo()} className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-bold text-plum hover:bg-white/60 disabled:opacity-40"><RotateCcw className="h-3.5 w-3.5" /> Undo</button>}
      </div>
      {error && <p role="alert" className="mt-2 rounded-xl bg-white p-3 text-sm text-negative">{error}{top?.claimType === "depreciation" && <Link href="/assets" className="ml-1 font-bold underline">Open Assets</Link>}</p>}
      <ExpenseForm open={!!editing} editingExpense={editing} onOpenChange={(open) => { if (!open) setEditing(null); }} />
    </section>
  );
}
