import type { Stage } from "../types";

/** Fallback when the Supabase stage_map table cannot be read. The table wins. */
export const DEFAULT_STAGE_MAP: Record<string, Stage> = {
  "pre-seed": "pre_seed", "pre seed": "pre_seed", preseed: "pre_seed", angel: "pre_seed",
  seed: "seed", "seed extension": "seed", "seed-plus": "seed", "seed plus": "seed", "seed+": "seed",
  "pre-series a": "other", bridge: "other", "series a": "other", "series a+": "other",
  undisclosed: "unknown",
};

/**
 * Stage normalisation (PRD §5.4). Order matters: "pre-Series A" contains
 * "series a" and "seed round ahead of Series A" contains "seed", so the most
 * specific patterns are checked first, then the table, then keywords.
 */
export function mapStage(label: string | null | undefined, table: Record<string, Stage> = DEFAULT_STAGE_MAP): Stage {
  if (!label) return "unknown";
  const s = label.toLowerCase().replace(/[‐‑‒–—―]/g, "-").replace(/\s+/g, " ").trim();
  if (!s) return "unknown";

  if (/\bpre[- ]?series[- ]?[a-z]\b/.test(s)) return "other";
  if (/\bbridge\b/.test(s)) return "other";
  if (/\bseries[- ]?[a-h]\b/.test(s) && !/\bseed\b/.test(s)) return "other";

  if (table[s]) return table[s];
  const stripped = s.replace(/\b(round|funding|financing|investment|raise)\b/g, "").replace(/\s+/g, " ").trim();
  if (table[stripped]) return table[stripped];

  if (/\bpre[- ]?seed\b/.test(s)) return "pre_seed";
  if (/\bangel\b/.test(s)) return "pre_seed";
  if (/\bseed\b/.test(s)) return "seed";
  if (/\b(growth|ipo|venture debt|debt)\b/.test(s)) return "other";
  if (/\b(undisclosed|unknown|not disclosed)\b/.test(s)) return "unknown";
  return "unknown";
}

export const STAGE_LABEL: Record<Stage, string> = {
  pre_seed: "Pre-seed",
  seed: "Seed",
  other: "Later stage",
  unknown: "Stage unclear",
};
