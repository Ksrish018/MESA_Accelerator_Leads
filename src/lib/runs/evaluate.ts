import "server-only";
import { db, must } from "../db";
import { writeDraft } from "../draft/draft";
import { mapStage } from "../extract/stage";
import { researchStartup, type ResearchRow } from "../research/research";
import { syncGmailDraft } from "../gmail/auto";
import { BUCKET_LABEL } from "../score/buckets";
import { buildFacts } from "../score/facts";
import { scoreStartup } from "../score/score";
import { applyHardRules } from "../thesis/rules";
import type { CriterionScore, NegativeEvent, Settings, Stage, Thesis } from "../types";

export interface EvalCtx { runId: string | null; thesis: Thesis; settings: Settings; stageMap: Record<string, Stage> }
export type EvalOutcome = "filtered" | "parked" | "fit" | "worth_a_look" | "not_a_fit" | "skipped";

async function decide(startupId: string, action: string, reason: string, actor: "system" | "rohit" = "system") {
  await db().from("decisions").insert({ startup_id: startupId, action, reason, actor });
}

/** Stage across sources: the most credible source's stage, ignoring "unknown". */
export function combinedStage(rounds: Record<string, any>[], stageMap: Record<string, Stage>): { stage: Stage; stage_text: string | null } {
  const sorted = [...rounds].sort((a, b) => (a.publisher_tier ?? 9) - (b.publisher_tier ?? 9));
  for (const r of sorted) {
    const s = (r.stage as Stage) ?? mapStage(r.stage_text, stageMap);
    if (s !== "unknown") return { stage: s, stage_text: r.stage_text };
  }
  return { stage: "unknown", stage_text: sorted[0]?.stage_text ?? null };
}

export async function loadStartupBundle(startupId: string) {
  const supa = db();
  const [s, rounds, research, outreach] = await Promise.all([
    supa.from("startups").select("*").eq("id", startupId).single(),
    supa.from("rounds").select("*").eq("startup_id", startupId).order("published_at", { ascending: true }),
    supa.from("research").select("*").eq("startup_id", startupId).maybeSingle(),
    supa.from("outreach").select("*").eq("startup_id", startupId).maybeSingle(),
  ]);
  return {
    startup: must(s, "load startup") as Record<string, any>,
    rounds: must(rounds, "load rounds") as Record<string, any>[],
    research: (research.data ?? null) as ResearchRow | null,
    outreach: outreach.data as Record<string, any> | null,
  };
}

/** Draft for one startup and store it. Used by the pipeline, Rescue and Regenerate. */
export async function draftStartup(startupId: string, ctx: EvalCtx, criteria?: CriterionScore[]) {
  const supa = db();
  const b = await loadStartupBundle(startupId);
  if (!criteria) {
    const last = await supa.from("scores").select("criteria").eq("startup_id", startupId).order("created_at", { ascending: false }).limit(1);
    criteria = ((last.data?.[0]?.criteria ?? []) as CriterionScore[]);
  }
  const facts = buildFacts(b.startup as { name: string }, b.rounds, b.research);
  const d = await writeDraft({
    runId: ctx.runId, name: b.startup.name, facts, criteria, rounds: b.rounds, thesis: ctx.thesis, settings: ctx.settings,
  });
  const recipient = b.research?.contacts?.[0]?.address ?? null;
  const row = must(
    await supa.from("drafts").insert({
      startup_id: startupId, subject: d.subject, body: d.body, recipient, greeting_name: d.greeting_name,
      claims: d.claims, facts: d.facts, lint_errors: d.lint_errors, status: "draft",
    }).select("*").single(),
    "save draft",
  ) as Record<string, any>;
  // Morning drafts wait in Gmail: create this startup's Gmail draft, or update the one it already has.
  const gmailId = await syncGmailDraft(row as any);
  return { ...row, gmail_draft_id: gmailId ?? row.gmail_draft_id };
}

/**
 * One startup through the gate (PRD §5.6): hard rules in code first (no AI
 * call when one fails), then research, Gemini criterion scores with a code
 * total and bucket, then a draft for every Fit.
 */
export async function evaluateStartup(startupId: string, ctx: EvalCtx): Promise<EvalOutcome> {
  const supa = db();
  const { startup: s, rounds, outreach } = await loadStartupBundle(startupId);
  const done = (patch: Record<string, unknown>) =>
    supa.from("startups").update({ ...patch, needs_eval: false, eval_claimed_at: null, updated_at: new Date().toISOString() }).eq("id", startupId);

  if (["drafted", "sent", "replied", "skipped"].includes(s.status)) {
    await done({});
    return "skipped";
  }

  const { stage, stage_text } = combinedStage(rounds, ctx.stageMap);
  const negatives = [...new Set(rounds.flatMap((r) => r.negative_events ?? []))] as NegativeEvent[];
  const amountUsd = rounds.map((r) => Number(r.amount_usd_est)).find((x) => x > 0) ?? null;
  const rule = s.rescued
    ? ({ pass: true, flags: [] } as const)
    : applyHardRules(
        {
          stage, stage_text, negative_events: negatives, sector_words: s.sector_words ?? [], location: s.location,
          announced_at: s.first_announced_at, contacted: !!outreach,
          has_credible_source: rounds.some((r) => r.publisher_tier != null && r.publisher_tier <= 2),
          amount_usd: amountUsd,
        },
        ctx.thesis,
      );

  if (!rule.pass) {
    await supa.from("scores").insert({ startup_id: startupId, thesis_version: ctx.thesis.version, criteria: [], total: null, bucket: null, hard_rule_failed: rule.reason });
    await done({ status: rule.park ? "unclear" : "filtered", bucket: null, filter_reason: rule.reason });
    await decide(startupId, "filtered", rule.reason);
    return rule.park ? "parked" : "filtered";
  }

  const founderNames = rounds.flatMap((r) => (r.founders ?? []).map((f: any) => f.name));
  const research = await researchStartup(s as any, founderNames);
  const facts = buildFacts(s as { name: string }, rounds, research.ok ? research : null);
  const scored = await scoreStartup({ runId: ctx.runId, name: s.name, facts, thesis: ctx.thesis, settings: ctx.settings, amountUsd, location: s.location });
  await supa.from("scores").insert({
    startup_id: startupId, thesis_version: ctx.thesis.version, criteria: scored.criteria, total: scored.total, bucket: scored.bucket,
  });

  const flags = new Set<string>([...(s.flags ?? []), ...rule.flags]);
  flags.delete("Older thesis");
  if (!research.ok) flags.add(research.error === "No website found" ? "No website found" : "No website facts");
  if (research.ok && !research.contacts.length) flags.add("Find contact");
  if (rounds.some((r) => r.accelerator_mention)) flags.add("In another accelerator");

  if (scored.bucket === "fit" || s.rescued) {
    await draftStartup(startupId, ctx, scored.criteria);
    await done({ status: "fit", bucket: scored.bucket, filter_reason: null, flags: [...flags] });
    await decide(startupId, "scored", `Score ${scored.total} · ${BUCKET_LABEL[scored.bucket]}`);
    await decide(startupId, "drafted", "Draft ready for review");
    return "fit";
  }
  const reason = `Score ${scored.total} · ${BUCKET_LABEL[scored.bucket]}`;
  await done({ status: "filtered", bucket: scored.bucket, filter_reason: reason, flags: [...flags] });
  await decide(startupId, "filtered", reason);
  return scored.bucket;
}
