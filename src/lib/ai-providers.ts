import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import { createHmac } from "node:crypto";
import { generateText, type LanguageModel, type ModelMessage } from "ai";

export const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

// A purpose-specific key keeps the Cloudflare bridge separate from login
// credentials. It is stored as LEDGR_API_KEY on the private Worker.
const cloudflareKey = process.env.CLOUDFLARE_AI_API_KEY || (process.env.AUTH_SECRET
  ? createHmac("sha256", process.env.AUTH_SECRET).update("ledgr:cloudflare-ai:v1").digest("hex")
  : "");
const cloudflare = createOpenAI({
  name: "cloudflare",
  apiKey: cloudflareKey || "unconfigured",
  baseURL: process.env.CLOUDFLARE_AI_BASE_URL || "https://unconfigured.invalid/v1",
});

export const models = {
  primary: google("gemini-3.5-flash"),
  // ponytail: must be a vision model — receipt scans send images
  quality: groq("qwen/qwen3.8-27b"),
  cloudflareText: cloudflare.chat("@cf/openai/gpt-oss-120b"),
  cloudflareVision: cloudflare.chat("@cf/google/gemma-4-26b-a4b-it"),
  mistral: cloudflare.chat("@cf/mistralai/mistral-small-3.1-24b-instruct"),
  fallback: google("gemini-3.1-flash-lite"),
  budget: google("gemma-4-31b-it"),
} as const;

export type ModelKey = keyof typeof models;

export function getModel(key: ModelKey = "primary"): LanguageModel {
  return models[key];
}

export const MODEL_LABELS: Record<ModelKey, string> = {
  primary: "Gemini 3.5 Flash",
  quality: "Qwen 3.8 27B",
  cloudflareText: "GPT-OSS 120B · Cloudflare",
  cloudflareVision: "Gemma 4 · Cloudflare",
  mistral: "Mistral Small 3.1 · Cloudflare",
  fallback: "Gemini 3.1 Flash Lite",
  budget: "Gemma 4",
};

export const hasAiProvider = (): boolean => !!(
  process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GROQ_API_KEY ||
  (process.env.CLOUDFLARE_AI_BASE_URL && cloudflareKey)
);

const configured = (key: ModelKey): boolean => key === "quality" ? !!process.env.GROQ_API_KEY
  : ["cloudflareText", "cloudflareVision", "mistral"].includes(key) ? !!(process.env.CLOUDFLARE_AI_BASE_URL && cloudflareKey)
  : !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const failedUntil = new Map<ModelKey, number>();

/**
 * generateText through the model chain, returning the first success.
 * Keeps working when a whole provider is down (e.g. Gemini spend cap
 * exhausted — Groq picks it up).
 */
export const generateTextWithFallback = async (
  messages: ModelMessage[],
  maxOutputTokens: number,
  options: { signal?: AbortSignal; modelTimeoutMs?: number; system?: string } = {}
): Promise<{ text: string; modelKey: ModelKey }> => {
  const hasImages = messages.some(message => Array.isArray(message.content) &&
    message.content.some(part => part.type === "image" || part.type === "file"));
  const chain: ModelKey[] = ["primary", "quality", "cloudflareText", "cloudflareVision", "mistral", "fallback", "budget"];
  const totalSignal = options.signal || AbortSignal.timeout(45_000);
  let lastError: unknown;
  for (const modelKey of chain) {
    if (totalSignal.aborted) break;
    if (!configured(modelKey) || (failedUntil.get(modelKey) || 0) > Date.now()) continue;
    // Workers' Mistral endpoint and GPT-OSS accept text. Image scans use the
    // actual vision endpoints instead of silently losing the receipt image.
    if (hasImages && (modelKey === "cloudflareText" || modelKey === "mistral")) continue;
    try {
      const { text } = await generateText({
        model: models[modelKey],
        messages,
        system: options.system,
        maxOutputTokens,
        maxRetries: 0,
        abortSignal: AbortSignal.any([totalSignal, AbortSignal.timeout(options.modelTimeoutMs || (hasImages && modelKey === "cloudflareVision" ? 18_000 : 12_000))]),
        // qwen3.8 is a thinking model; without this it spends the whole
        // token budget reasoning and returns nothing. Google ignores it.
        providerOptions: { groq: { reasoningEffort: "none" } },
      });
      if (!text.trim()) throw new Error("Model returned no answer");
      failedUntil.delete(modelKey);
      return { text, modelKey };
    } catch (error) {
      lastError = error;
      if (totalSignal.aborted) break;
      // Briefly avoid repeating an outage or exhausted quota on every request.
      // Keep this per model: another model may have a separate free allowance.
      failedUntil.set(modelKey, Date.now() + 60_000);
      console.warn(`AI model "${modelKey}" unavailable; trying the next backup.`);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("All AI models unavailable");
};
