/**
 * The money paths, asserted. Run with `npm run check`.
 * ponytail: one file, no framework — it fails loudly if the maths drifts.
 */
import assert from "node:assert/strict";
import {
  calculateTaxPayable,
  calculateHelpRepayment,
  calculateMls,
  calculateTaxSummary,
  getCategoryBreakdown,
} from "./tax-calculator";
import {
  calculateCurrentYearDepreciation,
  getDepreciationSchedule,
} from "./depreciation";
import { hashPassword, verifyPassword } from "./password";
import { applyCarClaimCaps, mustDepreciate } from "./expense-claims";
import { validateExpense, validateSettings } from "./validation";
import { calculateCgt, isDiscountHoldingPeriod } from "./cgt";
import { calculateRentalSummary } from "./rental";
import { buildTransactions, guessMapping, parseCsv } from "./csv";
import { getMyTaxRows } from "./mytax";
import {
  fillPlan,
  fyWeeks,
  lodgeLines,
  lodgingYear,
  packTaxOptions,
  refundEstimate,
  unpackTaxOptions,
  usualWeek,
  weekStatuses,
  withTaxTime,
} from "./tax-time";
import {
  CAR_KM_CAP,
  CAR_RATE_PER_KM,
  DEPRECIABLE_CATEGORIES,
  FY_DATE_RANGES,
} from "./constants";
import type {
  CgtTransaction,
  DepreciatingAsset,
  Expense,
  UserSettings,
  RentalProperty,
  RentalTransaction,
} from "./types";

const near = (actual: number, expected: number, msg: string) =>
  assert.ok(
    Math.abs(actual - expected) < 1,
    `${msg}: expected ~${expected}, got ${actual}`
  );

// ── Income tax + Medicare, checked against the ATO's own numbers ────
near(
  calculateTaxPayable(120000, "2025-26", true, { hasPrivateHospitalCover: true }),
  29188,
  "$120k FY2025-26 = $26,788 tax + $2,400 Medicare"
);
near(
  calculateTaxPayable(45000, "2025-26", true, { hasPrivateHospitalCover: true }),
  4863,
  "$45k FY2025-26 = $4,288 tax - $325 LITO + $900 Medicare"
);
near(calculateTaxPayable(18200, "2025-26"), 0, "tax-free threshold");

// ── HELP/HECS: marginal from FY2025-26, banded before that ─────────
near(calculateHelpRepayment(60000, "2025-26"), 0, "under the $67k threshold");
near(
  calculateHelpRepayment(120000, "2025-26"),
  (120000 - 67000) * 0.15,
  "15% of income above $67k"
);
near(
  calculateHelpRepayment(150000, "2025-26"),
  (125000 - 67000) * 0.15 + (150000 - 125000) * 0.17,
  "17% kicks in above $125k, marginally"
);
near(
  calculateHelpRepayment(120000, "2024-25"),
  120000 * 0.075,
  "FY2024-25 is the old flat-band system"
);

// ── Medicare levy surcharge ────────────────────────────────────────
near(calculateMls(120000, "2025-26", true), 0, "hospital cover means no MLS");
near(calculateMls(95000, "2025-26", false), 0, "under the tier 1 floor");
near(calculateMls(120000, "2025-26", false), 120000 * 0.0125, "tier 2 = 1.25%");

// ── A deduction is worth more when it also cuts a HELP repayment ───
const withHelp =
  calculateTaxPayable(120000, "2025-26", true, { hasHelpDebt: true }) -
  calculateTaxPayable(119000, "2025-26", true, { hasHelpDebt: true });
const withoutHelp =
  calculateTaxPayable(120000, "2025-26", true) -
  calculateTaxPayable(119000, "2025-26", true);
assert.ok(
  withHelp > withoutHelp + 100,
  `a $1,000 deduction should save ~$150 more with a HELP debt (${withHelp} vs ${withoutHelp})`
);

