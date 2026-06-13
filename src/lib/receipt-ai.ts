import type { ReceiptScanResult, ExpenseCategory, AssetType, DepreciationMethod } from "./types";
import { EXPENSE_CATEGORIES, INSTANT_DEDUCTION_THRESHOLD, ASSET_EFFECTIVE_LIVES } from "./constants";

const VALID_CATEGORIES = Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[];
const VALID_ASSET_TYPES = Object.keys(ASSET_EFFECTIVE_LIVES) as AssetType[];

const GEMINI_MODEL = "gemini-2.5-flash";

// ── Server-side scan via OpenRouter (no API key needed from user) ────

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

// ── Client-side scan via Gemini (user provides their own key) ────────

const buildPrompt = (occupation: string): string => `You are an Australian tax deduction assistant. Analyze this receipt/invoice and extract purchase details.

The user's occupation is: "${occupation}"

Return a JSON object with EXACTLY these fields:
{
  "itemName": "Primary item purchased (concise name)",
  "amount": 0.00,
  "date": "YYYY-MM-DD",
  "storeName": "Store/vendor name",
  "suggestedCategory": "one of: ${VALID_CATEGORIES.join(", ")}",
  "isRelevantToOccupation": true/false,
  "relevanceExplanation": "1-2 sentence explanation of why this is or isn't claimable as a tax deduction for their occupation",
  "suggestedWorkUsePercent": 100,
  "rawItems": ["list", "of", "individual", "line", "items", "from", "receipt"],

  "suggestedAssetType": "one of: ${VALID_ASSET_TYPES.join(", ")}",
  "suggestedEffectiveLife": 10,
  "suggestedDepreciationMethod": "diminishing or prime_cost",
  "claimAdvice": "Detailed advice including: (1) whether this is an instant claim or must be depreciated, (2) if depreciated, calculate the FIRST YEAR deduction for BOTH methods and state which saves more, (3) mention any tips for maximizing the claim"
}

ATO depreciation rules:
- Items costing $${INSTANT_DEDUCTION_THRESHOLD} or LESS: instant full deduction (no depreciation needed)
- Items costing MORE than $${INSTANT_DEDUCTION_THRESHOLD}: MUST be depreciated over the effective life
- Diminishing Value method: deduction = base_value × (200% ÷ effective_life) — higher deductions in early years, best for items you'll replace sooner
- Prime Cost method: deduction = cost × (100% ÷ effective_life) — equal deductions each year, higher total over time for long-lived assets
- For the first year, calculate assuming the item is held for the remaining days in the financial year from purchase date

ATO effective lives (use these): ${VALID_ASSET_TYPES.map((t) => `${t}=${ASSET_EFFECTIVE_LIVES[t].years}yr`).join(", ")}

Rules:
- amount should be the TOTAL paid (including GST)
- date should be extracted from the receipt, or "unknown" if not visible
- suggestedCategory must be one of the listed values
- suggestedAssetType: pick the closest match from the list, use "other" if none fit
- suggestedEffectiveLife: use the ATO effective life for the asset type
- suggestedDepreciationMethod: recommend "diminishing" if the user will likely replace the item within its effective life (e.g., tech items), recommend "prime_cost" for long-lasting items (e.g., furniture). Explain why in claimAdvice.
- isRelevantToOccupation: consider if a "${occupation}" would reasonably use this for work
- suggestedWorkUsePercent: 100 if clearly work-only, lower if likely mixed personal/work use
- Be honest if the item doesn't appear to be work-related
- Return ONLY valid JSON, no markdown fences or extra text`;

export interface ScanInput {
  base64: string;
  mimeType: string;
}

