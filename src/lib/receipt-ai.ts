import type { ReceiptScanResult } from "./types";

export interface ScanInput {
  base64: string;
  mimeType: string;
}

export const scanReceiptViaServer = async (
  input: ScanInput,
  occupation: string
): Promise<ReceiptScanResult> => {
  const response = await fetch("/api/ai/scan-receipt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      base64: input.base64,
      mimeType: input.mimeType,
      occupation,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: "Server error" }));
    throw new Error(data.error || `Server error (${response.status})`);
  }

  return response.json();
};
