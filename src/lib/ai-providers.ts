import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export const models = {
  primary: google("gemini-3.5-flash"),
  quality: groq("llama-3.3-70b-versatile"),
  fallback: google("gemini-3.1-flash-lite"),
  budget: google("gemma-4-31b-it"),
} as const;

export type ModelKey = keyof typeof models;

export function getModel(key: ModelKey = "primary"): LanguageModel {
  return models[key];
}
