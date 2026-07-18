import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { generateText, type LanguageModel, type ModelMessage } from "ai";

export const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export const models = {
  primary: google("gemini-3.5-flash"),
  // ponytail: must be a vision model — receipt scans send images
  quality: groq("qwen/qwen3.6-27b"),
  fallback: google("gemini-3.1-flash-lite"),
  budget: google("gemma-4-31b-it"),
} as const;

export type ModelKey = keyof typeof models;

export function getModel(key: ModelKey = "primary"): LanguageModel {
  return models[key];
}

export const MODEL_LABELS: Record<ModelKey, string> = {
  primary: "Gemini 3.5 Flash",
  quality: "Qwen 3.6 27B",
  fallback: "Gemini 3.1 Flash Lite",
  budget: "Gemma 4",
};

/**
 * generateText through the model chain, returning the first success.
 * Keeps working when a whole provider is down (e.g. Gemini spend cap
 * exhausted — Groq picks it up).
 */
export const generateTextWithFallback = async (
  messages: ModelMessage[],
  maxOutputTokens: number
): Promise<{ text: string; modelKey: ModelKey }> => {
  const chain: ModelKey[] = ["primary", "quality", "fallback", "budget"];
  let lastError: unknown;
  for (const modelKey of chain) {
    try {
      const { text } = await generateText({
        model: models[modelKey],
        messages,
        maxOutputTokens,
        maxRetries: 1,
        // qwen3.6 is a thinking model; without this it spends the whole
        // token budget reasoning and returns nothing. Google ignores it.
        providerOptions: { groq: { reasoningEffort: "none" } },
      });
      return { text, modelKey };
    } catch (error) {
      lastError = error;
      console.warn(
        `AI model "${modelKey}" failed:`,
        error instanceof Error ? error.message : error
      );
    }
  }
  throw lastError instanceof Error ? lastError : new Error("All AI models unavailable");
};
