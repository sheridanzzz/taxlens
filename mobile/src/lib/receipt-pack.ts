import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import type { Expense, TaxSummary } from "@shared/types";
import { ASSET_EFFECTIVE_LIVES, EXPENSE_CATEGORIES } from "@shared/constants";
import { calculateCurrentYearDepreciation } from "@shared/depreciation";
import { formatCurrency, isCoveredByFixedRate } from "@shared/tax-calculator";
import { taxTimeFor } from "@shared/tax-time";
import { BILLS } from "./checklist";
import { claimNote, myTaxRows, needsReceipt } from "./expenses";
import { api } from "./api";
import type { Data } from "./store";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
const longDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
const table = (head: string[], rows: string[][]) =>
  `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;

const CSS = `
  body { font-family: -apple-system, Helvetica, sans-serif; color: #1f1427; font-size: 11px; }
  h1 { font-size: 26px; margin: 0 0 4px; color: #2a1538; }
  h2 { font-size: 17px; margin: 0 0 8px; color: #2a1538; page-break-before: always; }
  p { margin: 0 0 8px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th, td { text-align: left; padding: 4px 6px; border-bottom: 1px solid #eadfd2; vertical-align: top; }
  th { background: #f7eadc; }
  .muted { color: #665a6e; }
  .receipt { page-break-inside: avoid; margin-bottom: 16px; }
  .receipt img { max-width: 100%; max-height: 820px; }
  figure { margin: 16px 0; page-break-before: always; }
  pre { white-space: pre-wrap; overflow-wrap: anywhere; font: 11px/1.5 -apple-system, Helvetica, sans-serif; }
  figure img { max-width: 100%; max-height: 820px; }
`;

/** Every record for the settings FY in one PDF, opened in the share sheet (Files, Mail, AirDrop). */
export const shareReceiptPack = async (data: Data, summary: TaxSummary) => {
  const { settings, expenses, assets, wfhEntries } = data;
  const fy = settings.financialYear;
  const record = taxTimeFor(settings);
  const sorted = [...expenses].sort((a, b) => a.date.localeCompare(b.date));
  const rows = myTaxRows(data, summary);
  const filled = new Set(record.filledDays ?? []);

  // Parse original emails on the server, using the same safe renderer as the web.
  // A failed fetch aborts export so missing evidence isn't silently reported as present.
  const receipts = await api<{ html: string; missing: string[] }>(`/api/mobile/receipt-pack?fy=${fy}`);

  const missing = sorted.filter(needsReceipt);
  const claimed = (e: Expense) => (isCoveredByFixedRate(e, settings.wfhMethod) ? 0 : e.claimableAmount);
  const hours = wfhEntries.reduce((s, e) => s + e.hours, 0);

  const html = `<html><head><meta charset="utf-8" /><style>${CSS}</style></head><body>
    <h1>Receipt pack · FY ${fy}</h1>
    <p class="muted">${esc(settings.occupation || "Employee")} · made with Ledgr on ${esc(longDate(new Date().toISOString().slice(0, 10)))}. Estimates based on ATO rules, not tax advice.</p>
    ${table(["myTax label", "Amount"], [...rows.map((r) => [r.item, formatCurrency(r.amount)]), ["Total deductions", formatCurrency(rows.reduce((s, r) => s + r.amount, 0))]])}
    <p>${expenses.length} expenses · ${receipts.missing.length} without stored evidence · ${hours.toLocaleString("en-AU")} hours worked from home · ${assets.length} depreciating assets</p>

    <h2>Expenses</h2>
    ${table(
      ["Date", "Item", "Category", "Paid", "Claim", "Claimed", "Receipt"],
      sorted.map((e) => [
        longDate(e.date),
        e.description,
        EXPENSE_CATEGORIES[e.category]?.label ?? e.category,
        formatCurrency(e.amount),
        claimNote(e, settings.wfhMethod),
        formatCurrency(claimed(e)),
        needsReceipt(e) ? "MISSING" : e.hasReceipt || e.receiptDataUrl ? "Yes" : "-",
      ])
    )}

    <h2>Expenses without a receipt</h2>
    ${missing.length ? table(["Date", "Item", "Paid", "Claimed"], missing.map((e) => [longDate(e.date), e.description, formatCurrency(e.amount), formatCurrency(claimed(e))])) : "<p>None. Every claimed expense has a receipt.</p>"}

    <h2>Work-from-home diary</h2>
    <p>Method: ${settings.wfhMethod === "fixed_rate" ? "fixed rate, 70c an hour" : "actual costs"} · ${hours.toLocaleString("en-AU")} hours over ${wfhEntries.length} days.${filled.size ? " Days marked * were filled from the usual week and confirmed against other records." : ""}</p>
    ${settings.wfhMethod === "fixed_rate" ? `<p>Running-cost bills kept: ${BILLS.map((b) => `${b.label} ${record.bills?.[b.key] ? "yes" : "no"}`).join(" · ")}</p>` : ""}
    ${table(["Date", "Hours"], [...wfhEntries].sort((a, b) => a.date.localeCompare(b.date)).map((e) => [`${longDate(e.date)}${filled.has(e.date) ? " *" : ""}`, String(e.hours)]))}

    <h2>Depreciation schedule</h2>
    ${assets.length ? table(
      ["Asset", "Bought", "Cost", "Work use", "Method", "Life", `FY ${fy} deduction`],
      assets.map((a) => [
        a.name,
        longDate(a.purchaseDate),
        formatCurrency(a.purchasePrice),
        `${a.workUsePercent}%`,
        a.depreciationMethod === "prime_cost" ? "Prime cost" : "Diminishing value",
        `${a.effectiveLifeYears} yrs (${ASSET_EFFECTIVE_LIVES[a.assetType]?.label ?? a.assetType})`,
        formatCurrency(calculateCurrentYearDepreciation(a, fy)),
      ])
    ) : "<p>No depreciating assets.</p>"}

    <h2>Receipts</h2>
    <p>The original emails, attachments and PDFs are available from Original receipts (ZIP) in the app.</p>
    ${receipts.html || "<p>No receipts stored.</p>"}
  </body></html>`;

  const { uri } = await Print.printToFileAsync({ html, margins: { left: 36, right: 36, top: 36, bottom: 36 } });
  const out = new File(Paths.cache, `Ledgr receipt pack FY ${fy}.pdf`);
  await new File(uri).move(out, { overwrite: true });
  await Sharing.shareAsync(out.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: `Receipt pack FY ${fy}` });
};
