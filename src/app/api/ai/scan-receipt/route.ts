import { NextRequest, NextResponse } from "next/server";
import { chatViaOpenRouter, isOpenRouterConfigured } from "@/lib/openrouter";
import { chatViaGemini, isGeminiConfigured } from "@/lib/gemini";
import {
  EXPENSE_CATEGORIES,
  INSTANT_DEDUCTION_THRESHOLD,
  ASSET_EFFECTIVE_LIVES,
} from "@/lib/constants";
import type {
  ExpenseCategory,
  AssetType,
  DepreciationMethod,
  ReceiptScanResult,
} from "@/lib/types";

export const maxDuration = 60;

const VALID_CATEGORIES = Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[];
const VALID_ASSET_TYPES = Object.keys(ASSET_EFFECTIVE_LIVES) as AssetType[];

const buildPrompt = (occupation: string): string =>
  `You are an expert Australian tax deduction advisor. Analyze this receipt/invoice and extract purchase details, then recommend the OPTIMAL claiming strategy that maximizes the user's tax savings.

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
  "suggestedDepreciationMethod": "diminishing or prime_cost — PICK THE ONE THAT SAVES THE MOST over the lifetime",
  "depreciationExplanation": "If depreciated: explain why you chose this method. Compare total lifetime deductions for both methods. State first-year and total savings. If the item will likely be replaced before its effective life ends, factor that into the recommendation.",
  "claimAdvice": "Concise strategy: (1) instant or depreciated, (2) first-year deduction amount for the recommended method, (3) total lifetime claimable amount, (4) one key tip to maximize the claim"
}

ATO depreciation rules:
- Items costing $${INSTANT_DEDUCTION_THRESHOLD} or LESS: instant full deduction (no depreciation needed)
- Items costing MORE than $${INSTANT_DEDUCTION_THRESHOLD}: MUST be depreciated over the effective life
- Diminishing Value method: deduction = base_value × (200% ÷ effective_life) — higher deductions in early years, better if item is replaced early
- Prime Cost method: deduction = cost × (100% ÷ effective_life) — equal deductions each year, better for long-held items
- IMPORTANT: Diminishing Value gives higher FIRST YEAR deductions but the same TOTAL over the full life. Choose based on whether the user benefits more from front-loaded deductions (usually yes).

ATO effective lives: ${VALID_ASSET_TYPES.map((t) => `${t}=${ASSET_EFFECTIVE_LIVES[t].years}yr`).join(", ")}

Rules:
- amount should be the TOTAL paid (including GST)
- date should be extracted from the receipt, or "unknown" if not visible
- suggestedCategory must be one of the listed values
- suggestedAssetType: pick the CLOSEST match from the list — consider the actual product, not just the store. Use "other" only if nothing fits
- suggestedEffectiveLife: use the ATO effective life for the matched asset type. If the product's real-world lifespan differs significantly, note this
- suggestedDepreciationMethod: ALWAYS recommend the method that gives the user the best outcome. For most items, "diminishing" gives higher first-year savings
- isRelevantToOccupation: consider if a "${occupation}" would reasonably use this for work
- suggestedWorkUsePercent: 100 if clearly work-only, lower if likely mixed personal/work use. Be realistic — an office chair used at a home office might be 80-90% work
- Return ONLY valid JSON, no markdown fences or extra text`;

export async function POST(request: NextRequest) {
  if (!isOpenRouterConfigured() && !isGeminiConfigured()) {
    return NextResponse.json(
      { error: "AI receipt scanning is not configured on the server." },
      { status: 503 }
    );
  }

  let body: { base64: string; mimeType: string; occupation: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { base64, mimeType, occupation } = body;
  if (!base64 || !mimeType || !occupation) {
    return NextResponse.json(
      { error: "Missing required fields: base64, mimeType, occupation" },
      { status: 400 }
    );
  }

  try {
    const prompt = buildPrompt(occupation);

    let text: string;

    if (isOpenRouterConfigured()) {
      try {
        const messages = [
          {
            role: "user" as const,
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64}` },
              },
            ],
          },
        ];
        text = await chatViaOpenRouter(messages);
      } catch (openRouterError) {
        console.warn("OpenRouter failed, trying Gemini fallback:", openRouterError);
        if (!isGeminiConfigured()) throw openRouterError;
        text = await chatViaGemini(prompt, base64, mimeType);
      }
    } else {
      text = await chatViaGemini(prompt, base64, mimeType);
    }

    const stripped = text
      .replace(/```(?:json)?\s*/gi, "")
      .replace(/```/g, "")
      .trim();

    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "AI returned unparseable response. Try again." },
        { status: 502 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsed: any;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json(
        { error: "AI returned malformed JSON. Try again." },
        { status: 502 }
      );
    }

    const category: ExpenseCategory = VALID_CATEGORIES.includes(parsed.suggestedCategory)
      ? parsed.suggestedCategory
      : "other";

    const amount =
      typeof parsed.amount === "number"
        ? parsed.amount
        : parseFloat(parsed.amount) || 0;
    const isDepreciation = amount > INSTANT_DEDUCTION_THRESHOLD;

    const assetType: AssetType = VALID_ASSET_TYPES.includes(parsed.suggestedAssetType)
      ? parsed.suggestedAssetType
      : "other";

    const effectiveLife =
      typeof parsed.suggestedEffectiveLife === "number" && parsed.suggestedEffectiveLife > 0
        ? parsed.suggestedEffectiveLife
        : ASSET_EFFECTIVE_LIVES[assetType].years;

    const depMethod: DepreciationMethod =
      parsed.suggestedDepreciationMethod === "prime_cost" ? "prime_cost" : "diminishing";

    const result: ReceiptScanResult = {
      itemName: parsed.itemName || "Unknown Item",
      amount,
      date:
        parsed.date && parsed.date !== "unknown"
          ? parsed.date
          : new Date().toISOString().split("T")[0],
      storeName: parsed.storeName || "Unknown",
      suggestedCategory: category,
      claimType: isDepreciation ? "depreciation" : "full",
      isRelevantToOccupation: !!parsed.isRelevantToOccupation,
      relevanceExplanation: parsed.relevanceExplanation || "",
      claimAdvice: parsed.claimAdvice || "",
      suggestedWorkUsePercent:
        typeof parsed.suggestedWorkUsePercent === "number"
          ? parsed.suggestedWorkUsePercent
          : 100,
      rawItems: Array.isArray(parsed.rawItems) ? parsed.rawItems : [],
      suggestedAssetType: isDepreciation ? assetType : undefined,
      suggestedEffectiveLife: isDepreciation ? effectiveLife : undefined,
      suggestedDepreciationMethod: isDepreciation ? depMethod : undefined,
      depreciationExplanation: isDepreciation ? (parsed.depreciationExplanation || "") : undefined,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Receipt scan failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
