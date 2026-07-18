import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";

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
