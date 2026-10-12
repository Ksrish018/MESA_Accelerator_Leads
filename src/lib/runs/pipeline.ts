import "server-only";
import { db, must } from "../db";
import { persistRound, type PersistCtx } from "../dedupe/persist";
import type { KnownStartup } from "../dedupe/names";
import { extractArticle } from "../extract/extract";
import { GeminiError } from "../gemini";
import { fetchPage } from "../sources/fetch";
import { ingestSources } from "../sources/ingest";
import { domainOf, extractLinks, htmlToText, truncate } from "../text";
import { activeThesis, loadSettings, loadStageMap } from "../thesis/load";
import { windowInfo } from "../thesis/window";
import { verifyRound } from "../verify/quotes";
import { evaluateStartup } from "./evaluate";
import { gmailStep } from "../gmail/auto";

/**
 * Staged, resumable pipeline (PRD §5.1). Each call claims the run, works in
 * small claim-locked batches until its time budget is used, saves progress
 * and releases the lock. A run that dies is picked up by the next call.
 * Steps: ingest → extract → evaluate → window → done.
 */

export type Step = "ingest" | "extract" | "evaluate" | "window" | "done";

export interface RunRow {
  id: string; trigger: "cron" | "manual"; started_at: string; finished_at: string | null;
  status: "running" | "done" | "failed"; step: Step; since: string | null;
  counts: Record<string, any>; errors: { at: string; step: string; message: string }[];
}

const EXTRACT_BATCH = 4;
// Callers keep budget + one unit of work (~90 s worst case) under the 300 s function limit.

export async function currentRun(): Promise<RunRow | null> {
  const rows = must(
    await db().from("runs").select("*").eq("status", "running").order("started_at", { ascending: false }).limit(1),
    "load run",
  ) as RunRow[];
  return rows[0] ?? null;
}

export async function latestRuns(n = 10): Promise<RunRow[]> {
  return must(await db().from("runs").select("*").order("started_at", { ascending: false }).limit(n), "load runs") as RunRow[];
}

/** Reuse the running run if there is one (idempotent), otherwise start a new one. */
export async function startRun(trigger: "cron" | "manual"): Promise<RunRow> {
  const running = await currentRun();
  if (running) {
    // A run stuck for 6 hours is abandoned so the pipeline cannot wedge.
    if (Date.now() - new Date(running.started_at).getTime() < 6 * 3600_000) return running;
    await db().from("runs").update({ status: "failed", finished_at: new Date().toISOString() }).eq("id", running.id);
  }
  const last = must(
    await db().from("runs").select("started_at").eq("status", "done").order("started_at", { ascending: false }).limit(1),
    "last run",
  ) as { started_at: string }[];
  // Items published since the last successful run, with a 12-hour overlap.
  const since = last[0] ? new Date(new Date(last[0].started_at).getTime() - 12 * 3600_000).toISOString() : null;
  return must(
    await db().from("runs").insert({ trigger, since, step: "ingest", counts: {} }).select("*").single(),
    "create run",
  ) as RunRow;
}

function bump(counts: Record<string, any>, key: string, by = 1) {
  counts[key] = (counts[key] ?? 0) + by;
}

async function save(run: RunRow, patch: Partial<RunRow> = {}) {
  Object.assign(run, patch);
  await db().from("runs").update({
    step: run.step, counts: run.counts, errors: run.errors.slice(-50), status: run.status, finished_at: run.finished_at,
  }).eq("id", run.id);
}

function recordError(run: RunRow, step: string, e: unknown) {
  run.errors = [...(run.errors ?? []), { at: new Date().toISOString(), step, message: String((e as Error)?.message ?? e).slice(0, 300) }];
}