// ── An asset keeps deducting in the years after it was bought ──────
const laptop: DepreciatingAsset = {
  id: "a",
  name: "Laptop",
  assetType: "laptop",
  purchaseDate: "2024-09-01",
  purchasePrice: 2400,
  effectiveLifeYears: 4,
  depreciationMethod: "diminishing",
  workUsePercent: 100,
  financialYear: "2024-25",
  createdAt: "",
};
assert.ok(
  calculateCurrentYearDepreciation(laptop, "2025-26") > 0,
  "year 2 depreciation must not be zero"
);
assert.ok(
  laptop.purchaseDate <= FY_DATE_RANGES["2025-26"].end,
  "the FY query must still select an asset bought in an earlier year"
);

// Sep 2024 laptop, 4yr life, diminishing at 50%: 303/365 of the first year,
// then the written-down value each year after. Deductions must shrink and
// never exceed what's left on the books.
const y1 = calculateCurrentYearDepreciation(laptop, "2024-25");
const y2 = calculateCurrentYearDepreciation(laptop, "2025-26");
const y3 = calculateCurrentYearDepreciation(laptop, "2026-27");
near(y1, 2400 * (303 / 365) * 0.5, "year 1 is pro-rata from the purchase date");
near(y2, (2400 - y1) * 0.5, "year 2 works off the written-down value");
assert.ok(y3 < y2 && y2 < y1, `deductions must shrink (${y1}, ${y2}, ${y3})`);
assert.ok(
  y1 + y2 + y3 < 2400,
  "the total claimed can never exceed what the asset cost"
);

// A January purchase sits in the FY that started the previous July.
const janDesk: DepreciatingAsset = {
  ...laptop,
  purchaseDate: "2025-02-01",
  assetType: "desk",
  effectiveLifeYears: 10,
};
assert.equal(
  getDepreciationSchedule(janDesk)[0].year,
  "FY 2024-25",
  "the schedule must start in the FY of purchase, not the calendar year"
);
assert.ok(
  getDepreciationSchedule(janDesk).every((r) => r.remaining >= 0),
  "an asset never depreciates below zero"
);
// ── The $300 rule is for equipment, not services ───────────────────
assert.ok(
  !DEPRECIABLE_CATEGORIES.includes("professional_development"),
  "a $1,500 course is deductible in full, not depreciated"
);
assert.ok(
  !DEPRECIABLE_CATEGORIES.includes("donations"),
  "donations are never depreciated"
);
assert.ok(
  DEPRECIABLE_CATEGORIES.includes("computer_equipment"),
  "a $2,400 laptop is an asset"
);

// ── Car cents-per-km is capped ─────────────────────────────────────
near(
  Math.min(7000, CAR_KM_CAP) * CAR_RATE_PER_KM["2025-26"],
  4400,
  "5,000 km cap at 88c"
);

// ── End to end: deductions cut tax, and the summary adds up ────────
const course: Expense = {
  id: "e",
  date: "2025-08-01",
  description: "Conference",
  amount: 1500,
  category: "professional_development",
  claimType: "full",
  workUsePercent: 100,
  claimableAmount: 1500,
  financialYear: "2025-26",
  createdAt: "",
};
const settings: Pick<UserSettings, "hasHelpDebt" | "hasPrivateHospitalCover"> = {
  hasHelpDebt: true,
  hasPrivateHospitalCover: true,
};
const summary = calculateTaxSummary(
  [course],
  [laptop],
  [{ id: "w", date: "2025-08-01", hours: 100, financialYear: "2025-26" }],
  [],
  120000,
  "2025-26",
  "fixed_rate",
  true,
  settings
);
near(summary.totalWfhDeduction, 70, "100 hours at 70c");
near(summary.totalFullClaims, 1500, "the course claims in full");
assert.ok(
  summary.totalDepreciationClaims > 0,
  "the prior-year laptop still contributes"
);
near(
  summary.totalDeductions,
  1500 + 70 + summary.totalDepreciationClaims,
  "the parts sum to the total"
);

