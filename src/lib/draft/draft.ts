import "server-only";
import { asData, callGemini, DATA_RULE } from "../gemini";
import type { CriterionScore, Fact, Settings, Thesis } from "../types";
import { checkClaims, type Claim } from "../verify/claims";
import { BANNED_PHRASES, lintDraft, SUBJECT_MAX, WORDS_MAX, WORDS_MIN } from "./lint";

const SCHEMA = {
  type: "OBJECT",
  properties: {
    subject: { type: "STRING" },
    body: { type: "STRING" },
    greeting_name: { type: "STRING", nullable: true },
    claims: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { text: { type: "STRING" }, fact_id: { type: "STRING" } },
        required: ["text", "fact_id"],
      },
    },
  },
  required: ["subject", "body", "claims"],
};

interface DraftOut { subject: string; body: string; greeting_name: string | null; claims: Claim[] }

export interface DraftResult {
  subject: string;
  body: string; // with signature
  greeting_name: string | null;
  claims: Claim[];
  facts: Fact[];
  lint_errors: string[];
}

/** Text the draft may draw numbers and links from besides the facts. */
export function allowedSettingsText(s: Settings): string {
  return [s.accelerator_name, s.programme_line, s.programme_offers.join(" "), s.application_link, s.booking_link, s.signature, "20-minute 20 minute"].join(" ");
}

/** First name of a founder named in a source, else null ("Hi [Company] team"). */
export function greetingFor(facts: Fact[], rounds: Record<string, any>[]): string | null {
  for (const r of rounds) {
    const f = (r.founders ?? [])[0];
    if (f?.name && facts.some((x) => x.id.endsWith(".founders"))) return String(f.name).trim().split(/\s+/)[0];
  }
  return null;
}

/**
 * Writes a plain-text email from checked facts only (PRD §5.7). Code lints it
 * and checks every claim against a fact; on failure it regenerates once with
 * the errors attached. Problems that survive are stored and shown on Review.
 */
export async function writeDraft(opts: {
  runId: string | null;
  name: string;
  facts: Fact[];
  criteria: CriterionScore[];
  rounds: Record<string, any>[];
  thesis: Thesis;
  settings: Settings;
}): Promise<DraftResult> {
  const { settings } = opts;
  const greeting = greetingFor(opts.facts, opts.rounds);
  const topCriteria = [...opts.criteria]
    .filter((c) => c.score_0_5 >= 3 && c.evidence_quote)
    .sort((a, b) => b.score_0_5 * b.weight - a.score_0_5 * a.weight)
    .slice(0, 2);

  const system = `You write one short outreach email from an accelerator's programme lead to a startup that has just raised a pre-seed or seed round.
${DATA_RULE}
Rules:
- Plain text. Subject under ${SUBJECT_MAX} characters. Body ${WORDS_MIN} to ${WORDS_MAX} words, counting the greeting line. Do not add a signature or sign-off name; it is appended later.
- Start with "Hi ${greeting ?? `${opts.name} team`},".
- One specific, sourced line about them. Pick the hook in this order of preference: their stated use of funds; a named customer, pilot or launch; what they build, in their own words; the round itself.
- One line on why the programme fits them, drawn from the fit evidence.
- One clear ask: apply at the application link, or book a 20-minute call at the booking link.
- Use only the numbered facts and the programme details. No invented numbers, customers, names or achievements. Mention an investor only if the fact list names them.
- No flattery, no exclamation marks, no em dashes, no emojis. Never use: ${BANNED_PHRASES.join(", ")}.
- Tone: ${opts.thesis.email_tone_notes ?? "plain and specific"}.
- claims: list every specific statement about the startup in the email, each with the fact_id it comes from.`;

  const prompt = [
    `Startup: ${opts.name}`,
    `Accelerator: ${settings.accelerator_name}, ${settings.programme_line ?? ""}`,
    `Programme offers: ${settings.programme_offers.join("; ")}`,
    `Application link: ${settings.application_link ?? "none"}`,
    `Booking link: ${settings.booking_link ?? "none"}`,
    `Sender: ${settings.signer_name ?? ""}, ${settings.signer_title ?? ""}`,
    "Fit evidence:",
    ...topCriteria.map((c) => `- ${c.name} ${c.score_0_5}/5: "${c.evidence_quote}"`),
    asData("facts", opts.facts.map((f) => `[${f.id}] ${f.text}`).join("\n")),
  ].join("\n");

  const allowed = allowedSettingsText(settings);
  const attempt = async (extra: string) =>
    callGemini<DraftOut>({
      step: "draft",
      runId: opts.runId,
      system,
      prompt: prompt + extra,
      schema: SCHEMA,
      validate: (x) => {
        const o = x as DraftOut;
        if (!o?.subject || !o?.body) return "subject and body are required";
        if (!Array.isArray(o.claims)) return "claims must be an array";
        return null;
      },
    });

  let out = await attempt("");
  let errors = [...lintDraft(out.subject, out.body), ...checkClaims(out.body, out.claims, opts.facts, allowed)];
  if (errors.length) {
    out = await attempt(`\n\nThe previous draft failed these checks. Fix every one:\n- ${errors.join("\n- ")}`);
    errors = [...lintDraft(out.subject, out.body), ...checkClaims(out.body, out.claims, opts.facts, allowed)];
  }
  const signature = settings.signature ?? [settings.signer_name, settings.signer_title].filter(Boolean).join("\n");
  return {
    subject: out.subject.trim(),
    body: `${out.body.trim()}\n\n${signature}`.trim(),
    greeting_name: greeting,
    claims: out.claims,
    facts: opts.facts,
    lint_errors: errors,
  };
}
