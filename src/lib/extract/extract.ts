import "server-only";
import { asData, callGemini, DATA_RULE } from "../gemini";
import type { Extraction, ExtractedRound } from "../types";

const S = (nullable = false, extra: Record<string, unknown> = {}) => ({ type: "STRING", nullable, ...extra });

const QUOTE_KEYS = [
  "stage_text", "amount_text", "announced_date", "investors", "lead_investor", "founders", "website", "location",
  "sector_words", "business_model", "customer_type", "use_of_funds", "accelerator_mention", "negative_events",
  "is_first_institutional",
];

export const EXTRACTION_SCHEMA = {
  type: "OBJECT",
  properties: {
    rounds: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          company: S(),
          website: S(true),
          stage_text: S(),
          amount_text: S(true),
          announced_date: S(true),
          is_new_round: { type: "BOOLEAN" },
          is_first_institutional: { type: "BOOLEAN", nullable: true },
          investors: { type: "ARRAY", items: S() },
          lead_investor: S(true),
          founders: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: { name: S(), role: S(true), background: S(true) },
              required: ["name"],
            },
          },
          location: S(true),
          sector_words: { type: "ARRAY", items: S() },
          business_model: S(true, { enum: ["B2B", "B2C", "B2B2C"] }),
          customer_type: S(true, { enum: ["enterprise", "SMB", "consumer"] }),
          use_of_funds: S(true),
          traction: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: { text: S(), kind: S(false, { enum: ["customers", "revenue", "users", "launch", "partnership"] }) },
              required: ["text", "kind"],
            },
          },
          accelerator_mention: S(true),
          negative_events: {
            type: "ARRAY",
            items: S(false, { enum: ["acquired", "shutdown", "debt_only", "grant_only", "not_a_startup"] }),
          },
          quotes: {
            type: "OBJECT",
            properties: Object.fromEntries(QUOTE_KEYS.map((k) => [k, S(true)])),
          },
        },
        required: [
          "company", "stage_text", "is_new_round", "investors", "founders", "sector_words", "traction",
          "negative_events", "quotes",
        ],
      },
    },
    injection_suspected: { type: "BOOLEAN" },
  },
  required: ["rounds", "injection_suspected"],
};

const SYSTEM = `You extract startup funding facts from one news article or press release for an accelerator's outreach team.
${DATA_RULE}

Rules:
- Return one entry per company whose funding round is reported in this article. Weekly roundups produce several entries.
- is_new_round = true only for a round announced in this article. A past round mentioned in passing (for example "the company had earlier raised a seed round" in a Series A story) is is_new_round = false.
- stage_text: the stage exactly as written (for example "pre-seed", "seed", "pre-Series A", "Series A", "bridge"). Use "undisclosed" when the article gives no stage.
- amount_text: the amount exactly as written, with currency and unit (for example "₹5.25 Cr", "$1.3 million"). null if undisclosed.
- Every non-null or non-empty field needs a verbatim quote copied character for character from the article in quotes.<field>. A quote is the clause or sentence that states the fact (about 6 to 30 words), never a single word, and must exist in the article text exactly.
- If you cannot quote evidence for a field, set it to null (or an empty list). Never infer, guess or use outside knowledge.
- website: only the company's own URL or domain printed in the article or listed under "Links in article" against the company's name. Quote that line. Never a news site, investor or social profile.
- founders: names as published. background: work evidence only (prior company, engineering or domain experience). Never college, degree, age, gender, religion, caste, family or appearance. null if none.
- sector_words: short phrases the article uses to describe what the company does or its industry.
- business_model: B2B, B2C or B2B2C only when the article says who the customers are. customer_type likewise.
- use_of_funds: what the article says the money will be used for.
- traction: each item's text must itself be a verbatim phrase from the article (named customers, pilots, partners, revenue, users, a launch).
- is_first_institutional: true only if the article says this is the first institutional or first external round.
- accelerator_mention: the accelerator or incubator the company is in, if the article says so.
- negative_events: acquired, shutdown, debt_only (round is entirely debt), grant_only, not_a_startup (fund launch, listed company, subsidiary). Quote it.
- If the article is not about a startup raising money, return rounds: [].`;

export function validateExtraction(x: unknown): string | null {
  const o = x as Extraction;
  if (!o || typeof o !== "object" || !Array.isArray(o.rounds)) return "rounds must be an array";
  if (typeof o.injection_suspected !== "boolean") return "injection_suspected must be a boolean";
  for (const [i, r] of o.rounds.entries()) {
    if (!r.company || typeof r.company !== "string") return `rounds[${i}].company is required`;
    if (typeof r.is_new_round !== "boolean") return `rounds[${i}].is_new_round must be boolean`;
    if (!r.quotes || typeof r.quotes !== "object") return `rounds[${i}].quotes is required`;
  }
  return null;
}

const PROTECTED = /\b(iit|iim|bits|nit|university|college|alumn|graduat|degree|mba|b\.?tech|m\.?tech|phd|school|years? old|aged|caste|religio|married|son of|daughter of|wife|husband)\b/i;

/** Team signals use work evidence only (PRD §7.2 E). Anything else is removed before storage. */
export function sanitizeFounders(r: ExtractedRound): ExtractedRound {
  r.founders = (r.founders ?? []).map((f) => ({
    name: f.name,
    role: f.role ?? null,
    background: f.background && !PROTECTED.test(f.background) ? f.background : null,
  }));
  return r;
}

export async function extractArticle(opts: {
  runId: string | null;
  title: string;
  publisher: string | null;
  publishedAt: string | null;
  url: string;
  text: string;
}): Promise<Extraction> {
  const prompt = [
    `Article URL: ${opts.url}`,
    `Publisher: ${opts.publisher ?? "unknown"}`,
    `Published: ${opts.publishedAt ?? "unknown"}`,
    asData("article", opts.text),
  ].join("\n");
  const out = await callGemini<Extraction>({
    step: "extract",
    runId: opts.runId,
    system: SYSTEM,
    prompt,
    schema: EXTRACTION_SCHEMA,
    validate: validateExtraction,
    // Weekly roundups list many startups with quotes: the answer is long, so allow more time.
    timeoutMs: 90_000,
  });
  out.rounds = out.rounds.map((r) => sanitizeFounders({
    ...r,
    investors: r.investors ?? [],
    founders: r.founders ?? [],
    sector_words: r.sector_words ?? [],
    traction: r.traction ?? [],
    negative_events: r.negative_events ?? [],
    quotes: Object.fromEntries(Object.entries(r.quotes ?? {}).filter(([, v]) => typeof v === "string" && v.trim())),
  }));
  return out;
}