// ── The 70c fixed rate already covers internet & phone ─────────────
const internet: Expense = {
  ...course,
  id: "i",
  description: "Home internet",
  category: "internet_phone",
  amount: 900,
  workUsePercent: 50,
  claimableAmount: 450,
};
const onFixedRate = calculateTaxSummary([course, internet], [], [], [], 120000, "2025-26", "fixed_rate");
near(onFixedRate.totalFullClaims, 1500, "internet isn't claimed on top of the 70c rate");
const onActualCost = calculateTaxSummary([course, internet], [], [], [], 120000, "2025-26", "actual_cost");
near(onActualCost.totalFullClaims, 1950, "on actual cost the internet share counts");
assert.equal(getCategoryBreakdown([internet], "fixed_rate").length, 0, "myTax breakdown leaves it out too");
near(getCategoryBreakdown([internet], "actual_cost")[0].amount, 450, "and includes it on actual cost");
const power: Expense = { ...internet, id: "power", category: "other", description: "Origin energy payment - 2026-06-29 [confirm electricity bill]", amount: 100, workUsePercent: 90, claimableAmount: 90 };
assert.equal(mustDepreciate(1000, "other", power.description), false, "a large annual energy bill is a running cost, not an asset");
assert.equal(mustDepreciate(1000, "other", "Electrical testing equipment"), true, "physical equipment still depreciates");
const supplies: Expense = { ...power, id: "supplies", category: "stationery_consumables", description: "Printer ink" };
for (const runningCost of [power, supplies, { ...power, category: "electricity" as const }]) {
  near(calculateTaxSummary([course, runningCost], [], [], [], 120000, "2025-26", "fixed_rate").totalFullClaims, 1500, "covered running cost cannot be claimed twice");
  assert.equal(getCategoryBreakdown([runningCost], "fixed_rate").length, 0, "myTax also excludes running costs");
  near(calculateTaxSummary([runningCost], [], [], [], 120000, "2025-26", "actual_cost").totalFullClaims, 90, "actual-cost work share remains available");
}
near(calculateTaxSummary([{ ...power, description: "Work reference book" }], [], [], [], 120000, "2025-26", "fixed_rate").totalFullClaims, 90, "unrelated Other expenses remain claimable");
assert.ok(
  summary.estimatedTaxSaved > summary.totalDeductions * 0.4,
  "a $120k earner with a HELP debt saves more than 40c per deducted dollar"
);

// ── Rental property: ownership, deductions, and negative gearing ───
const rentalProperty: RentalProperty = {
  id: "rental-1",
  address: "12 Example Street",
  ownershipPercent: 50,
  createdAt: "",
};
const rentalTransaction = (
  values: Partial<RentalTransaction> &
    Pick<RentalTransaction, "id" | "kind" | "amount">
): RentalTransaction => ({
  propertyId: rentalProperty.id,
  date: "2025-08-01",
  category: values.kind === "income" ? "rent" : "council_rates",
  description: values.kind === "income" ? "Rent received" : "Rates",
  deductiblePercent: 100,
  financialYear: "2025-26",
  createdAt: "",
  ...values,
});
const rental = calculateRentalSummary(
  [rentalProperty],
  [
    rentalTransaction({ id: "rent", kind: "income", amount: 24000 }),
    rentalTransaction({
      id: "rates",
      kind: "expense",
      amount: 10000,
      deductiblePercent: 80,
    }),
  ]
);
near(rental.assessableIncome, 12000, "only the owner's share of rent is assessable");
near(
  rental.deductibleExpenses,
  4000,
  "ownership and deductible percentage both apportion rental costs"
);
near(rental.netResult, 8000, "rental net result is income less deductions");

const rentalTax = calculateTaxSummary(
  [],
  [],
  [],
  [],
  120000,
  "2025-26",
  "fixed_rate",
  true,
  { hasPrivateHospitalCover: true },
  0,
  rental.assessableIncome,
  rental.deductibleExpenses
);
near(rentalTax.taxableIncome, 128000, "net rental income flows into taxable income");
near(rentalTax.rentalIncome, 12000, "rental income remains separately reported");
near(
  rentalTax.rentalDeductions,
  4000,
  "rental deductions remain separately reported"
);