/** Article text for extraction: feed content, else the page if robots allows, else title and summary. */
async function articleText(a: Record<string, any>): Promise<string> {
  const head = `${a.title}\n${a.summary ?? ""}`;
  const fetchable = a.publisher_domain && !/news\.google\.com/.test(a.url);
  if (a.body_text) {
    let body: string = a.body_text;
    // Stored before links were kept: add the article's outbound links (robots.txt permitting).
    if (!body.includes("Links in article:") && fetchable) {
      const page = await fetchPage(a.url, 9000);
      const m = page?.html.match(/<article[\s\S]*?<\/article>/i);
      const links = page ? extractLinks(m ? m[0] : page.html, domainOf(a.url)) : [];
      if (links.length) {
        body = `${body}\nLinks in article:\n${links.join("\n")}`;
        await db().from("articles").update({ body_text: truncate(body, 20000) }).eq("id", a.id);
      }
    }
    return truncate(`${head}\n${body}`, 14000);
  }
  if (fetchable) {
    const page = await fetchPage(a.url, 9000);
    if (page) {
      const m = page.html.match(/<article[\s\S]*?<\/article>/i);
      const paras = [...(m ? m[0] : page.html).matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((x) => htmlToText(x[1])).filter((t) => t.length > 40);
      const links = extractLinks(m ? m[0] : page.html, domainOf(a.url));
      const body = paras.join("\n") + (links.length ? `\nLinks in article:\n${links.join("\n")}` : "");
      if (paras.join("").length > 300) {
        await db().from("articles").update({ body_text: truncate(body, 20000) }).eq("id", a.id);
        return truncate(`${head}\n${body}`, 14000);
      }
    }
  }
  return head;
}

async function stepExtract(run: RunRow, deadline: number): Promise<boolean> {
  const supa = db();
  const [thesis, settings, stageMap] = await Promise.all([activeThesis(), loadSettings(), loadStageMap()]);
  const known = must(await supa.from("startups").select("id, name, name_norm, website_domain"), "load startups") as KnownStartup[];
  const ctx: PersistCtx = { runId: run.id, stageMap, usdInrRate: settings.usd_inr_rate, windowDays: thesis.window_days, known };

  while (Date.now() < deadline) {
    const batch = must(await supa.rpc("claim_articles", { p_run: run.id, p_limit: EXTRACT_BATCH }), "claim articles") as Record<string, any>[];
    if (!batch.length) return true;

    // Gemini calls in parallel; persistence in sequence so dedupe sees every insert.
    const results = await Promise.all(
      batch.map(async (a) => {
        try {
          const text = await articleText(a);
          const ex = await extractArticle({ runId: run.id, title: a.title, publisher: a.publisher, publishedAt: a.published_at, url: a.url, text });
          return { a, text, ex, err: null as unknown };
        } catch (err) {
          return { a, text: "", ex: null, err };
        }
      }),
    );

    let rateLimited = false;
    for (const { a, text, ex, err } of results) {
      if (err || !ex) {
        const retryable = err instanceof GeminiError && err.retryable;
        if (retryable) rateLimited = true;
        recordError(run, "extract", err);
        await supa.from("articles").update({
          extract_status: retryable ? "pending" : "failed", extract_error: String((err as Error)?.message).slice(0, 300),
        }).eq("id", a.id);
        continue;
      }
      bump(run.counts, "articles_read");
      const ref = { id: a.id, url: a.url, publisher: a.publisher, publisher_tier: a.publisher_tier, published_at: a.published_at, injection_suspected: ex.injection_suspected };
      for (const r of ex.rounds) {
        bump(run.counts, "rounds_found");
        const vr = verifyRound(r, text);
        if (vr.dropped.length) bump(run.counts, "facts_dropped", vr.dropped.length);
        try {
          const outcome = await persistRound(ref, vr, ctx);
          bump(run.counts, `round_${outcome}`);
        } catch (e) {
          recordError(run, "persist", e);
        }
      }
      if (ex.injection_suspected) bump(run.counts, "injection_flags");
      await supa.from("articles").update({ extract_status: ex.rounds.length ? "done" : "skipped", injection_suspected: ex.injection_suspected }).eq("id", a.id);
    }
    await save(run);
    if (rateLimited) return false; // pause; the next call resumes
  }
  return false;
}

async function stepEvaluate(run: RunRow, deadline: number): Promise<boolean> {
  const supa = db();
  const [thesis, settings, stageMap] = await Promise.all([activeThesis(), loadSettings(), loadStageMap()]);
  while (Date.now() < deadline) {
    const batch = must(await supa.rpc("claim_startups", { p_limit: 1 }), "claim startups") as Record<string, any>[];
    if (!batch.length) return true;
    const s = batch[0];
    try {
      const outcome = await evaluateStartup(s.id, { runId: run.id, thesis, settings, stageMap });
      bump(run.counts, "checked");
      if (outcome === "fit") { bump(run.counts, "scored"); bump(run.counts, "drafted"); bump(run.counts, "fits"); }
      else if (outcome === "worth_a_look" || outcome === "not_a_fit") { bump(run.counts, "scored"); bump(run.counts, outcome); }
      else bump(run.counts, outcome);
    } catch (e) {
      recordError(run, "evaluate", e);
      await supa.from("startups").update({ eval_claimed_at: null }).eq("id", s.id);
      if (e instanceof GeminiError && e.retryable) { await save(run); return false; }
    }
    await save(run);
  }
  return false;
}

/** T4 window milestones and T5 thesis changes, checked on every run. */
async function stepWindow(run: RunRow) {
  const supa = db();
  const thesis = await activeThesis();
  const open = must(
    await supa.from("startups").select("id, status, flags, first_announced_at").in("status", ["fit", "filtered", "unclear", "new"]).not("first_announced_at", "is", null),
    "load open startups",
  ) as Record<string, any>[];
  const latestScores = must(
    await supa.from("scores").select("startup_id, thesis_version, created_at").in("startup_id", open.map((o) => o.id).length ? open.map((o) => o.id) : ["00000000-0000-0000-0000-000000000000"]).order("created_at", { ascending: false }),
    "load scores",
  ) as Record<string, any>[];
  const versionOf = new Map<string, number>();
  for (const sc of latestScores) if (!versionOf.has(sc.startup_id)) versionOf.set(sc.startup_id, sc.thesis_version);

  for (const s of open) {
    const w = windowInfo(s.first_announced_at, new Date(), thesis.window_days, thesis.closing_days);
    const flags = new Set<string>(s.flags ?? []);
    let status = s.status;
    if (w.closed && s.status === "fit") {
      status = "closed";
      await supa.from("triggers").insert({ startup_id: s.id, type: "T4", detail: "Window closed", run_id: run.id });
      await supa.from("decisions").insert({ startup_id: s.id, action: "closed", reason: "Window closed", actor: "system" });
      bump(run.counts, "closed");
    } else if (w.closing && s.status === "fit" && !flags.has("Closing")) {
      flags.add("Closing");
      await supa.from("triggers").insert({ startup_id: s.id, type: "T4", detail: `Closing · ${w.daysLeft} days left`, run_id: run.id });
      bump(run.counts, "closing");
    }
    const v = versionOf.get(s.id);
    if (!w.closed && v != null && v < thesis.version && !flags.has("Older thesis")) {
      flags.add("Older thesis");
      await supa.from("triggers").insert({ startup_id: s.id, type: "T5", detail: `Scored on v${v}, active v${thesis.version}`, run_id: run.id });
    }
    if (status !== s.status || flags.size !== (s.flags ?? []).length) {
      await supa.from("startups").update({ status, flags: [...flags] }).eq("id", s.id);
    }
  }
}

/** Advance a run for up to `budgetMs`. Safe to call concurrently: the lock decides. */
export async function advanceRun(runId: string, budgetMs: number): Promise<RunRow> {
  const supa = db();
  const deadline = Date.now() + budgetMs;
  // The lock must outlast the slowest unit (page fetch + Gemini retries) so two calls never overlap.
  const lockSeconds = Math.min(290, Math.ceil(budgetMs / 1000) + 240);
  const claimed = must(await supa.rpc("claim_run", { p_run: runId, p_seconds: lockSeconds }), "claim run") as RunRow[];
  if (!claimed.length) {
    return must(await supa.from("runs").select("*").eq("id", runId).single(), "load run") as RunRow;
  }
  const run = claimed[0];
  run.errors = run.errors ?? [];
  run.counts = run.counts ?? {};
  try {
    while (run.status === "running" && Date.now() < deadline) {
      if (run.step === "ingest") {
        const results = await ingestSources(run.since ? new Date(run.since) : null);
        run.counts.sources = results;
        run.counts.sources_ok = results.filter((r) => r.ok).length;
        run.counts.fetched = results.reduce((s, r) => s + r.items, 0);
        run.counts.candidates = results.reduce((s, r) => s + r.candidates, 0);
        for (const r of results) if (!r.ok) recordError(run, "ingest", `${r.name}: ${r.error}`);
        await save(run, { step: "extract" });
      } else if (run.step === "extract") {
        const finished = await stepExtract(run, deadline);
        if (finished) await save(run, { step: "evaluate" });
        else break;
      } else if (run.step === "evaluate") {
        const finished = await stepEvaluate(run, deadline);
        if (finished) await save(run, { step: "window" });
        else break;
      } else if (run.step === "window") {
        await stepWindow(run);
        try {
          const g = await gmailStep();
          run.counts.gmail_drafts_created = (run.counts.gmail_drafts_created ?? 0) + g.created;
          run.counts.left_drafts = (run.counts.left_drafts ?? 0) + g.leftDrafts;
        } catch (e) {
          recordError(run, "gmail", e);
        }
        await save(run, { step: "done", status: "done", finished_at: new Date().toISOString() });
      } else {
        break;
      }
    }
  } catch (e) {
    recordError(run, run.step, e);
    await save(run);
  } finally {
    await supa.from("runs").update({ lock_until: null }).eq("id", run.id);
  }
  return run;
}
