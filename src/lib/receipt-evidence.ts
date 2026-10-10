import PostalMime from "postal-mime";
import { zipSync, strToU8 } from "fflate";
import type { Expense } from "./types";
import { EXPENSE_CATEGORIES } from "./constants";

export const escapeReceiptHtml = (value: string) => value.replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const receiptMime = (url: string) => /^data:([^;,]+);base64,/.exec(url)?.[1]?.toLowerCase() ?? "";
export const receiptBytes = (url: string): Uint8Array => {
  if (!receiptMime(url) || url.length > 20_000_000) throw new Error("Invalid receipt format or size.");
  return Uint8Array.from(atob(url.slice(url.indexOf(",") + 1)), c => c.charCodeAt(0));
};
export const receiptExtension = (url: string) => ({ "application/pdf": "pdf", "message/rfc822": "eml",
  "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg", "image/webp": "webp", "image/gif": "gif" })[receiptMime(url)] ?? "bin";

export interface EvidenceAttachment { name: string; mimeType: string; dataUrl: string }
export interface EvidenceMessage { subject: string; from: string; date: string; text: string }
export interface EmailEvidence { messages: EvidenceMessage[]; attachments: EvidenceAttachment[] }

const htmlText = (html: string) => html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
  .replace(/<\s*br\b[^>]*>|<\/(?:p|div|tr|h[1-6])\s*>/gi, "\n").replace(/<[^>]*>/g, "")
  .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, e: string) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " })[e]!)
  .replace(/&#(x[\da-f]+|\d+);/gi, (_, e: string) => {
    const code = e[0].toLowerCase() === "x" ? parseInt(e.slice(1), 16) : parseInt(e, 10);
    return code <= 0x10ffff ? String.fromCodePoint(code) : "";
  }).trim();

export async function readEmailEvidence(url: string): Promise<EmailEvidence> {
  if (receiptMime(url) !== "message/rfc822") throw new Error("This receipt is not an email.");
  const result: EmailEvidence = { messages: [], attachments: [] };
  const parse = async (bytes: Uint8Array, depth: number) => {
    if (depth > 4 || result.messages.length >= 20) return;
    const email = await PostalMime.parse(bytes, { forceRfc822Attachments: true, attachmentEncoding: "base64", maxNestingDepth: 30 });
    result.messages.push({ subject: email.subject ?? "Receipt email", from: email.from?.address ?? "",
      date: email.date ?? "", text: email.text?.trim() || htmlText(email.html ?? "") });
    for (const a of email.attachments) {
      const content = a.content as string;
      // Only supported receipt MIME types are rendered. Everything else remains
      // a download; email HTML and remote tracking images are never executed.
      // Mail.app bundles often label original .eml files as octet-stream.
      // Parsing them still yields plain text only, with the original preserved.
      const mimeType = /\.eml$/i.test(a.filename ?? "") ? "message/rfc822" : a.mimeType.toLowerCase();
      const safeMime = /^(image\/(png|jpeg|jpg|gif|webp)|application\/pdf|message\/rfc822)$/.test(mimeType) ? mimeType : "application/octet-stream";
      const dataUrl = `data:${safeMime};base64,${content}`;
      result.attachments.push({ name: (a.filename || `attachment-${result.attachments.length + 1}`).replace(/[\\/\x00-\x1f]/g, "_"), mimeType, dataUrl });
      if (mimeType === "message/rfc822") await parse(receiptBytes(dataUrl), depth + 1);
    }
  };
  await parse(receiptBytes(url), 0);
  return result;
}

/** Every original is retained byte for byte; the manifest also lists missing evidence. */
export function makeReceiptArchive(expenses: Expense[], fy: string): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  const entries = expenses.map(e => {
    const name = e.receiptDataUrl ? `receipts/${e.date}-${e.id.replace(/[^a-zA-Z0-9-]/g, "_")}.${receiptExtension(e.receiptDataUrl)}` : null;
    if (name) files[name] = receiptBytes(e.receiptDataUrl!);
    return { id: e.id, date: e.date, description: e.description, amount: e.amount, workUsePercent: e.workUsePercent,
      reviewStatus: e.reviewStatus ?? null, originalFile: name, evidenceStatus: name ? "included" : "missing" };
  });
  files["manifest.json"] = strToU8(JSON.stringify({ financialYear: fy, generatedAt: new Date().toISOString(), entries }, null, 2));
  return zipSync(files, { level: 0 });
}

