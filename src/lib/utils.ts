import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Expense } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// the receipt scanner stamps notes with "AI scan:" — single source of truth
// for the AI-scanned markers across dashboard, expenses KPI, and table rows
export const isAiScanned = (e: Expense) => e.notes?.startsWith("AI scan:") ?? false

// YYYY-MM-DD in the user's own timezone. toISOString() is UTC, which is still
// yesterday in Australia until 10–11am — so local dates must never go through it.
export const toLocalDate = (d: Date = new Date()) => d.toLocaleDateString("en-CA")
