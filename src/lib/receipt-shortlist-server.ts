import { createHash } from "node:crypto";
import { generateTextWithFallback, hasAiProvider } from "./ai-providers";
import { ruleSuggestion, parseShortlist, shortlistPrompt, SHORTLIST_INSTRUCTIONS, type ShortlistProfile, type ReceiptSuggestion } from "./receipt-shortlist";
import type { AirtailReceipt } from "./airtail-receipt";

const cache = new Map<string, { expires: number; suggestions: Record<string, ReceiptSuggestion> }>();
export async function suggestReceiptBatch(receipts: AirtailReceipt[], profile: ShortlistProfile, useAi: boolean) {
  const rules = Object.fromEntries(receipts.map(receipt => [receipt.id, ruleSuggestion(receipt, profile)]));
  if (!useAi || !receipts.length || !hasAiProvider()) return { suggestions: rules, mode: "rules" as const };
  const key = createHash("sha256").update(JSON.stringify({ receipts, profile })).digest("hex");
  const hit = cache.get(key); if (hit && hit.expires > Date.now()) return { suggestions: hit.suggestions, mode: "ai" as const };
  const candidates = receipts.filter(receipt => rules[receipt.id].bucket !== "likely_personal");
  if (!candidates.length) return { suggestions: rules, mode: "rules" as const };
  try {
    const { text } = await generateTextWithFallback([{ role: "user", content: shortlistPrompt(candidates, profile) }], Math.min(7000, candidates.length * 120 + 100), { signal: AbortSignal.timeout(22_000), modelTimeoutMs: 8_000, system: SHORTLIST_INSTRUCTIONS });
    const suggestions = { ...rules, ...parseShortlist(text, candidates, profile) };
    if (cache.size >= 128) cache.delete(cache.keys().next().value!);
    cache.set(key, { expires: Date.now() + 60 * 60 * 1000, suggestions });
    return { suggestions, mode: "ai" as const };
  } catch { return { suggestions: rules, mode: "rules" as const }; }
}