export const scanReceipt = async (
  input: ScanInput,
  apiKey: string,
  occupation: string
): Promise<ReceiptScanResult> => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: buildPrompt(occupation) },
            { inline_data: { mime_type: input.mimeType, data: input.base64 } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    if (response.status === 400 && errorBody.includes("API_KEY")) {
      throw new Error("Invalid API key. Check your Gemini key in Settings.");
    }
    if (response.status === 403) {
      throw new Error("API key doesn't have access to Gemini. Enable the Generative Language API in Google Cloud Console.");
    }
    if (response.status === 429) {
      throw new Error("Rate limited. Please wait a moment and try again.");
    }
    throw new Error(`Gemini API error (${response.status}): ${errorBody.slice(0, 200)}`);
  }

  const data = await response.json();

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const candidate = data.candidates?.[0];
  if (!candidate?.content?.parts) {
    console.error("[Ledgr] Gemini response has no candidate parts:", JSON.stringify(data).slice(0, 500));
    const blockReason = candidate?.finishReason ?? data.promptFeedback?.blockReason;
    throw new Error(
      blockReason
        ? `Gemini blocked the request (${blockReason}). Try a different receipt.`
        : "Empty response from Gemini. The receipt may be unreadable — try a clearer photo."
    );
  }

  const parts = candidate.content.parts as any[];
  const textParts = parts.filter((p) => typeof p.text === "string" && !p.thought);
  const content = textParts.map((p) => p.text).join("");

  console.debug("[Ledgr] Gemini raw text:", content.slice(0, 500));

  if (!content) {
    console.error("[Ledgr] No text in response parts:", JSON.stringify(parts.map((p: any) => ({ thought: p.thought, hasText: !!p.text, textLen: p.text?.length }))));
    throw new Error("Empty response from Gemini. The receipt may be unreadable — try a clearer photo.");
  }

  const stripped = content
    .replace(/```(?:json)?\s*/gi, "")
    .replace(/```/g, "")
    .trim();

  const jsonMatch = stripped.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("[Ledgr] No JSON found in stripped content:", stripped.slice(0, 300));
    throw new Error("Could not parse AI response. Please try again.");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("[Ledgr] JSON parse failed:", (e as Error).message, jsonMatch[0].slice(0, 200));
    throw new Error("AI returned malformed data. Please try again.");
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const category: ExpenseCategory = VALID_CATEGORIES.includes(parsed.suggestedCategory)
    ? parsed.suggestedCategory
    : "other";

  const amount = typeof parsed.amount === "number" ? parsed.amount : parseFloat(parsed.amount) || 0;
  const isDepreciation = amount > INSTANT_DEDUCTION_THRESHOLD;

  const assetType: AssetType = VALID_ASSET_TYPES.includes(parsed.suggestedAssetType)
    ? parsed.suggestedAssetType
    : "other";

  const effectiveLife = typeof parsed.suggestedEffectiveLife === "number" && parsed.suggestedEffectiveLife > 0
    ? parsed.suggestedEffectiveLife
    : ASSET_EFFECTIVE_LIVES[assetType].years;

  const depMethod: DepreciationMethod =
    parsed.suggestedDepreciationMethod === "prime_cost" ? "prime_cost" : "diminishing";

  return {
    itemName: parsed.itemName || "Unknown Item",
    amount,
    date: parsed.date && parsed.date !== "unknown" ? parsed.date : new Date().toISOString().split("T")[0],
    storeName: parsed.storeName || "Unknown",
    suggestedCategory: category,
    claimType: isDepreciation ? "depreciation" : "full",
    isRelevantToOccupation: !!parsed.isRelevantToOccupation,
    relevanceExplanation: parsed.relevanceExplanation || "",
    claimAdvice: parsed.claimAdvice || "",
    suggestedWorkUsePercent: typeof parsed.suggestedWorkUsePercent === "number"
      ? parsed.suggestedWorkUsePercent
      : 100,
    rawItems: Array.isArray(parsed.rawItems) ? parsed.rawItems : [],
    suggestedAssetType: isDepreciation ? assetType : undefined,
    suggestedEffectiveLife: isDepreciation ? effectiveLife : undefined,
    suggestedDepreciationMethod: isDepreciation ? depMethod : undefined,
  };
};