const negativelyGeared = calculateTaxSummary(
  [],
  [],
  [],
  [],
  120000,
  "2025-26",
  "fixed_rate",
  true,
  { hasPrivateHospitalCover: true },
  0,
  10000,
  15000
);
near(
  negativelyGeared.taxableIncome,
  115000,
  "a rental loss offsets salary income"
);
assert.ok(
  negativelyGeared.taxPayable <
    calculateTaxPayable(120000, "2025-26", true, {
      hasPrivateHospitalCover: true,
    }),
  "negative gearing must reduce tax payable"
);

// ── Capital gains: FIFO, the 12-month discount, losses ─────────────
const trade = (
  o: Partial<CgtTransaction> & { date: string; side: "buy" | "sell" }
): CgtTransaction => ({
  id: o.date + o.side + (o.quantity ?? 1),
  kind: "crypto",
  asset: "BTC",
  quantity: 1,
  unitPrice: 0,
  fee: 0,
  createdAt: o.date,
  ...o,
});

// bought 1 BTC at $30k, sold 13 months later at $50k → $20k gain, halved
const heldLong = calculateCgt(
  [
    trade({ date: "2024-08-01", side: "buy", unitPrice: 30000 }),
    trade({ date: "2025-09-01", side: "sell", unitPrice: 50000 }),
  ],
  "2025-26"
);
near(heldLong.grossGains, 20000, "gain before discount");
near(heldLong.discountApplied, 10000, "held over 12 months, so half is exempt");
near(heldLong.netCapitalGain, 10000, "only half the gain is taxable");

// same trade 11 months apart → no discount
const heldShort = calculateCgt(
  [
    trade({ date: "2025-08-01", side: "buy", unitPrice: 30000 }),
    trade({ date: "2026-05-01", side: "sell", unitPrice: 50000 }),
  ],
  "2025-26"
);
near(heldShort.discountApplied, 0, "under 12 months gets no discount");
near(heldShort.netCapitalGain, 20000, "the whole gain is taxable");

// fees: a buy fee lifts the cost base, a sell fee cuts the proceeds
const withFees = calculateCgt(
  [
    trade({ date: "2025-08-01", side: "buy", unitPrice: 30000, fee: 100 }),
    trade({ date: "2026-05-01", side: "sell", unitPrice: 50000, fee: 200 }),
  ],
  "2025-26"
);
near(withFees.netCapitalGain, 20000 - 300, "both fees reduce the gain");

// FIFO: two parcels, sell one unit — the oldest goes first
const fifo = calculateCgt(
  [
    trade({ date: "2024-01-01", side: "buy", unitPrice: 10000 }),
    trade({ date: "2025-08-01", side: "buy", unitPrice: 40000 }),
    trade({ date: "2026-01-01", side: "sell", unitPrice: 50000 }),
  ],
  "2025-26"
);
assert.equal(fifo.disposals.length, 1, "one unit sold is one disposal");
near(fifo.disposals[0].costBase, 10000, "FIFO consumes the $10k parcel first");
near(fifo.netCapitalGain, 20000, "$40k gain, discounted — the parcel is old");
assert.equal(fifo.holdings[0].quantity, 1, "the newer parcel is still held");
near(fifo.holdings[0].costBase, 40000, "and carries its own cost base");

// a sale spanning two parcels splits into two disposals
const split = calculateCgt(
  [
    trade({ date: "2025-07-05", side: "buy", quantity: 1, unitPrice: 100 }),
    trade({ date: "2025-08-05", side: "buy", quantity: 1, unitPrice: 200 }),
    trade({ date: "2026-01-05", side: "sell", quantity: 2, unitPrice: 300 }),
  ],
  "2025-26"
);
assert.equal(split.disposals.length, 2, "two parcels consumed, two disposals");
near(split.netCapitalGain, 300, "gains of $200 and $100, neither discounted");

// losses come off gains BEFORE the discount, and off undiscounted gains first
const withLoss = calculateCgt(
  [
    trade({ date: "2020-01-01", asset: "ETH", side: "buy", unitPrice: 1000 }),
    trade({ date: "2025-10-01", asset: "ETH", side: "sell", unitPrice: 11000 }),
    trade({ date: "2025-08-01", asset: "SOL", side: "buy", unitPrice: 5000 }),
    trade({ date: "2025-12-01", asset: "SOL", side: "sell", unitPrice: 1000 }),
  ],
  "2025-26"
);
near(withLoss.grossGains, 10000, "the ETH gain");
near(withLoss.grossLosses, 4000, "the SOL loss");
near(
  withLoss.netCapitalGain,
  3000,
  "loss first (10000-4000), then halve — not halve then subtract"
);

