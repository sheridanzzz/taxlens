import type { CgtTransaction, FinancialYear } from "./types";
import { FY_DATE_RANGES } from "./constants";

/**
 * Capital gains on crypto and shares.
 *
 * FIFO parcel matching: a sale consumes the oldest units first. That's the
 * ATO's default where you can't identify which parcel you sold, and it's the
 * only method here.
 * ponytail: no specific-identification or average-cost. FIFO covers exchange
 * trading, which is the case this exists for; add a per-sale parcel picker if
 * someone actually needs to nominate parcels.
 */

/** A CGT event must happen more than 12 months after acquisition to discount. */
const DISCOUNT_HOLDING_DAYS = 365;
const DISCOUNT_RATE = 0.5;

const DAY_MS = 86_400_000;

const daysBetween = (from: string, to: string): number =>
  Math.round(
    (new Date(`${to}T00:00:00`).getTime() -
      new Date(`${from}T00:00:00`).getTime()) /
      DAY_MS
  );

export interface CgtDisposal {
  asset: string;
  kind: CgtTransaction["kind"];
  acquiredDate: string;
  disposedDate: string;
  quantity: number;
  /** Sale value for this parcel, net of the apportioned selling fee. */
  proceeds: number;
  /** What the parcel cost, including the apportioned buying fee. */
  costBase: number;
  gain: number;
  holdingDays: number;
  discountable: boolean;
  /** True when units were sold that no purchase in the data accounts for. */
  unmatched: boolean;
}

export interface CgtHolding {
  asset: string;
  kind: CgtTransaction["kind"];
  quantity: number;
  costBase: number;
}

export interface CgtSummary {
  disposals: CgtDisposal[];
  /** Gains before any discount, losses already netted off. */
  grossGains: number;
  grossLosses: number;
  lossesUsed: number;
  /** Prior-year losses applied to this year's gains. */
  priorLossesUsed: number;
  discountApplied: number;
  /** What gets added to taxable income. Never negative. */
  netCapitalGain: number;
  lossesCarriedForward: number;
  holdings: CgtHolding[];
  hasUnmatchedSales: boolean;
}

const emptySummary = (): CgtSummary => ({
  disposals: [],
  grossGains: 0,
  grossLosses: 0,
  lossesUsed: 0,
  priorLossesUsed: 0,
  discountApplied: 0,
  netCapitalGain: 0,
  lossesCarriedForward: 0,
  holdings: [],
  hasUnmatchedSales: false,
});

const round = (n: number) => Math.round(n * 100) / 100;

interface Parcel {
  date: string;
  quantity: number;
  /** Cost per unit including the apportioned purchase fee. */
  unitCost: number;
}

/**
 * Walks every transaction in date order, FIFO-matching sells against buys.
 * Returns each disposal plus what's still held at the end.
 */
export const matchDisposals = (
  transactions: CgtTransaction[]
): { disposals: CgtDisposal[]; holdings: CgtHolding[] } => {
  const ordered = [...transactions].sort(
    (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)
  );

  const parcels = new Map<string, Parcel[]>();
  const kinds = new Map<string, CgtTransaction["kind"]>();
  const disposals: CgtDisposal[] = [];

  for (const tx of ordered) {
    const key = tx.asset.toUpperCase();
    kinds.set(key, tx.kind);
    if (!parcels.has(key)) parcels.set(key, []);
    const queue = parcels.get(key)!;

    if (tx.side === "buy") {
      if (tx.quantity <= 0) continue;
      queue.push({
        date: tx.date,
        quantity: tx.quantity,
        unitCost: (tx.quantity * tx.unitPrice + tx.fee) / tx.quantity,
      });
      continue;
    }

    let remaining = tx.quantity;
    if (remaining <= 0) continue;
    // the selling fee belongs to the whole sale — split it across the parcels
    // this sale happens to consume
    const feePerUnit = tx.quantity > 0 ? tx.fee / tx.quantity : 0;

    while (remaining > 0) {
      const parcel = queue[0];
      const matched = parcel ? Math.min(parcel.quantity, remaining) : remaining;
      const proceeds = matched * tx.unitPrice - matched * feePerUnit;
      const costBase = parcel ? matched * parcel.unitCost : 0;
      const holdingDays = parcel ? daysBetween(parcel.date, tx.date) : 0;
      const gain = proceeds - costBase;

      disposals.push({
        asset: key,
        kind: tx.kind,
        acquiredDate: parcel?.date ?? tx.date,
        disposedDate: tx.date,
        quantity: matched,
        proceeds: round(proceeds),
        costBase: round(costBase),
        gain: round(gain),
        holdingDays,
        discountable: !!parcel && holdingDays > DISCOUNT_HOLDING_DAYS && gain > 0,
        unmatched: !parcel,
      });

      remaining -= matched;
      if (!parcel) break; // nothing left to consume; stop rather than loop
      parcel.quantity -= matched;
      if (parcel.quantity <= 1e-12) queue.shift();
    }
  }

  const holdings: CgtHolding[] = [];
  for (const [asset, queue] of parcels) {
    const quantity = queue.reduce((s, p) => s + p.quantity, 0);
    if (quantity <= 1e-12) continue;
    holdings.push({
      asset,
      kind: kinds.get(asset) ?? "crypto",
      quantity: round(quantity),
      costBase: round(queue.reduce((s, p) => s + p.quantity * p.unitCost, 0)),
    });
  }

  return { disposals, holdings: holdings.sort((a, b) => b.costBase - a.costBase) };
};

