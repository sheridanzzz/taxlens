import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { api } from "./api";
import type { EmailEvidence } from "@shared/receipt-evidence";
import type { FinancialYear } from "@shared/types";

export type StoredEvidence = { dataUrl: string | null; email: EmailEvidence | null; previewError?: string };
export const fetchReceiptEvidence = (expenseId: string) =>
  api<StoredEvidence>(`/api/mobile/receipt-evidence?id=${encodeURIComponent(expenseId)}`);

export const shareOriginalReceipts = async (fy: FinancialYear) => {
  const archive = await api<{ base64: string; missing: number }>(`/api/mobile/receipt-archive?fy=${fy}`);
  const file = new File(Paths.cache, `Ledgr original receipts FY ${fy}.zip`);
  file.write(archive.base64, { encoding: "base64" });
  await Sharing.shareAsync(file.uri, { mimeType: "application/zip", UTI: "public.zip-archive", dialogTitle: `Original receipts FY ${fy}` });
  return archive.missing;
};

/** One expense's stored receipt (photo, PDF or original email) as a data URL; null if none. */
export const fetchReceipt = (expenseId: string) =>
  api<string | null>(`/api/mobile/receipt?id=${encodeURIComponent(expenseId)}`);

const EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "message/rfc822": "eml",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

/** Split without a regex: receipts can be megabytes long. */
export const parseDataUrl = (url: string) => {
  const comma = url.indexOf(",");
  const header = url.slice(5, comma);
  if (!url.startsWith("data:") || comma < 0 || !header.endsWith(";base64")) return null;
  return { mime: header.slice(0, -7), base64: url.slice(comma + 1) };
};

export const receiptKind = (mime: string) =>
  mime.startsWith("image/") ? "Photo" : mime === "application/pdf" ? "PDF" : mime === "message/rfc822" ? "Email" : "File";

const safeName = (name: string) => name.replace(/[^\w .-]+/g, "").trim().slice(0, 60) || "receipt";

/** Writes a data URL to the cache and opens the iOS share sheet (which previews PDFs). */
export const shareDataUrl = async (dataUrl: string, name: string) => {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) throw new Error("This receipt couldn't be read.");
  const extension = EXT[parsed.mime] ?? "bin";
  const basename = safeName(name);
  const file = new File(Paths.cache, basename.toLowerCase().endsWith(`.${extension}`) ? basename : `${basename}.${extension}`);
  file.write(parsed.base64, { encoding: "base64" });
  await Sharing.shareAsync(file.uri, {
    mimeType: parsed.mime,
    UTI: parsed.mime === "application/pdf" ? "com.adobe.pdf" : undefined,
    dialogTitle: name,
  });
};
