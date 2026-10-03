import { v5 as uuidv5 } from "uuid";
import { buildAirtailImport, type AirtailReceipt, type ReceiptEvidence, type ImportedReceipt } from "./airtail-receipt";

export type { AirtailReceipt, ReceiptEvidence, ImportedReceipt };

const namespace = "311fba49-9c72-4e92-b030-86b1f4fc3a19";
export const airtailExpenseId = (transactionId: string) => uuidv5(`airtail:${transactionId}`, namespace);

export function prepareAirtailImport(receipt: AirtailReceipt, evidence: ReceiptEvidence, paidAud?: number): ImportedReceipt {
  return buildAirtailImport(airtailExpenseId(receipt.id), receipt, evidence, paidAud);
}
