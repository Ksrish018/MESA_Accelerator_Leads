import "server-only";
import { db, must } from "../db";
import { amountsConflict, parseAmount } from "../extract/amount";
import { mapStage } from "../extract/stage";
import { domainOf } from "../text";
import { earliestCredible } from "../thesis/window";
import type { ExtractedRound, Stage } from "../types";
import type { VerifiedRound } from "../verify/quotes";
import { matchStartup, normalizeName, type KnownStartup } from "./names";

const DAY = 86_400_000;

export interface PersistCtx {
  runId: string;
  stageMap: Record<string, Stage>;
  usdInrRate: number;
  windowDays: number;
  known: KnownStartup[]; // refreshed per batch, appended as we insert
}

export interface ArticleRef {
  id: string; url: string; publisher: string | null; publisher_tier: number | null; published_at: string | null;
  injection_suspected: boolean;
}

export type PersistOutcome = "historical" | "rejected" | "new" | "more_coverage" | "duplicate_article";

async function trigger(startupId: string, type: string, detail: string, runId: string) {
  await db().from("triggers").insert({ startup_id: startupId, type, detail, run_id: runId });
}

function signalsFor(r: ExtractedRound, startupId: string, roundId: string, url: string) {
  const q = r.quotes ?? {};
  const rows: { startup_id: string; round_id: string; grp: string; name: string; value: string | null; quote: string | null; source_url: string }[] = [];
  const add = (grp: string, name: string, value: string | null, quote: string | null) =>
    rows.push({ startup_id: startupId, round_id: roundId, grp, name, value, quote, source_url: url });
  if (r.is_first_institutional) add("A", "first_institutional", "yes", q.is_first_institutional ?? null);
  if (r.business_model) add("B", "business_model", r.business_model, q.business_model ?? null);
  if (r.customer_type) add("B", "customer_type", r.customer_type, q.customer_type ?? null);
  if (r.use_of_funds) add("C", "use_of_funds", r.use_of_funds, q.use_of_funds ?? null);
  if (r.accelerator_mention) add("C", "accelerator_mention", r.accelerator_mention, q.accelerator_mention ?? null);
  for (const t of r.traction ?? []) add("D", `traction_${t.kind}`, t.text, t.text);
  for (const f of r.founders ?? []) if (f.background) add("E", "founder_background", `${f.name}: ${f.background}`, q.founders ?? null);
  return rows;
}

/**
 * Store one verified round. New company → T1. Known company → T2 (adds the
 * source, raises confidence, fills missing facts, no new draft). A parked lead
 * that gains its stage, website or a credible source → T3 re-evaluation.
 */
export async function persistRound(article: ArticleRef, vr: VerifiedRound, ctx: PersistCtx): Promise<PersistOutcome> {
  const r = vr.round;
  if (!r.is_new_round) return "historical";
  if (!vr.companyFound || !r.company?.trim()) return "rejected";
  const supa = db();

  const stage = mapStage(r.stage_text, ctx.stageMap);
  const amount = parseAmount(r.amount_text, ctx.usdInrRate);
  const websiteDomain = domainOf(r.website);
  const match = matchStartup({ name: r.company, website_domain: websiteDomain }, ctx.known);

  let startupId: string;
  let outcome: PersistOutcome;
  const flags: string[] = [...vr.flags];
  if (article.injection_suspected) flags.push("Injection suspected");

  if (match.kind === "match") {
    startupId = match.id;
    const existing = must(await supa.from("rounds").select("id").eq("startup_id", startupId).eq("article_id", article.id), "find round");
    if ((existing as unknown[]).length) return "duplicate_article";
    outcome = "more_coverage";
  } else {
    if (match.kind === "possible_duplicate") flags.push("Possible duplicate");
    const inserted = must(
      await supa.from("startups").insert({
        name: r.company.trim(),
        name_norm: normalizeName(r.company),
        website_url: r.website,
        website_domain: websiteDomain,
        location: r.location,
        sector_words: r.sector_words,
        business_model: r.business_model,
        customer_type: r.customer_type,
        status: "new",
        needs_eval: true,
        flags: match.kind === "possible_duplicate" ? ["Possible duplicate"] : [],
      }).select("id, name, name_norm, website_domain").single(),
      "insert startup",
    ) as KnownStartup;
    startupId = inserted.id;
    ctx.known.push(inserted);
    outcome = "new";
  }

  const round = must(
    await supa.from("rounds").insert({
      article_id: article.id,
      startup_id: startupId,
      source_url: article.url,
      publisher: article.publisher,
      publisher_tier: article.publisher_tier,
      published_at: article.published_at,
      stage_text: r.stage_text || null,
      stage,
      amount_text: r.amount_text,
      amount_usd_est: amount?.usd ?? null,
      announced_at: r.announced_date && !Number.isNaN(Date.parse(r.announced_date)) ? new Date(r.announced_date).toISOString() : null,
      investors: r.investors,
      lead_investor: r.lead_investor,
      founders: r.founders,
      website: r.website,
      location: r.location,
      sector_words: r.sector_words,
      business_model: r.business_model,
      customer_type: r.customer_type,
      use_of_funds: r.use_of_funds,
      traction: r.traction,
      accelerator_mention: r.accelerator_mention,
      negative_events: r.negative_events,
      is_new_round: true,
      is_first_institutional: r.is_first_institutional,
      quotes: r.quotes,
      dropped_fields: vr.dropped,
      flags,
    }).select("id").single(),
    "insert round",
  ) as { id: string };

  const sig = signalsFor(r, startupId, round.id, article.url);
  if (sig.length) await supa.from("signals").insert(sig);

  if (outcome === "new") await trigger(startupId, "T1", `New ${stage.replace("_", "-")} round · ${article.publisher ?? "source"}`, ctx.runId);
  else await trigger(startupId, "T2", `More coverage · ${article.publisher ?? "source"}`, ctx.runId);

  await recomputeStartup(startupId, ctx, outcome === "more_coverage");
  return outcome;
}