// a net loss is not a negative gain: it carries forward instead
const netLoss = calculateCgt(
  [
    trade({ date: "2025-08-01", side: "buy", unitPrice: 50000 }),
    trade({ date: "2025-12-01", side: "sell", unitPrice: 20000 }),
  ],
  "2025-26"
);
near(netLoss.netCapitalGain, 0, "a capital loss never reduces salary income");
near(netLoss.lossesCarriedForward, 30000, "it carries to future years");

// and that carried loss actually lands on the next year's gain
const carried = calculateCgt(
  [
    trade({ date: "2024-08-01", side: "buy", unitPrice: 50000 }),
    trade({ date: "2024-12-01", side: "sell", unitPrice: 20000 }),
    trade({ date: "2025-08-01", asset: "ETH", side: "buy", unitPrice: 10000 }),
    trade({ date: "2026-01-01", asset: "ETH", side: "sell", unitPrice: 60000 }),
  ],
  "2025-26"
);
near(carried.priorLossesUsed, 30000, "last year's loss is applied");
near(carried.netCapitalGain, 20000, "$50k gain less the $30k prior loss");

// selling more than you ever bought is flagged, not silently priced at zero
const oversold = calculateCgt(
  [trade({ date: "2025-08-01", side: "sell", unitPrice: 1000 })],
  "2025-26"
);
assert.ok(oversold.hasUnmatchedSales, "an unmatched sale must be flagged");

// a capital gain is assessable income — it lifts tax, and can lift the bracket
const cgtSummary = calculateTaxSummary(
  [],
  [],
  [],
  [],
  120000,
  "2025-26",
  "fixed_rate",
  true,
  { hasPrivateHospitalCover: true },
  10000
);
near(cgtSummary.taxableIncome, 130000, "the gain is added to salary");
near(cgtSummary.netCapitalGain, 10000, "and reported on the summary");

// ── CSV import: any exchange's column names ────────────────────────
const csv = `Date,Market,Type,Amount,Price per unit,Fee
01/08/2025,BTC/AUD,BUY,0.5,"90,000.00",12.50
15/03/2026,BTC/AUD,SELL,0.5,"$120,000",15.00`;

const grid = parseCsv(csv);
assert.equal(grid.length, 3, "header plus two rows");
assert.equal(grid[1][4], "90,000.00", "quoted commas stay inside their field");

const mapping = guessMapping(grid[0]);
const imported = buildTransactions(grid.slice(1), mapping, "crypto");
assert.ok(
  imported.every((r) => r.transaction),
  `both rows should parse: ${imported.map((r) => r.problem).join(", ")}`
);
assert.equal(imported[0].transaction!.asset, "BTC", "BTC/AUD is just BTC");
assert.equal(imported[0].transaction!.date, "2025-08-01", "day-first dates");
assert.equal(imported[0].transaction!.side, "buy", "BUY is a buy");
near(imported[0].transaction!.unitPrice, 90000, "thousands separators stripped");
near(imported[1].transaction!.unitPrice, 120000, "currency symbols stripped");

// a file with a total instead of a unit price still works
const totalsCsv = `Trade Date,Ticker,Direction,Units,Consideration,Brokerage
2025-09-01,CBA,Buy,100,10500,9.50`;
const totalsGrid = parseCsv(totalsCsv);
const totalsRows = buildTransactions(
  totalsGrid.slice(1),
  guessMapping(totalsGrid[0]),
  "share"
);
near(
  totalsRows[0].transaction!.unitPrice,
  105,
  "unit price derived from total ÷ quantity"
);

