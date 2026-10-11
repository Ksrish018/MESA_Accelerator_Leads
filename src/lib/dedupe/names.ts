/** Company identity: name normalisation and fuzzy match (PRD §5.4). Pure. */

const SUFFIXES = [
  "private limited", "pvt ltd", "pvt. ltd.", "pvt. ltd", "pvt", "limited", "ltd", "llp", "llc", "inc", "inc.",
  "corp", "corporation", "co", "gmbh", "technologies", "technology", "tech", "labs", "lab", "solutions",
  "ventures", "india", "global", "hq",
];

export function normalizeName(name: string): string {
  let s = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\.(ai|io|com|co|in|app|tech|so|xyz|dev)\b/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Strip trailing corporate suffixes repeatedly ("Acme Technologies Pvt Ltd" -> "acme").
  let changed = true;
  while (changed) {
    changed = false;
    for (const suf of SUFFIXES) {
      const clean = suf.replace(/[^a-z ]/g, "").trim();
      if (s.endsWith(` ${clean}`) && s.length > clean.length + 2) {
        s = s.slice(0, -clean.length - 1).trim();
        changed = true;
      }
    }
  }
  return s.replace(/\s+/g, "");
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** 1 = identical, 0 = nothing in common. Compares normalised names. */
export function nameSimilarity(a: string, b: string): number {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  return 1 - levenshtein(x, y) / Math.max(x.length, y.length);
}

export const FUZZY_THRESHOLD = 0.9;

export interface KnownStartup { id: string; name: string; name_norm: string; website_domain: string | null }

export type MatchResult =
  | { kind: "match"; id: string; by: "domain" | "name" | "fuzzy" }
  | { kind: "possible_duplicate"; id: string }
  | { kind: "none" };

/**
 * Domain decides when known on both sides. Otherwise exact normalised name or
 * fuzzy >= 0.9 merges. Similar names with two different known domains are
 * different companies, flagged as a possible duplicate and never merged.
 */
export function matchStartup(
  candidate: { name: string; website_domain: string | null },
  known: KnownStartup[],
): MatchResult {
  if (candidate.website_domain) {
    const byDomain = known.find((k) => k.website_domain === candidate.website_domain);
    if (byDomain) return { kind: "match", id: byDomain.id, by: "domain" };
  }
  const norm = normalizeName(candidate.name);
  let best: { k: KnownStartup; sim: number } | null = null;
  for (const k of known) {
    const sim = k.name_norm === norm ? 1 : nameSimilarity(candidate.name, k.name);
    if (!best || sim > best.sim) best = { k, sim };
  }
  if (!best || best.sim < FUZZY_THRESHOLD) return { kind: "none" };
  const conflictingDomains =
    candidate.website_domain && best.k.website_domain && candidate.website_domain !== best.k.website_domain;
  if (conflictingDomains) return { kind: "possible_duplicate", id: best.k.id };
  return { kind: "match", id: best.k.id, by: best.sim === 1 ? "name" : "fuzzy" };
}
