/** Amount parsing: keep the original text, add a USD estimate (PRD §5.4). Pure. */

export interface ParsedAmount {
  original: string;
  currency: "INR" | "USD" | "EUR" | "GBP" | "SGD";
  value: number; // in the original currency, whole units
  usd: number;
}

const FX_TO_USD: Record<string, number> = { USD: 1, EUR: 1.08, GBP: 1.27, SGD: 0.74 };

const UNIT: Record<string, number> = {
  crore: 1e7, crores: 1e7, cr: 1e7,
  lakh: 1e5, lakhs: 1e5, lac: 1e5, lacs: 1e5, l: 1e5,
  million: 1e6, mn: 1e6, mln: 1e6, m: 1e6,
  billion: 1e9, bn: 1e9, b: 1e9,
  thousand: 1e3, k: 1e3,
};

/**
 * Parses "₹5.25 Cr", "Rs 40 lakh", "INR 12 crore", "$1.3 Mn", "USD 500K",
 * "$2M", "€1.5 million". Returns null for undisclosed or unparseable amounts.
 */
export function parseAmount(text: string | null | undefined, usdInrRate: number): ParsedAmount | null {
  if (!text) return null;
  const t = text.replace(/,/g, "").replace(/\s+/g, " ").trim();
  const re =
    /(₹|\brs\.?|\binr|\$|\busd|us\$|€|\beur|£|\bgbp|s\$|\bsgd)?\s*(\d+(?:\.\d+)?)\s*(crores?|cr|lakhs?|lacs?|lac|l|million|mn|mln|m|billion|bn|b|thousand|k)?\b\s*(rupees|dollars|usd|inr)?/gi;
  // First number that carries a currency or a unit; bare years and counts are skipped.
  const m = [...t.matchAll(re)].find(([, sym, , unit, trailing]) => sym || unit || trailing);
  if (!m) return null;
  const [, sym, num, unitRaw, trailing] = m;
  const n = Number(num);
  if (!Number.isFinite(n) || n <= 0) return null;

  const s = (sym ?? trailing ?? "").toLowerCase().replace(/\.$/, "");
  let currency: ParsedAmount["currency"];
  if (["₹", "rs", "inr", "rupees"].includes(s)) currency = "INR";
  else if (["€", "eur"].includes(s)) currency = "EUR";
  else if (["£", "gbp"].includes(s)) currency = "GBP";
  else if (["s$", "sgd"].includes(s)) currency = "SGD";
  else if (["$", "usd", "us$", "dollars"].includes(s)) currency = "USD";
  else {
    // No symbol: crore and lakh only exist in Indian numbering.
    const u = (unitRaw ?? "").toLowerCase();
    if (["crore", "crores", "cr", "lakh", "lakhs", "lac", "lacs"].includes(u)) currency = "INR";
    else return null;
  }

  const unit = unitRaw ? UNIT[unitRaw.toLowerCase()] ?? 1 : 1;
  const value = n * unit;
  const usd = currency === "INR" ? value / usdInrRate : value * (FX_TO_USD[currency] ?? 1);
  return { original: text.trim(), currency, value, usd: Math.round(usd) };
}

/**
 * Two credible amounts conflict when they differ by more than 15% after
 * conversion. Never averaged: the UI shows both.
 */
export function amountsConflict(usdAmounts: number[]): boolean {
  const xs = usdAmounts.filter((x) => x > 0);
  if (xs.length < 2) return false;
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  return (max - min) / max > 0.15;
}

export function formatUsd(usd: number | null | undefined): string | null {
  if (usd == null) return null;
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(usd >= 1e7 ? 0 : 1)}M`;
  if (usd >= 1e3) return `$${Math.round(usd / 1e3)}K`;
  return `$${usd}`;
}