// ── Password hashing: salted, and old accounts still get in ────────
const passwordChecks = async () => {
  const stored = await hashPassword("correct horse battery");
  assert.match(stored, /^pbkdf2\$210000\$[0-9a-f]{32}\$[0-9a-f]{64}$/, "format");
  assert.notEqual(
    stored,
    await hashPassword("correct horse battery"),
    "the same password must hash differently — that's the salt doing its job"
  );

  const good = await verifyPassword("correct horse battery", stored);
  assert.ok(good.ok && !good.needsUpgrade, "the right password gets in");
  assert.ok(
    !(await verifyPassword("wrong password", stored)).ok,
    "the wrong password does not"
  );

  // an account created before salting: bare SHA-256 of "hunter2hunter2"
  const legacy = Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode("hunter2hunter2")
      )
    )
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const old = await verifyPassword("hunter2hunter2", legacy);
  assert.ok(old.ok, "existing accounts must still be able to log in");
  assert.ok(old.needsUpgrade, "and get re-hashed on the way through");
  assert.ok(
    !(await verifyPassword("nope", legacy)).ok,
    "legacy path still rejects a wrong password"
  );
};

passwordChecks().then(() => console.log("tax + password checks passed"));

// Regression: fractional incomes must cross bracket boundaries continuously.
assert.equal(calculateTaxPayable(45000.5, "2025-26", true, { hasPrivateHospitalCover: true }), 4863.17);
assert.equal(calculateTaxPayable(135000.5, "2025-26", true, { hasPrivateHospitalCover: true }), 33988.2);
assert.equal(calculateTaxPayable(26000, "2024-25", true), 548);
assert.equal(calculateTaxPayable(28011, "2025-26", true), 869.76);
assert.equal(calculateTaxPayable(50000, "2025-26", "non_resident"), 15000);
assert.equal(calculateTaxPayable(50000, "2025-26", "working_holiday"), 8250);
assert.equal(calculateTaxPayable(50000, "2025-26", "working_holiday", { workingHolidayResident: true }), 9250);
assert.equal(calculateTaxPayable(50000, "2025-26", "working_holiday", { workingHolidayResident: true, workingHolidayTreatyResident: true }),
  calculateTaxPayable(50000, "2025-26", "resident"));
assert.equal(calculateHelpRepayment(200000, "2025-26"), 20000);
assert.equal(calculateHelpRepayment(200000, "2025-26", 123), 123);
assert.equal(calculateHelpRepayment(69528, "2026-27"), 0);
assert.equal(calculateHelpRepayment(129717, "2026-27"), 9028.35);
assert.equal(calculateMls(104000, "2026-27", false), 0);
assert.equal(calculateMls(120000, "2026-27", false), 1200);
const gearedHelp = calculateTaxSummary([], [], [], [], 120000, "2025-26", "fixed_rate", true,
  { hasHelpDebt: true, hasPrivateHospitalCover: true }, 0, 10000, 15000);
assert.equal(Math.round((gearedHelp.taxPayable - negativelyGeared.taxPayable) * 100) / 100, 7950,
  "net rental losses are added back for HELP rather than reducing repayments");
assert.equal(calculateTaxPayable(100000, "2025-26", true,
  { hasHelpDebt: true, hasPrivateHospitalCover: true, reportableSuperContributions: 10000 }) -
  calculateTaxPayable(100000, "2025-26", true, { hasPrivateHospitalCover: true }), 6450);

const car = (id: string, values: Partial<Expense> = {}): Expense => ({ ...course, id,
  category: "car_km", amount: 3520, claimableAmount: 3520, kilometres: 4000, carId: "ABC123", ...values });
