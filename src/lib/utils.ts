import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export { toLocalDate, isAiScanned } from "./constants"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
