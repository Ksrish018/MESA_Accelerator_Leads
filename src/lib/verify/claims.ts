import type { Fact } from "../types";
import { normalizeForMatch } from "../text";

export interface Claim { text: string; fact_id: string }

/**
 * Claim-to-fact check (PRD §5.7). Every claim must point at a fact we hold,
 * and every number in the email must appear in a fact or in the settings
 * text we supplied. Returns the list of problems; empty means it passes.
 */
export function checkClaims(body: string, claims: Claim[], facts: Fact[], allowedText = ""): string[] {
  const errors: string[] = [];
  const ids = new Set(facts.map((f) => f.id));
  for (const c of claims ?? []) {
    if (!c.fact_id || !ids.has(c.fact_id)) errors.push(`Claim without a fact: "${c.text}"`);
  }
  const known = normalizeForMatch(facts.map((f) => `${f.text} ${f.quote ?? ""}`).join(" ") + " " + allowedText);
  const numbers = body.match(/\d+(?:[.,]\d+)?/g) ?? [];
  for (const n of numbers) {
    const plain = n.replace(/,/g, "");
    if (!known.includes(plain) && !known.includes(n)) errors.push(`Number not in facts: ${n}`);
  }
  return [...new Set(errors)];
}
