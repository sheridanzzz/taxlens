import { toLocalDate } from "./constants";
import type { CgtTransaction, CgtAssetKind } from "./types";

/**
 * Generic CSV import for exchange and broker exports.
 *
 * ponytail: no per-provider parsers. Every exchange invents its own column
 * names and renames them without warning; one generic parser plus a mapping
 * step the user confirms handles all of them and never needs maintenance.
 */

export type CsvField =
  | "date"
  | "asset"
  | "side"
  | "quantity"
  | "unitPrice"
  | "total"
  | "fee";

/** Header text we'll guess each field from, lowercased, longest match wins. */
const SYNONYMS: Record<CsvField, string[]> = {
  date: ["date", "time", "timestamp", "trade date", "transaction date", "executed", "created at"],
  asset: ["asset", "symbol", "ticker", "market", "pair", "instrument", "code", "currency", "coin"],
  side: ["side", "type", "direction", "action", "operation", "buy/sell", "transaction type"],
  quantity: ["quantity", "qty", "units", "volume", "shares", "amount"],
  unitPrice: ["unit price", "price per unit", "price", "rate", "avg price", "average price"],
  total: ["total", "value", "gross amount", "net amount", "total value", "consideration", "aud value"],
  fee: ["fee", "fees", "brokerage", "commission", "commission amount"],
};

/** RFC-4180-ish: handles quoted fields, escaped quotes and embedded commas. */
export const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field.trim());
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field.trim());
      field = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field.trim());
  if (row.some((v) => v !== "")) rows.push(row);
  return rows;
};

/** Best-guess column index for each field, by header text. */
export const guessMapping = (
  headers: string[]
): Partial<Record<CsvField, number>> => {
  const lower = headers.map((h) => h.toLowerCase().trim());
  const mapping: Partial<Record<CsvField, number>> = {};
  const taken = new Set<number>();

  for (const field of Object.keys(SYNONYMS) as CsvField[]) {
    let best: { index: number; score: number } | null = null;
    lower.forEach((header, index) => {
      if (taken.has(index) || !header) return;
      for (const synonym of SYNONYMS[field]) {
        if (header === synonym || header.includes(synonym)) {
          // a longer synonym is a more specific match: "unit price" beats "price"
          const score = synonym.length + (header === synonym ? 100 : 0);
          if (!best || score > best.score) best = { index, score };
        }
      }
    });
    if (best) {
      mapping[field] = (best as { index: number }).index;
      taken.add((best as { index: number }).index);
    }
  }
  return mapping;
};

/**
 * Australian files are day-first. ISO passes through; anything ambiguous is
 * read as DD/MM/YYYY, which the import preview lets you eyeball before saving.
 */
export const parseDate = (raw: string): string | null => {
  const value = raw.trim();
  if (!value) return null;

  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dayFirst = value.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (dayFirst) {
    const [, d, m, y] = dayFirst;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) return toLocalDate(parsed);
  return null;
};

/** Strips currency symbols, thousands separators and stray whitespace. */
export const parseNumber = (raw: string): number => {
  const cleaned = raw.replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : Math.abs(n);
};

export const parseSide = (raw: string): "buy" | "sell" | null => {
  const v = raw.toLowerCase();
  if (/\b(buy|bought|purchase|b)\b/.test(v) || v.includes("buy")) return "buy";
  if (/\b(sell|sold|disposal|s)\b/.test(v) || v.includes("sell")) return "sell";
  return null;
};

/** A ticker like "BTC/AUD" or "BTC-AUD" is really just BTC. */
export const normaliseAsset = (raw: string): string =>
  raw
    .toUpperCase()
    .replace(/[/\-_](AUD|USD|USDT|USDC)$/, "")
    .trim();

export interface CsvImportRow {
  transaction: CgtTransaction | null;
  /** Why this row couldn't be read, if it couldn't. */
  problem?: string;
  raw: string[];
}

export const buildTransactions = (
  rows: string[][],
  mapping: Partial<Record<CsvField, number>>,
  kind: CgtAssetKind,
  now: string = new Date().toISOString()
): CsvImportRow[] => {
  const at = (row: string[], field: CsvField): string => {
    const index = mapping[field];
    return index === undefined ? "" : (row[index] ?? "");
  };

  return rows.map((raw, i) => {
    const date = parseDate(at(raw, "date"));
    const asset = normaliseAsset(at(raw, "asset"));
    const side = parseSide(at(raw, "side"));
    const quantity = parseNumber(at(raw, "quantity"));

    // exchanges give either a unit price or a total — accept whichever is mapped
    const total = parseNumber(at(raw, "total"));
    const mappedPrice = parseNumber(at(raw, "unitPrice"));
    const unitPrice =
      mappedPrice > 0 ? mappedPrice : quantity > 0 ? total / quantity : 0;

    const problem = !date
      ? "unreadable date"
      : !asset
        ? "no asset"
        : !side
          ? "not a buy or sell"
          : quantity <= 0
            ? "no quantity"
            : unitPrice <= 0
              ? "no price or total"
              : undefined;

    if (problem) return { transaction: null, problem, raw };

    return {
      raw,
      transaction: {
        id: crypto.randomUUID(),
        kind,
        asset,
        side: side!,
        date: date!,
        quantity,
        unitPrice,
        fee: parseNumber(at(raw, "fee")),
        createdAt: new Date(Date.parse(now) + i).toISOString(),
      },
    };
  });
};