assert.equal(applyCarClaimCaps([car("a"), car("b")]).reduce((n,e) => n+e.claimableAmount,0), 4400);
assert.equal(applyCarClaimCaps([car("a"), car("b", { carId: "SECOND" })]).reduce((n,e) => n+e.claimableAmount,0), 7040);
assert.equal(applyCarClaimCaps([car("a", { workUsePercent: 0 }), car("b")])[1].claimableAmount, 3520);
assert.equal(applyCarClaimCaps([car("a", { kilometres: undefined }), car("b", { kilometres: undefined })])[1].claimableAmount, 880);
assert.equal(calculateTaxSummary([car("a"), car("b")], [], [], [], 120000, "2025-26", "fixed_rate").totalFullClaims, 4400);
assert.equal(CAR_RATE_PER_KM["2026-27"], 0.91);
assert.equal(mustDepreciate(1500, "professional_development"), false);
assert.equal(mustDepreciate(1500, "software_subscriptions"), false);
assert.equal(mustDepreciate(1500, "computer_equipment"), true);
assert.equal(mustDepreciate(300, "computer_equipment"), false);
assert.equal(validateExpense({ ...course, workUsePercent: 0 }).claimableAmount, 0);
assert.throws(() => validateExpense({ ...course, workUsePercent: 101 }));
assert.throws(() => validateExpense({ ...course, date: "2025-02-30" }));
assert.throws(() => validateExpense({ ...course, receiptDataUrl: "javascript:alert(1)" }));
assert.equal(validateSettings({ financialYear: "2025-26", annualIncome: 0, occupation: "",
  taxResidentStatus: "resident", defaultWorkUsePercent: 0, wfhMethod: "fixed_rate", depreciationMethod: "diminishing",
  hasHelpDebt: false, hasPrivateHospitalCover: false }).defaultWorkUsePercent, 0);

assert.equal(isDiscountHoldingPeriod("2023-03-01", "2024-02-29"), false);
assert.equal(isDiscountHoldingPeriod("2023-03-01", "2024-03-01"), false);
assert.equal(isDiscountHoldingPeriod("2023-03-01", "2024-03-02"), true);
assert.equal(isDiscountHoldingPeriod("2024-02-29", "2025-02-28"), false);
assert.equal(isDiscountHoldingPeriod("2024-02-29", "2025-03-01"), true);
const separateKinds = calculateCgt([
  trade({ id: "crypto-buy", date: "2024-08-01", side: "buy", unitPrice: 10 }),
  trade({ id: "share-buy", date: "2024-08-01", side: "buy", unitPrice: 100, kind: "share" }),
  trade({ id: "share-sell", date: "2025-09-01", side: "sell", unitPrice: 150, kind: "share" }),
], "2025-26");
assert.equal(separateKinds.netCapitalGain, 25);
assert.equal(separateKinds.holdings.find(h => h.kind === "crypto")?.quantity, 1);
assert.equal(calculateCgt([trade({ date: "2025-08-01", side: "buy", quantity: 0.00001234 })], "2025-26").holdings[0].quantity, 0.00001234);
console.log("Bug regression checks passed.");

assert.equal(calculateTaxPayable(70000, "2025-26", true, { reportableFringeBenefits: 40000 }) -
  calculateTaxPayable(70000, "2025-26", true, { reportableFringeBenefits: 40000, hasPrivateHospitalCover: true }), 1100,
  "MLS applies to taxable income plus reportable fringe benefits, once the threshold is exceeded");

// ── Tax time (iOS checklist, gap finder, Lodge mode) ───────────────
const weeks = fyWeeks("2025-26");
assert.equal(weeks[0].monday, "2025-06-30", "1 Jul 2025 is a Tuesday, so the first week starts the Monday before");
assert.equal(weeks[0].days[0], "2025-07-01", "but only in-FY days count");
assert.deepEqual(weeks.at(-1)?.days, ["2026-06-29", "2026-06-30"], "the last week stops at 30 June");
assert.equal(weeks.length, 53);
const hoursDiary = [
  { id: "1", date: "2025-07-01", hours: 7.6, financialYear: "2025-26" as const },
  { id: "2", date: "2025-07-02", hours: 4, financialYear: "2025-26" as const },
  { id: "3", date: "2025-07-21", hours: 7.6, financialYear: "2025-26" as const },
];
const statuses = weekStatuses("2025-26", hoursDiary, ["2025-07-07"], "2025-07-31");
assert.deepEqual(statuses.slice(0, 5).map((w) => w.status), ["logged", "away", "gap", "logged", "future"],
  "logged, marked away, empty and over, logged, not over yet");
