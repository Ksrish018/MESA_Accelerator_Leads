import "server-only";
import { asData, callGemini, DATA_RULE } from "../gemini";
import type { CriterionScore, Fact, Settings, Thesis } from "../types";
import { normalizeForMatch } from "../text";
import { bucketFor, computeTotal, roundSizeScore } from "./buckets";

const SCHEMA = {
  type: "OBJECT",
  properties: {
    criteria: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          key: { type: "STRING" },
          score_0_5: { type: "INTEGER" },
          evidence_fact_ids: { type: "ARRAY", items: { type: "STRING" } },
          evidence_quote: { type: "STRING", nullable: true },
        },
        required: ["key", "score_0_5", "evidence_fact_ids"],
      },
    },
  },
  required: ["criteria"],
};

interface ScoreOut { criteria: { key: string; score_0_5: number; evidence_fact_ids: string[]; evidence_quote: string | null }[] }

/**
 * Gemini rates each soft criterion 0-5 and names the facts it relies on.
 * Code then enforces evidence: a score above 0 with no valid fact is set to 0,
 * the quote shown is the fact's verified quote, and the total is computed here.
 */
export async function scoreStartup(opts: {
  runId: string | null;
  name: string;
  facts: Fact[];
  thesis: Thesis;
  settings: Settings;
  amountUsd: number | null;
}): Promise<{ criteria: CriterionScore[]; total: number; bucket: ReturnType<typeof bucketFor> }> {
  const aiCriteria = opts.thesis.criteria.filter((c) => c.kind === "ai");
  const factIds = new Set(opts.facts.map((f) => f.id));

  const system = `You rate how well one startup fits an accelerator's thesis, criterion by criterion, using only the numbered facts given.
${DATA_RULE}
For each criterion return key, score_0_5 (integer 0 to 5), evidence_fact_ids (IDs of the facts you rely on) and evidence_quote (the quote of the strongest fact, copied exactly).
Score 0 when the facts give no evidence for a criterion. Never use outside knowledge. Never consider college, age, gender, religion, caste, family background or photos.`;

  const prompt = [
    `Accelerator: ${opts.settings.accelerator_name}, ${opts.settings.programme_line ?? ""}`,
    `Programme offers: ${opts.settings.programme_offers.join("; ")}`,
    `Thesis sectors: ${opts.thesis.include_sectors.join("; ")}`,
    "Criteria:",
    ...aiCriteria.map((c) => `- key=${c.key} · ${c.name}: ${c.description}`),
    "",
    `Startup: ${opts.name}`,
    asData("facts", opts.facts.map((f) => `[${f.id}] ${f.text}${f.quote ? ` | quote: "${f.quote}"` : ""}`).join("\n")),
  ].join("\n");

  const out = await callGemini<ScoreOut>({
    step: "score",
    runId: opts.runId,
    system,
    prompt,
    schema: SCHEMA,
    validate: (x) => {
      const o = x as ScoreOut;
      if (!Array.isArray(o?.criteria)) return "criteria must be an array";
      for (const c of aiCriteria) if (!o.criteria.find((y) => y.key === c.key)) return `missing criterion ${c.key}`;
      return null;
    },
  });

  const criteria: CriterionScore[] = opts.thesis.criteria.map((c) => {
    if (c.kind === "round_size") {
      return {
        key: c.key, name: c.name, weight: c.weight, evidence_fact_ids: opts.facts.filter((f) => f.id.endsWith(".amount")).slice(0, 1).map((f) => f.id),
        score_0_5: roundSizeScore(opts.amountUsd, opts.thesis.min_round_usd, opts.thesis.max_round_usd),
        evidence_quote: opts.facts.find((f) => f.id.endsWith(".amount"))?.quote ?? null,
        source_url: opts.facts.find((f) => f.id.endsWith(".amount"))?.source_url ?? null,
      };
    }
    const g = out.criteria.find((y) => y.key === c.key);
    const ids = (g?.evidence_fact_ids ?? []).filter((id) => factIds.has(id));
    let score = Math.max(0, Math.min(5, Math.round(g?.score_0_5 ?? 0)));
    if (score > 0 && !ids.length) score = 0; // no evidence, no score
    const cited = opts.facts.filter((f) => ids.includes(f.id));
    // Show a quote only if it is one of the verified fact quotes.
    const claimed = g?.evidence_quote ? normalizeForMatch(g.evidence_quote) : "";
    const matchFact = cited.find((f) => f.quote && claimed && normalizeForMatch(f.quote).includes(claimed)) ?? cited.find((f) => f.quote);
    return {
      key: c.key, name: c.name, weight: c.weight, score_0_5: score, evidence_fact_ids: ids,
      evidence_quote: matchFact?.quote ?? null, source_url: matchFact?.source_url ?? null,
    };
  });

  const total = computeTotal(criteria, opts.thesis.criteria);
  return { criteria, total, bucket: bucketFor(total, opts.thesis.fit_threshold, opts.thesis.review_threshold) };
}
