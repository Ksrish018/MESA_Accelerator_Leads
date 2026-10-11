import { normalizeForMatch } from "../text";
import type { ExtractedRound } from "../types";

/**
 * Quote check (PRD §5.4). A quote counts only if it appears in the source
 * text after whitespace, case, quote-mark and dash normalisation. Quotes with
 * "..." are checked part by part, in order.
 */
export function quoteFound(quote: string | null | undefined, sourceText: string): boolean {
  if (!quote) return false;
  const hay = normalizeForMatch(sourceText);
  const parts = normalizeForMatch(quote)
    .replace(/^["']|["']$/g, "")
    .split(/\.\.\.|…|\[\.\.\.\]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return false;
  if (parts.join("").length < 4) return false; // too short to prove anything
  let from = 0;
  for (const p of parts) {
    const at = hay.indexOf(p, from);
    if (at < 0) return false;
    from = at + p.length;
  }
  return true;
}

/** Fields that need a verbatim quote. Each maps to the key Gemini uses in `quotes`. */
const QUOTED_FIELDS = [
  "stage_text", "amount_text", "investors", "lead_investor", "founders", "website", "location",
  "sector_words", "business_model", "customer_type", "use_of_funds", "accelerator_mention",
  "negative_events", "is_first_institutional", "announced_date",
] as const;

type QuotedField = (typeof QUOTED_FIELDS)[number];

function isPresent(r: ExtractedRound, f: QuotedField): boolean {
  const v = r[f] as unknown;
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "string") return v.trim().length > 0;
  return true;
}

function clearField(r: ExtractedRound, f: QuotedField): void {
  switch (f) {
    case "investors": case "founders": case "sector_words": case "negative_events":
      (r[f] as unknown[]) = [];
      break;
    default:
      (r as unknown as Record<string, unknown>)[f] = null;
  }
}

const digits = (s: string) => (s.match(/\d+(?:\.\d+)?/g) ?? []).join(" ");

export interface VerifiedRound {
  round: ExtractedRound;
  dropped: string[];
  flags: string[];
  companyFound: boolean;
}

/**
 * Drops every fact whose quote is missing or not found in the source text,
 * and flags the entry. Traction items are their own quotes. The company name
 * itself must appear in the source, otherwise the whole round is rejected.
 */
export function verifyRound(input: ExtractedRound, sourceText: string): VerifiedRound {
  const r: ExtractedRound = structuredClone(input);
  r.quotes = { ...(r.quotes ?? {}) };
  const dropped: string[] = [];
  const hay = normalizeForMatch(sourceText);

  const companyFound = hay.includes(normalizeForMatch(r.company));

  for (const f of QUOTED_FIELDS) {
    if (!isPresent(r, f)) continue;
    const q = r.quotes[f];
    let ok = quoteFound(q, sourceText);
    // The stated amount must be the one in its quote, not a different figure.
    if (ok && f === "amount_text" && r.amount_text) ok = digits(normalizeForMatch(q)).includes(digits(r.amount_text));
    if (!ok) {
      clearField(r, f);
      delete r.quotes[f];
      dropped.push(f);
    }
  }

  const keptTraction = (r.traction ?? []).filter((t) => quoteFound(t.text, sourceText));
  if (keptTraction.length !== (r.traction ?? []).length) dropped.push("traction");
  r.traction = keptTraction;

  // is_new_round has no field of its own to drop; without a stage quote it can't stand.
  if (dropped.includes("stage_text")) r.stage_text = "";

  const flags: string[] = [];
  if (dropped.length) flags.push("Unverified facts dropped");
  if (!companyFound) flags.push("Company not in source");
  return { round: r, dropped, flags, companyFound };
}