assert.equal(statuses[0].hours, 11.6);
assert.deepEqual(usualWeek(hoursDiary), [7.6, 7.6, 4, 0, 0, 0, 0],
  "a weekday counts once it's logged in at least half the logged weeks");
assert.deepEqual(fillPlan([statuses[2]], usualWeek(hoursDiary), new Set(["2025-07-15"])).map((d) => [d.date, d.hours]),
  [["2025-07-14", 7.6], ["2025-07-16", 4]], "the fill skips a day that's already logged");
assert.deepEqual(refundEstimate({ taxPayable: 10000, taxPayableWithoutDeductions: 10500 }, 11000),
  { withDeductions: 1000, withoutDeductions: 500 });
assert.ok(refundEstimate({ taxPayable: 12000, taxPayableWithoutDeductions: 12000 }, 11000).withDeductions < 0, "negative is owing");
assert.equal(lodgingYear("2026-10-03"), "2025-26");
assert.equal(lodgingYear("2026-07-01"), "2025-26");
assert.equal(lodgingYear("2026-06-30"), null, "the year isn't over");
assert.equal(lodgingYear("2026-11-01"), null, "self-lodging closed on 31 October");

const lodgingSettings: UserSettings = {
  financialYear: "2025-26", annualIncome: 90000, occupation: "Analyst", taxResidentStatus: "resident",
  defaultWorkUsePercent: 100, wfhMethod: "fixed_rate", depreciationMethod: "diminishing",
  hasHelpDebt: false, hasPrivateHospitalCover: false, taxOptions: { helpDebtBalance: 5000 },
  taxTime: { "2025-26": { taxWithheld: 18000, bills: { phone: true }, awayWeeks: ["2025-07-07"], lodgedAt: "2026-10-03" } },
};
assert.deepEqual(unpackTaxOptions(packTaxOptions(lodgingSettings)),
  { taxOptions: lodgingSettings.taxOptions, taxTime: lodgingSettings.taxTime }, "lodging data rides in tax_options and comes back out");
assert.equal(withTaxTime(lodgingSettings, "2025-26", { taxWithheld: 1 }).taxTime?.["2025-26"]?.lodgedAt, "2026-10-03", "a patch keeps the rest");
const cleaned = validateSettings({ ...lodgingSettings,
  taxTime: { "2025-26": { taxWithheld: 1, awayWeeks: ["2025-07-07", "2025-07-07"], extra: "x" } as never } });
assert.deepEqual(cleaned.taxTime, { "2025-26": { taxWithheld: 1, awayWeeks: ["2025-07-07"],
  bills: undefined, filledDays: undefined, entered: undefined, lodgedAt: undefined } }, "unknown keys are dropped, lists deduped");
assert.throws(() => validateSettings({ ...lodgingSettings, taxTime: { "1999-00": {} } as never }), "unknown FY");
assert.throws(() => validateSettings({ ...lodgingSettings, taxTime: { "2025-26": { awayWeeks: ["soon"] } } }), "not a date");
assert.throws(() => validateSettings({ ...lodgingSettings, taxTime: { "2025-26": { taxWithheld: -1 } } }), "negative withholding");

// Lodge mode's "What's in it" must add up to the total it shows for each myTax label
const lodgeExpenses = [course, internet, { ...course, id: "c2", description: "Textbook", amount: 80, claimableAmount: 80 }];
const lodgeRows = getMyTaxRows(getCategoryBreakdown(lodgeExpenses, "fixed_rate", [laptop], "2025-26"), 70);
assert.ok(lodgeRows.length >= 2);
for (const row of lodgeRows) {
  const lines = lodgeLines(row.item, lodgeExpenses, [laptop], hoursDiary, "2025-26", "fixed_rate", 70);
  assert.ok(Math.abs(lines.reduce((s, l) => s + l.amount, 0) - row.amount) < 0.01, `${row.item} lines sum to its total`);
}
assert.ok(!lodgeRows.some((r) => lodgeLines(r.item, lodgeExpenses, [laptop], hoursDiary, "2025-26", "fixed_rate", 70)
  .some((l) => l.label === "Home internet")), "the 70c rate covers internet, so it's in no label");
console.log("Tax time checks passed.");
