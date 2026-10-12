import type { Fact } from "../types";

/**
 * Checked facts for one startup, each with an ID, its source URL and the
 * verbatim quote. Scoring cites these IDs; drafts may only claim these.
 * Pure: takes rows already loaded from the database.
 */
export function buildFacts(
  startup: { name: string; website_url?: string | null },
  rounds: Record<string, any>[],
  research: { url: string | null; title: string | null; description: string | null } | null,
): Fact[] {
  const facts: Fact[] = [];
  const add = (id: string, text: string, source_url: string | null, quote: string | null) => {
    if (text?.trim()) facts.push({ id, text: text.trim(), source_url, quote: quote?.trim() || null });
  };
  // Most credible sources first so their facts come first.
  const sorted = [...rounds].sort((a, b) => (a.publisher_tier ?? 9) - (b.publisher_tier ?? 9));
  sorted.forEach((r, i) => {
    const p = `r${i + 1}`;
    const q = (r.quotes ?? {}) as Record<string, string>;
    const src = r.source_url as string;
    const by = r.publisher ? ` (${r.publisher})` : "";
    if (r.stage_text && r.stage !== "unknown") add(`${p}.stage`, `${startup.name} raised a ${r.stage_text} round${by}`, src, q.stage_text ?? null);
    if (r.amount_text) add(`${p}.amount`, `The round was ${r.amount_text}`, src, q.amount_text ?? null);
    if (r.investors?.length) add(`${p}.investors`, `Investors: ${r.investors.join(", ")}`, src, q.investors ?? null);
    if (r.lead_investor) add(`${p}.lead`, `Led by ${r.lead_investor}`, src, q.lead_investor ?? null);
    if (r.founders?.length)
      add(`${p}.founders`, `Founders: ${r.founders.map((f: any) => (f.role ? `${f.name} (${f.role})` : f.name)).join(", ")}`, src, q.founders ?? null);
    (r.founders ?? []).forEach((f: any, j: number) => {
      if (f.background) add(`${p}.founder_bg.${j}`, `${f.name}: ${f.background}`, src, q.founders ?? null);
    });
    if (r.use_of_funds) add(`${p}.use_of_funds`, `Use of funds: ${r.use_of_funds}`, src, q.use_of_funds ?? null);
    (r.traction ?? []).forEach((t: any, j: number) => add(`${p}.traction.${j}`, t.text, src, t.text));
    if (r.sector_words?.length) add(`${p}.sector`, `Described as: ${r.sector_words.join("; ")}`, src, q.sector_words ?? null);
    if (r.business_model) add(`${p}.model`, `Business model: ${r.business_model}`, src, q.business_model ?? null);
    if (r.customer_type) add(`${p}.customers`, `Customer type: ${r.customer_type}`, src, q.customer_type ?? null);
    if (r.location) add(`${p}.location`, `Based in ${r.location}`, src, q.location ?? null);
    if (r.is_first_institutional) add(`${p}.first_institutional`, "This is its first institutional round", src, q.is_first_institutional ?? null);
    if (r.accelerator_mention) add(`${p}.accelerator`, `Part of ${r.accelerator_mention}`, src, q.accelerator_mention ?? null);
  });
  if (research?.description) add("web.description", research.description, research.url, research.description);
  if (research?.title) add("web.title", research.title, research.url, research.title);
  return facts;
}

/** "What they do": the company's own words with the source (PRD §10.4 rule 4). */
export function whatTheyDo(
  rounds: Record<string, any>[],
  research: { url: string | null; description: string | null } | null,
): { quote: string; source_url: string | null } | null {
  if (research?.description) return { quote: research.description, source_url: research.url };
  for (const r of rounds) {
    const q = r.quotes?.sector_words ?? r.quotes?.business_model;
    if (q) return { quote: q, source_url: r.source_url };
  }
  return null;
}
