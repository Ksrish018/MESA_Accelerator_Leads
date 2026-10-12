import "server-only";
import { db, must } from "./db";

/**
 * Pipeline view of one run (live or replay): what entered each stage, with
 * its source. Built from rows the run already writes, so there is no extra
 * logging path to fall out of sync.
 */

export type StageKey = "sources" | "articles" | "rounds" | "checked" | "scored" | "drafted";

export interface PipelineSource { name: string; url: string; tier: number; country: string | null; ok: boolean | null; items: number; candidates: number; error: string | null }
export interface PipelineArticle { id: string; title: string; url: string; publisher: string | null; tier: number | null; status: string }
export interface PipelineRound { id: string; startupId: string; startup: string; stage: string | null; amount: string | null; publisher: string | null; url: string; location: string | null }
export interface PipelineCheck { id: string; name: string; passed: boolean; reason: string | null; location: string | null }
export interface PipelineScore { id: string; name: string; total: number; bucket: string | null; version: number }
export interface PipelineDraft { id: string; name: string; subject: string }

export interface PipelineRun {
  id: string; status: string; step: string; trigger: string; started_at: string; finished_at: string | null;
  counts: Record<string, any>; errors: number;
}

export interface PipelineView {
  run: PipelineRun | null;
  runs: { id: string; started_at: string; status: string; trigger: string }[];
  sources: PipelineSource[];
  articles: PipelineArticle[];
  articlesTotal: number;
  rounds: PipelineRound[];
  checked: PipelineCheck[];
  scored: PipelineScore[];
  drafted: PipelineDraft[];
}

const LIMIT = 80;

export async function pipelineView(runId?: string | null): Promise<PipelineView> {
  const supa = db();
  const runs = must(
    await supa.from("runs").select("id, started_at, status, trigger").order("started_at", { ascending: false }).limit(12),
    "load runs",
  ) as PipelineView["runs"];
  const id = runId && runs.some((r) => r.id === runId) ? runId : runs[0]?.id;
  const allSources = must(await supa.from("sources").select("name, url, tier, country, enabled").eq("enabled", true).order("tier").order("name"), "load sources") as { name: string; url: string; tier: number; country: string | null }[];

  if (!id) {
    return {
      run: null, runs,
      sources: allSources.map((s) => ({ ...s, ok: null, items: 0, candidates: 0, error: null })),
      articles: [], articlesTotal: 0, rounds: [], checked: [], scored: [], drafted: [],
    };
  }

  const r = must(await supa.from("runs").select("*").eq("id", id).single(), "load run") as Record<string, any>;
  const from = r.started_at as string;
  const to = (r.finished_at as string | null) ?? new Date(Date.now() + 60_000).toISOString();

  const ingested = (r.counts?.sources ?? []) as { name: string; ok: boolean; items: number; candidates: number; error?: string }[];
  const sources: PipelineSource[] = allSources.map((s) => {
    const x = ingested.find((i) => i.name === s.name);
    return { ...s, ok: x ? x.ok : null, items: x?.items ?? 0, candidates: x?.candidates ?? 0, error: x?.error ?? null };
  });

  const [articles, articleCount, rounds, scores, drafts] = await Promise.all([
    supa.from("articles").select("id, title, url, publisher, publisher_tier, extract_status, claimed_at").eq("claimed_by", id).order("claimed_at", { ascending: false }).limit(LIMIT),
    supa.from("articles").select("id", { count: "exact", head: true }).eq("claimed_by", id),
    supa.from("rounds").select("id, startup_id, stage_text, amount_text, publisher, source_url, location, created_at, startups(name)").gte("created_at", from).lte("created_at", to).order("created_at", { ascending: false }).limit(LIMIT),
    supa.from("scores").select("startup_id, thesis_version, total, bucket, hard_rule_failed, created_at, startups(name, location)").gte("created_at", from).lte("created_at", to).order("created_at", { ascending: false }).limit(LIMIT * 2),
    supa.from("drafts").select("startup_id, subject, created_at, startups(name)").gte("created_at", from).lte("created_at", to).order("created_at", { ascending: false }).limit(LIMIT),
  ]);

  const name = (x: any) => (Array.isArray(x) ? x[0]?.name : x?.name) ?? "Unknown";
  const loc = (x: any) => (Array.isArray(x) ? x[0]?.location : x?.location) ?? null;

  // One entry per startup: the latest score in this run.
  const seen = new Set<string>();
  const latestScores = ((scores.data ?? []) as Record<string, any>[]).filter((s) => (seen.has(s.startup_id) ? false : (seen.add(s.startup_id), true)));

  return {
    run: {
      id: r.id, status: r.status, step: r.step, trigger: r.trigger, started_at: r.started_at, finished_at: r.finished_at,
      counts: Object.fromEntries(Object.entries(r.counts ?? {}).filter(([k]) => k !== "sources")), errors: (r.errors ?? []).length,
    },
    runs,
    sources,
    articles: ((articles.data ?? []) as Record<string, any>[]).map((a) => ({
      id: a.id, title: a.title, url: a.url, publisher: a.publisher, tier: a.publisher_tier, status: a.extract_status,
    })),
    articlesTotal: articleCount.count ?? 0,
    rounds: ((rounds.data ?? []) as Record<string, any>[]).map((x) => ({
      id: x.id, startupId: x.startup_id, startup: name(x.startups), stage: x.stage_text, amount: x.amount_text,
      publisher: x.publisher, url: x.source_url, location: x.location,
    })),
    checked: latestScores.map((s) => ({
      id: s.startup_id, name: name(s.startups), passed: !s.hard_rule_failed, reason: s.hard_rule_failed ?? null, location: loc(s.startups),
    })),
    scored: latestScores.filter((s) => s.total != null).map((s) => ({
      id: s.startup_id, name: name(s.startups), total: s.total, bucket: s.bucket, version: s.thesis_version,
    })),
    drafted: ((drafts.data ?? []) as Record<string, any>[]).map((d) => ({ id: d.startup_id, name: name(d.startups), subject: d.subject })),
  };
}

export async function allStartups() {
  return must(
    await db().from("startups").select("id, name, status, bucket, filter_reason, location, first_announced_at, source_count, flags, updated_at").eq("sample", false).order("first_announced_at", { ascending: false, nullsFirst: false }).limit(400),
    "load startups",
  ) as Record<string, any>[];
}
