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
  amount_usd?: number | null; // lets an undisclosed-stage round in the thesis range be scored instead of parked
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

/** Geography criterion (kind "geography"): 5 inside the listed places, 2 when unknown, 0 elsewhere. */
export function geographyScore(location: string | null, places: string[] = []): number {
  if (!location || !location.trim()) return 2;
  const loc = location.toLowerCase();
  return places.some((p) => hasWord(loc, p)) ? 5 : 0;
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

const GLOBAL = /^(global|any|worldwide|all)$/i;

export function isGlobal(geographies: string[]): boolean {
  return geographies.some((g) => GLOBAL.test(g.trim()));
}

export function inGeography(location: string | null, geographies: string[]): boolean | null {
  if (isGlobal(geographies)) return true;
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

  // Undisclosed stage: score it (flagged) when the stated amount is inside the thesis range; otherwise park it
  // until a source states the stage (T3). The stage itself is never inferred.
  let stageUndisclosed = false;
  if (input.stage === "unknown") {
    const amt = input.amount_usd ?? null;
    const inRange = amt != null && amt > 0 && (thesis.max_round_usd == null || amt <= thesis.max_round_usd);
    if (!inRange) return { pass: false, rule: "stage_unclear", reason: "Stage undisclosed", park: true };
    stageUndisclosed = true;
  } else if (!thesis.stages.includes(input.stage)) {
    const label = input.stage_text?.trim() ? input.stage_text.trim() : "later stage";
    return { pass: false, rule: "stage", reason: `Stage: ${label}` };
  }

  const sector = excludedSector(input.sector_words, thesis);
  if (sector) return { pass: false, rule: "sector", reason: `Excluded sector: ${sector}` };

  const geo = inGeography(input.location, thesis.geographies);
  if (geo === false) return { pass: false, rule: "geography", reason: `Outside geography: ${input.location}` };

  if (!input.has_credible_source) return { pass: false, rule: "credibility", reason: "No Tier 1 or 2 source" };

  const flags: string[] = [];
  if (!input.location?.trim()) flags.push("Location unclear");
  if (stageUndisclosed) flags.push("Stage undisclosed");
  return { pass: true, flags };
}
