import type { NegativeEvent, Stage, Thesis } from "../types";
import { windowInfo } from "./window";

/** Hard rules in code (PRD §5.6, §7.2 disqualifiers). No AI call is made when one fails. */

export interface RuleInput {
  stage: Stage;
  stage_text: string | null;
  negative_events: NegativeEvent[];
  sector_words: string[];
  location: string | null;
  announced_at: string | Date | null;
  contacted: boolean;
  has_credible_source: boolean; // at least one Tier 1 or 2 source
}

export type RuleResult =
  | { pass: true; flags: string[] }
  | { pass: false; rule: string; reason: string; park?: boolean };

const NEGATIVE_LABEL: Record<NegativeEvent, string> = {
  acquired: "Acquired",
  shutdown: "Shut down",
  debt_only: "Debt-only round",
  grant_only: "Grant-only round",
  not_a_startup: "Not a startup",
};

/** Words that mark a software business even when a sector keyword matches. */
const SOFTWARE_HINTS = /\b(saas|software|platform|api|apis|ai|artificial intelligence|machine learning|infrastructure|analytics|developer|devtools|b2b|enterprise|automation|tooling)\b/i;

function hasWord(hay: string, needle: string): boolean {
  const esc = needle.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${esc}($|[^a-z0-9])`, "i").test(hay);
}

export function excludedSector(sectorWords: string[], thesis: Pick<Thesis, "exclude_sectors" | "sector_keywords">): string | null {
  const hay = sectorWords.join(" | ").toLowerCase();
  if (!hay.trim()) return null;
  const software = SOFTWARE_HINTS.test(hay);
  for (const label of thesis.exclude_sectors) {
    const keywords = [label, ...(thesis.sector_keywords?.[label] ?? [])];
    if (keywords.some((k) => hasWord(hay, k))) {
      // A B2B software company serving an excluded industry is not that industry.
      if (software) continue;
      return label;
    }
  }
  return null;
}

export function inGeography(location: string | null, geographies: string[]): boolean | null {
  if (!location || !location.trim()) return null;
  const loc = location.toLowerCase();
  return geographies.some((g) => hasWord(loc, g));
}

export function applyHardRules(input: RuleInput, thesis: Thesis, now: Date = new Date()): RuleResult {
  if (input.contacted) return { pass: false, rule: "contacted", reason: "Already contacted" };

  if (input.announced_at && windowInfo(input.announced_at, now, thesis.window_days, thesis.closing_days).closed) {
    return { pass: false, rule: "window", reason: "Window closed" };
  }

  for (const ev of input.negative_events ?? []) {
    if (thesis.disqualifiers.includes(ev)) return { pass: false, rule: ev, reason: NEGATIVE_LABEL[ev] ?? ev };
  }

  if (input.stage === "unknown") {
    return { pass: false, rule: "stage_unclear", reason: "Stage undisclosed", park: true };
  }
  if (!thesis.stages.includes(input.stage)) {
    const label = input.stage_text?.trim() ? input.stage_text.trim() : "later stage";
    return { pass: false, rule: "stage", reason: `Stage: ${label}` };
  }

  const sector = excludedSector(input.sector_words, thesis);
  if (sector) return { pass: false, rule: "sector", reason: `Excluded sector: ${sector}` };

  const geo = inGeography(input.location, thesis.geographies);
  if (geo === false) return { pass: false, rule: "geography", reason: `Outside geography: ${input.location}` };

  if (!input.has_credible_source) return { pass: false, rule: "credibility", reason: "No Tier 1 or 2 source" };

  const flags: string[] = [];
  if (geo === null) flags.push("Location unclear");
  return { pass: true, flags };
}
