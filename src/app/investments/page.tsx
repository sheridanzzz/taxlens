"use client";

import { useState } from "react";
import { Plus, Upload, Trash2, Pencil, AlertTriangle } from "lucide-react";
import { motion } from "motion/react";
import { Section, Kpi, Card, Pill } from "@/components/ledgr/primitives";
import { TradeForm } from "@/components/investments/trade-form";
import { CsvImport } from "@/components/investments/csv-import";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAsyncAction } from "@/hooks/use-async-action";
import { useTax } from "@/context/tax-context";
import { formatCurrency } from "@/lib/tax-calculator";
import { fadeInUp } from "@/lib/animations";
import type { CgtTransaction } from "@/lib/types";

const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });

const fmtQty = (n: number) =>
  n.toLocaleString("en-AU", { maximumFractionDigits: 8 });

const InvestmentsPage = () => {
  const { state, cgt, removeCgtTransaction } = useTax();
  const action = useAsyncAction();
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<CgtTransaction | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (!state.loaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      </div>
    );
  }

  const fy = state.settings.financialYear;
  const trades = [...state.cgtTransactions].sort((a, b) =>
    b.date.localeCompare(a.date)
  );
  const holdingsValue = cgt.holdings.reduce((s, h) => s + h.costBase, 0);

  return (
    <motion.div
      initial={fadeInUp.initial}
      animate={fadeInUp.animate}
      transition={fadeInUp.transition}
    >
      <Section
        eyebrow={`FY ${fy} · capital gains`}
        title="Crypto & shares"
        action={
          <div className="flex gap-2">
            <button
              onClick={() => setImportOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm text-muted-foreground hover:text-foreground"
              aria-label="Import trades from CSV"
            >
              <Upload className="h-4 w-4" /> Import CSV
            </button>
            <button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-gold px-4 text-sm text-primary-foreground hover:opacity-90"
              aria-label="Add a trade"
            >
              <Plus className="h-4 w-4" /> Add trade
            </button>
          </div>
        }
      />

      {cgt.hasUnmatchedSales && (
        <div className="mb-6 flex items-start gap-2 rounded-md border border-negative/40 bg-negative/5 p-4 text-[13px]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-negative" />
          <span>
            Some sales have no matching purchase in your data, so they&apos;re
            counted with a zero cost base — which overstates your gain. Add the
            earlier buy trades to fix it.
          </span>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi
          label="Net capital gain"
          value={formatCurrency(cgt.netCapitalGain)}
          hint="added to taxable income"
          large
        />
        <Kpi
          label="Gains before discount"
          value={formatCurrency(cgt.grossGains)}
          hint={`${cgt.disposals.length} disposal${cgt.disposals.length === 1 ? "" : "s"}`}
        />
        <Kpi
          label="50% discount"
          value={`− ${formatCurrency(cgt.discountApplied)}`}
          hint="parcels held over 12 months"
        />
        <Kpi
          label="Losses carried forward"
          value={formatCurrency(cgt.lossesCarriedForward)}
          hint="to future years"
        />
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="eyebrow">FY {fy} · disposals</div>
          {cgt.disposals.length === 0 ? (
            <p className="mt-4 text-[13px] text-muted-foreground">
              No sales in this financial year. Buying isn&apos;t a taxable
              event — a gain is only made when you dispose of something.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="eyebrow">
                  <tr className="border-b border-border">
                    <th className="pb-2 text-left font-normal">Asset</th>
                    <th className="pb-2 text-left font-normal">Acquired</th>
                    <th className="pb-2 text-left font-normal">Sold</th>
                    <th className="pb-2 text-right font-normal">Qty</th>
                    <th className="pb-2 text-right font-normal">Cost base</th>
                    <th className="pb-2 text-right font-normal">Proceeds</th>
                    <th className="pb-2 text-right font-normal">Gain</th>
                  </tr>
                </thead>
                <tbody>
                  {cgt.disposals.map((d, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="py-2.5">
                        <span className="font-medium">{d.asset}</span>
                        {d.discountable && (
                          <span className="ml-2">
                            <Pill tone="gold">50% discount</Pill>
                          </span>
                        )}
                        {d.unmatched && (
                          <span className="ml-2">
                            <Pill tone="negative">no cost base</Pill>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-muted-foreground">
                        {d.unmatched ? "—" : fmtDate(d.acquiredDate)}
                      </td>
                      <td className="py-2.5 text-muted-foreground">
                        {fmtDate(d.disposedDate)}
                      </td>
                      <td className="py-2.5 text-right tabular">{fmtQty(d.quantity)}</td>
                      <td className="py-2.5 text-right tabular">
                        {formatCurrency(d.costBase)}
                      </td>
                      <td className="py-2.5 text-right tabular">
                        {formatCurrency(d.proceeds)}
                      </td>
                      <td
                        className={`py-2.5 text-right tabular ${
                          d.gain >= 0 ? "text-positive" : "text-negative"
                        }`}
                      >
                        {formatCurrency(d.gain)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <div className="eyebrow">CGT worksheet</div>
          <div className="mt-6 space-y-3 text-sm">
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground">Total gains</span>
              <span className="font-mono tabular">{formatCurrency(cgt.grossGains)}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground">Total losses</span>
              <span className="font-mono tabular">
                − {formatCurrency(cgt.grossLosses)}
              </span>
            </div>
            {cgt.priorLossesUsed > 0 && (
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground">Prior-year losses used</span>
                <span className="font-mono tabular">
                  − {formatCurrency(cgt.priorLossesUsed)}
                </span>
              </div>
            )}
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground">50% CGT discount</span>
              <span className="font-mono tabular">
                − {formatCurrency(cgt.discountApplied)}
              </span>
            </div>
            <div className="hairline mt-4 pt-4" />
            <div className="flex items-baseline justify-between">
              <span>Net capital gain</span>
              <span className="font-serif text-2xl tabular text-gold">
                {formatCurrency(cgt.netCapitalGain)}
              </span>
            </div>
            <p className="pt-2 text-[11px] text-muted-foreground">
              Losses come off gains before the discount, and off undiscounted
              gains first. FIFO parcel matching: a sale uses your oldest units.
            </p>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <div className="eyebrow">Still held</div>
          {cgt.holdings.length === 0 ? (
            <p className="mt-4 text-[13px] text-muted-foreground">
              Nothing on hand.
            </p>
          ) : (
            <>
              <div className="mt-1 font-serif text-2xl tabular">
                {formatCurrency(holdingsValue)}
              </div>
              <div className="mb-4 text-[11px] text-muted-foreground">
                total cost base
              </div>
              <div className="space-y-2 text-[13px]">
                {cgt.holdings.map((h) => (
                  <div key={`${h.kind}:${h.asset}`} className="flex items-baseline justify-between">
                    <span>
                      {h.asset}{" "}
                      <span className="text-muted-foreground">
                        {fmtQty(h.quantity)}
                      </span>
                    </span>
                    <span className="font-mono tabular text-muted-foreground">
                      {formatCurrency(h.costBase)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <div className="eyebrow">All trades</div>
          {trades.length === 0 ? (
            <p className="mt-4 text-[13px] text-muted-foreground">
              No trades yet. Import a CSV from your exchange or broker, or add
              one by hand.
            </p>
          ) : (
            <div className="mt-4 max-h-96 overflow-y-auto">
              <table className="w-full text-[13px]">
                <thead className="eyebrow sticky top-0 bg-surface">
                  <tr className="border-b border-border">
                    <th className="pb-2 text-left font-normal">Date</th>
                    <th className="pb-2 text-left font-normal">Asset</th>
                    <th className="pb-2 text-left font-normal">Side</th>
                    <th className="pb-2 text-right font-normal">Qty</th>
                    <th className="pb-2 text-right font-normal">Price</th>
                    <th className="pb-2 text-right font-normal"></th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((t) => (
                    <tr key={t.id} className="border-b border-border last:border-0">
                      <td className="py-2.5 text-muted-foreground">
                        {fmtDate(t.date)}
                      </td>
                      <td className="py-2.5 font-medium">{t.asset}</td>
                      <td className="py-2.5">
                        <Pill tone={t.side === "buy" ? "muted" : "positive"}>
                          {t.side}
                        </Pill>
                      </td>
                      <td className="py-2.5 text-right tabular">{fmtQty(t.quantity)}</td>
                      <td className="py-2.5 text-right tabular">
                        {formatCurrency(t.unitPrice)}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => {
                            setEditing(t);
                            setFormOpen(true);
                          }}
                          className="mr-1 p-1 text-muted-foreground hover:text-foreground"
                          aria-label={`Edit ${t.asset} trade`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteId(t.id)}
                          className="p-1 text-muted-foreground hover:text-negative"
                          aria-label={`Delete ${t.asset} trade`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {formOpen && (
        <TradeForm
          key={editing?.id ?? "new"}
          open
          onOpenChange={setFormOpen}
          editing={editing}
        />
      )}
      <CsvImport open={importOpen} onOpenChange={setImportOpen} />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this trade?</AlertDialogTitle>
            <AlertDialogDescription>
              Removing a buy changes which parcels later sales match against, so
              your gains for other years may move too.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {action.error && <p role="alert" className="text-sm text-destructive">{action.error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={action.busy}
              onClick={(event) => {
                event.preventDefault();
                void action.run(async () => {
                  if (deleteId) await removeCgtTransaction(deleteId);
                  setDeleteId(null);
                });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};

export default InvestmentsPage;
