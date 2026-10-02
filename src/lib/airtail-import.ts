import { v5 as uuidv5 } from "uuid";

export interface AirtailReceipt {
  id: string; vendor: string; amount: number; currency: string; category: string;
  date: string; subject: string; provider: "gmail" | "yahoo";
  confidence: number; status: string;
}
export interface ReceiptEvidence {
  subject: string; from: string; date: string | null; text: string; originalEmail: string;
  attachments: { name: string; mimeType: string; dataUrl: string }[];
}
export interface ImportedReceipt {
  id: string; description: string; merchant: string; amount: number; date: string; notes: string;
  receiptDataUrl: string;
}

const namespace = "311fba49-9c72-4e92-b030-86b1f4fc3a19";
export const airtailExpenseId = (transactionId: string) => uuidv5(`airtail:${transactionId}`, namespace);

export function prepareAirtailImport(receipt: AirtailReceipt, evidence: ReceiptEvidence, paidAud?: number): ImportedReceipt {
  if (!/^[a-f0-9]{24}$/.test(receipt.id) || !["gmail", "yahoo"].includes(receipt.provider)) throw new Error("Invalid receipt source.");
  const amount = receipt.currency === "AUD" ? receipt.amount : paidAud;
  if (amount === undefined || !Number.isFinite(amount) || amount <= 0) throw new Error("Enter the amount paid in AUD from your payment record.");
  if (!/^data:message\/rfc822;base64,[A-Za-z0-9+/=]+$/.test(evidence.originalEmail) || evidence.originalEmail.length > 20_000_000) throw new Error("Original receipt email is missing or too large.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(receipt.date) || !Number.isFinite(Date.parse(receipt.date)) || new Date(receipt.date).toISOString().slice(0, 10) !== receipt.date) throw new Error("Check the purchase date in Airtail before importing.");
  return {
    id: airtailExpenseId(receipt.id), description: `${receipt.vendor} — ${receipt.subject}`.slice(0, 240), merchant: receipt.vendor,
    amount: Math.round(amount * 100) / 100, date: receipt.date, receiptDataUrl: evidence.originalEmail,
    notes: `Airtail import: ${receipt.id}\nMailbox: ${receipt.provider}\nOriginal amount: ${receipt.amount} ${receipt.currency}\nSubject: ${evidence.subject}\nFrom: ${evidence.from}\nEmail date: ${evidence.date || "Unknown"}\n\n${evidence.text}`,
  };
}