export async function makeReceiptFiguresHtml(expenses: Expense[], downloadLinks = true) {
  const included = expenses.filter(e => e.receiptDataUrl);
  const figures: string[] = [];
  for (const e of included) {
    const url = e.receiptDataUrl!;
    let content = downloadLinks ? `<a href="${escapeReceiptHtml(url)}" download="receipt-${escapeReceiptHtml(e.id)}.${receiptExtension(url)}">Download original receipt</a>` : "";
    if (receiptMime(url).startsWith("image/")) content += `<p><img src="${escapeReceiptHtml(url)}" alt="Receipt"></p>`;
    if (receiptMime(url) === "application/pdf") content += `<p>Original PDF included in the archive. Open the PDF to view every page.</p>`;
    if (receiptMime(url) === "message/rfc822") {
      try {
        const email = await readEmailEvidence(url);
        content += email.messages.map(m => `<h3>${escapeReceiptHtml(m.subject)}</h3><p class="meta">${escapeReceiptHtml(m.from)} · ${escapeReceiptHtml(m.date)}</p><pre>${escapeReceiptHtml(m.text)}</pre>`).join("");
        content += email.attachments.map(a => downloadLinks
          ? `<p><a href="${escapeReceiptHtml(a.dataUrl)}" download="${escapeReceiptHtml(a.name)}">${escapeReceiptHtml(a.name)}</a></p>`
          : `<p>Original attachment: ${escapeReceiptHtml(a.name)} (included in the email archive)</p>`).join("");
      } catch {
        content += `<p>Email preview unavailable. The complete original email and its attachments are included in the archive.</p>`;
      }
    }
    figures.push(`<figure><figcaption><strong>${escapeReceiptHtml(e.description)}</strong> — ${escapeReceiptHtml(e.date)} · $${e.amount.toFixed(2)} · ${escapeReceiptHtml(EXPENSE_CATEGORIES[e.category]?.label ?? e.category)} · ${e.workUsePercent}% work use</figcaption>${content}</figure>`);
  }
  return figures.join("");
}

export async function makeReceiptPackHtml(expenses: Expense[], fy: string, archiveUrl: string) {
  const included = expenses.filter(e => e.receiptDataUrl);
  const missing = expenses.filter(e => !e.receiptDataUrl);
  const figures = await makeReceiptFiguresHtml(expenses);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Ledgr receipt pack — FY ${escapeReceiptHtml(fy)}</title><style>
body{font-family:system-ui,sans-serif;max-width:900px;margin:2rem auto;padding:0 1rem;color:#21152c}h1{font-size:1.5rem}h3{font-size:1rem}.meta{color:#666;font-size:.85rem}figure{margin:2rem 0;border-top:1px solid #ddd;padding-top:1rem}figcaption{margin-bottom:1rem}img{max-width:100%;max-height:480px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.6 system-ui}a{overflow-wrap:anywhere}li{margin:.7rem 0}@media print{.actions{display:none}figure{break-before:page}}
</style></head><body><h1>Receipt pack — FY ${escapeReceiptHtml(fy)}</h1><p class="meta">${included.length} originals included · ${missing.length} entries without stored evidence</p>
<div class="actions"><button onclick="window.print()">Print / Save as PDF</button> · <a href="${escapeReceiptHtml(archiveUrl)}" download="ledgr-receipts-FY${escapeReceiptHtml(fy)}.zip">Download all original receipts (ZIP)</a></div>
<p>Email previews are readable below. The ZIP preserves original emails, their attachments and PDFs. Review work use and deductibility before lodging.</p>
${figures}${missing.length ? `<h2>Missing evidence</h2><ul>${missing.map(e => `<li>${escapeReceiptHtml(e.date)} · ${escapeReceiptHtml(e.description)} · $${e.amount.toFixed(2)}</li>`).join("")}</ul>` : ""}</body></html>`;
}