/**
 * Nets one year's disposals down to a taxable figure, ATO order: losses come
 * off gains *before* the 50% discount, and they come off undiscounted gains
 * first because that wastes less of the discount.
 */
const applyLossesAndDiscount = (
  disposals: CgtDisposal[],
  lossesBroughtForward: number
) => {
  let discountable = 0;
  let other = 0;
  let grossLosses = 0;

  for (const d of disposals) {
    if (d.gain < 0) grossLosses += -d.gain;
    else if (d.discountable) discountable += d.gain;
    else other += d.gain;
  }

  const grossGains = discountable + other;
  let pool = grossLosses + lossesBroughtForward;

  const offsetOther = Math.min(pool, other);
  other -= offsetOther;
  pool -= offsetOther;

  const offsetDiscountable = Math.min(pool, discountable);
  discountable -= offsetDiscountable;
  pool -= offsetDiscountable;

  const discountApplied = discountable * DISCOUNT_RATE;
  const netCapitalGain = other + discountable - discountApplied;

  return {
    grossGains: round(grossGains),
    grossLosses: round(grossLosses),
    lossesUsed: round(offsetOther + offsetDiscountable),
    discountApplied: round(discountApplied),
    netCapitalGain: round(netCapitalGain),
    lossesCarriedForward: round(pool),
  };
};

/**
 * The CGT position for one financial year. Earlier years are replayed first so
 * unused capital losses carry forward the way the ATO expects.
 * ponytail: losses only carry from years that exist in this data. Enter your
 * older trades if you have losses from before you started using the app.
 */
export const calculateCgt = (
  transactions: CgtTransaction[],
  financialYear: FinancialYear
): CgtSummary => {
  if (transactions.length === 0) return emptySummary();

  const { disposals, holdings } = matchDisposals(transactions);
  const fyEnd = FY_DATE_RANGES[financialYear].end;
  const fyStart = FY_DATE_RANGES[financialYear].start;

  // replay every earlier FY in order so unused losses arrive at this one.
  // A date in Jan-Jun belongs to the FY that started the previous July.
  const fyStartYear = (date: string) =>
    Number(date.slice(5, 7)) >= 7
      ? Number(date.slice(0, 4))
      : Number(date.slice(0, 4)) - 1;

  const earlierYears = [
    ...new Set(
      disposals
        .filter((d) => d.disposedDate < fyStart)
        .map((d) => fyStartYear(d.disposedDate))
    ),
  ].sort((a, b) => a - b);

  let carried = 0;
  for (const year of earlierYears) {
    const inYear = disposals.filter(
      (d) => fyStartYear(d.disposedDate) === year
    );
    carried = applyLossesAndDiscount(inYear, carried).lossesCarriedForward;
  }

  const thisYear = disposals.filter(
    (d) => d.disposedDate >= fyStart && d.disposedDate <= fyEnd
  );
  const netted = applyLossesAndDiscount(thisYear, carried);
  // this year's own losses are consumed first, so prior-year losses only get
  // used once those run out
  const priorLossesUsed = Math.max(0, netted.lossesUsed - netted.grossLosses);

  return {
    ...netted,
    disposals: thisYear,
    priorLossesUsed: round(priorLossesUsed),
    holdings,
    hasUnmatchedSales: thisYear.some((d) => d.unmatched),
  };
};