/** Aggregate a startup from all its rounds: sources, window, flags, missing facts (T3). */
export async function recomputeStartup(startupId: string, ctx: Pick<PersistCtx, "runId" | "windowDays">, isUpdate: boolean) {
  const supa = db();
  const s = must(await supa.from("startups").select("*").eq("id", startupId).single(), "load startup") as Record<string, any>;
  const rounds = must(await supa.from("rounds").select("*").eq("startup_id", startupId), "load rounds") as Record<string, any>[];

  const tiers = rounds.map((x) => x.publisher_tier as number | null);
  const credible = tiers.some((t) => t != null && t <= 2);
  const hasTier1 = tiers.some((t) => t === 1);
  const announced =
    earliestCredible(rounds.map((x) => ({ at: x.published_at, tier: x.publisher_tier }))) ??
    (rounds.map((x) => x.published_at).filter(Boolean).sort()[0] ? new Date(rounds.map((x) => x.published_at).filter(Boolean).sort()[0]) : null);

  const flags = new Set<string>((s.flags ?? []).filter((f: string) => !["One source", "Conflicting amounts", "Conflicting stage", "Unverified facts dropped", "Injection suspected"].includes(f)));
  if (rounds.length <= 1) flags.add("One source");
  if (amountsConflict(rounds.map((x) => Number(x.amount_usd_est) || 0))) flags.add("Conflicting amounts");
  const stages = new Set(rounds.map((x) => x.stage).filter((x) => x && x !== "unknown"));
  if (stages.size > 1) flags.add("Conflicting stage");
  for (const x of rounds) for (const f of x.flags ?? []) if (f === "Unverified facts dropped" || f === "Injection suspected") flags.add(f);

  const first = <T,>(pick: (x: Record<string, any>) => T | null | undefined) => {
    for (const x of [...rounds].sort((a, b) => (a.publisher_tier ?? 9) - (b.publisher_tier ?? 9))) {
      const v = pick(x);
      if (v != null && (!Array.isArray(v) || v.length)) return v;
    }
    return null;
  };

  const website = s.website_url ?? first((x) => x.website);
  const websiteDomain = s.website_domain ?? domainOf(website);
  const sectorWords = [...new Set(rounds.flatMap((x) => x.sector_words ?? []))];

  const patch: Record<string, unknown> = {
    source_count: rounds.length,
    has_tier1: hasTier1,
    first_announced_at: announced?.toISOString() ?? s.first_announced_at,
    window_ends_at: announced ? new Date(announced.getTime() + ctx.windowDays * DAY).toISOString() : s.window_ends_at,
    flags: [...flags],
    location: s.location ?? first((x) => x.location),
    business_model: s.business_model ?? first((x) => x.business_model),
    customer_type: s.customer_type ?? first((x) => x.customer_type),
    sector_words: sectorWords,
    updated_at: new Date().toISOString(),
  };
  if (!s.website_domain && websiteDomain) {
    // Another startup may already own this domain; then keep ours unset and flag it.
    const clash = must(await supa.from("startups").select("id").eq("website_domain", websiteDomain).neq("id", startupId), "domain clash") as unknown[];
    if (clash.length) flags.add("Possible duplicate");
    else { patch.website_url = website; patch.website_domain = websiteDomain; }
    patch.flags = [...flags];
  }

  if (isUpdate) {
    // T3: a parked or weak lead gains a missing fact or a credible source.
    const resolved: string[] = [];
    if (s.status === "unclear" && stages.size > 0) resolved.push("stage");
    if (!s.website_domain && patch.website_domain) resolved.push("website");
    if (s.status === "filtered" && s.filter_reason === "No Tier 1 or 2 source" && credible) resolved.push("credible source");
    if (resolved.length && !["drafted", "sent", "replied", "skipped"].includes(s.status)) {
      patch.needs_eval = true;
      patch.eval_attempts = 0;
      await trigger(startupId, "T3", `Resolved: ${resolved.join(", ")}`, ctx.runId);
    }
  }
  must(await supa.from("startups").update(patch).eq("id", startupId), "update startup");
}
