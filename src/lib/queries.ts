import "server-only";
import { db, must } from "./db";
import { formatUsd } from "./extract/amount";
import { STAGE_LABEL } from "./extract/stage";
import { whatTheyDo } from "./score/facts";
import { confidence, sortByPriority, warmPath } from "./score/priority";
import { activeThesis, loadSettings } from "./thesis/load";
import { windowInfo } from "./thesis/window";
import type { CriterionScore, Contact, Stage } from "./types";

/** Read model for the screens. Server only; nothing here is sent to Gemini. */

export interface SourceLink { url: string; publisher: string | null; tier: number | null; published_at: string | null }
export interface SignalView { group: string; name: string; label: string; value: string | null; quote: string | null; source_url: string | null }

export interface CardView {
  id: string;
  name: string;
  what: { quote: string; source_url: string | null } | null;
  stage: Stage;
  stageLabel: string;
  stageText: string | null;
  amountText: string | null;
  amountUsd: string | null;
  amountConflict: string[] | null;
  day: number;
  daysLeft: number;
  windowDays: number;
  closing: boolean;
  announcedAt: string;
  total: number | null;
  thesisVersion: number | null;
  olderThesis: boolean;
  topCriteria: CriterionScore[];
  chips: { key: string; label: string }[];
  confidenceLabel: string;
  confidenceRank: number;
  flags: string[];
  warm: string | null;
  sources: SourceLink[];
  status: string;
  bucket: string | null;
  filterReason: string | null;
  sample?: boolean;
}

const SIGNAL_LABEL: Record<string, string> = {
  first_institutional: "First institutional round",
  business_model: "Business model",
  customer_type: "Customer type",
  use_of_funds: "Use of funds",
  accelerator_mention: "In another accelerator",
  traction_customers: "Named customers",
  traction_revenue: "Revenue",
  traction_users: "Users",
  traction_launch: "Launch",
  traction_partnership: "Partnership",
  founder_background: "Team",
};

async function inIds<T>(table: string, column: string, ids: string[], select = "*", order?: string): Promise<T[]> {
  if (!ids.length) return [];
  let q = db().from(table).select(select).in(column, ids);
  if (order) q = q.order(order, { ascending: false });
  return must(await q, `load ${table}`) as T[];
}

function groupBy<T extends Record<string, any>>(rows: T[], key: string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) m.set(r[key], [...(m.get(r[key]) ?? []), r]);
  return m;
}

export async function buildCards(startups: Record<string, any>[]): Promise<CardView[]> {
  const [thesis, settings] = await Promise.all([activeThesis(), loadSettings()]);
  const ids = startups.map((s) => s.id);
  const [rounds, scores, research, signals] = await Promise.all([
    inIds<Record<string, any>>("rounds", "startup_id", ids, "*"),
    inIds<Record<string, any>>("scores", "startup_id", ids, "*", "created_at"),
    inIds<Record<string, any>>("research", "startup_id", ids, "startup_id, url, description, contacts"),
    inIds<Record<string, any>>("signals", "startup_id", ids, "startup_id, name, grp"),
  ]);
  const R = groupBy(rounds, "startup_id");
  const S = groupBy(scores, "startup_id");
  const W = groupBy(research, "startup_id");
  const G = groupBy(signals, "startup_id");

  return startups.map((s) => {
    const rs = (R.get(s.id) ?? []).sort((a, b) => (a.publisher_tier ?? 9) - (b.publisher_tier ?? 9));
    const sc = (S.get(s.id) ?? [])[0] ?? null;
    const rw = (W.get(s.id) ?? [])[0] ?? null;
    const sig = G.get(s.id) ?? [];
    const lead = rs.find((r) => r.stage && r.stage !== "unknown") ?? rs[0];
    const w = windowInfo(s.first_announced_at ?? s.created_at, new Date(), thesis.window_days, thesis.closing_days);
    const investors = [...new Set(rs.flatMap((r) => r.investors ?? []))];
    const warm = warmPath(investors, settings.network_investors);
    const conf = confidence(s.source_count || rs.length, s.has_tier1, !(s.flags ?? []).includes("Unverified facts dropped"));
    const amounts = [...new Set(rs.map((r) => r.amount_text).filter(Boolean))] as string[];
    const chips: { key: string; label: string }[] = [];
    if (sig.some((x) => x.name === "first_institutional")) chips.push({ key: "first_institutional", label: "First institutional round" });
    if (sig.some((x) => x.name === "traction_customers")) chips.push({ key: "named_customers", label: "Named customers" });
    if (sig.some((x) => x.name === "use_of_funds")) chips.push({ key: "use_of_funds", label: "Use of funds" });
    if (warm) chips.push({ key: "warm", label: `Warm path · ${warm}` });
    const criteria = ((sc?.criteria ?? []) as CriterionScore[])
      .filter((c) => c.evidence_quote && c.score_0_5 > 0)
      .sort((a, b) => b.score_0_5 * b.weight - a.score_0_5 * a.weight)
      .slice(0, 2);
    return {
      id: s.id,
      name: s.name,
      what: whatTheyDo(rs, rw as { url: string | null; description: string | null } | null),
      stage: (lead?.stage ?? "unknown") as Stage,
      stageLabel: STAGE_LABEL[(lead?.stage ?? "unknown") as Stage],
      stageText: lead?.stage_text ?? null,
      amountText: lead?.amount_text ?? null,
      amountUsd: formatUsd(Number(lead?.amount_usd_est) || null),
      amountConflict: (s.flags ?? []).includes("Conflicting amounts") && amounts.length > 1 ? amounts : null,
      day: w.day,
      daysLeft: w.daysLeft,
      windowDays: thesis.window_days,
      closing: w.closing,
      announcedAt: s.first_announced_at ?? s.created_at,
      total: sc?.total ?? null,
      thesisVersion: sc?.thesis_version ?? null,
      olderThesis: sc?.thesis_version != null && sc.thesis_version < thesis.version,
      topCriteria: criteria,
      chips,
      confidenceLabel: conf.label,
      confidenceRank: conf.rank,
      flags: (s.flags ?? []).filter((f: string) => f !== "Closing"),
      warm,
      sources: rs.map((r) => ({ url: r.source_url, publisher: r.publisher, tier: r.publisher_tier, published_at: r.published_at })),
      status: s.status,
      bucket: s.bucket,
      filterReason: s.filter_reason,
    };
  });
}

/** Today: undecided Fits in priority order (PRD §7.4). */
export async function todayCards(): Promise<CardView[]> {
  const rows = must(await db().from("startups").select("*").eq("status", "fit").eq("sample", false), "load fits") as Record<string, any>[];
  const cards = (await buildCards(rows)).filter((c) => c.daysLeft >= 0);
  const byId = new Map(cards.map((c) => [c.id, c]));
  return sortByPriority(cards.map((c) => ({
    id: c.id, total: c.total ?? 0, daysLeft: c.daysLeft, closing: c.closing, warm: !!c.warm,
    confidenceRank: c.confidenceRank, announcedAt: c.announcedAt,
  }))).map((p) => byId.get(p.id)!);
}

export async function lastRun() {
  const r = await db().from("runs").select("*").order("started_at", { ascending: false }).limit(5);
  const runs = (r.data ?? []) as Record<string, any>[];
  return { latest: runs[0] ?? null, lastDone: runs.find((x) => x.status === "done") ?? null };
}

export async function kpis(sinceIso: string | null) {
  const supa = db();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [newRounds, fits, drafted] = await Promise.all([
    sinceIso
      ? supa.from("triggers").select("id", { count: "exact", head: true }).eq("type", "T1").gte("created_at", sinceIso)
      : supa.from("triggers").select("id", { count: "exact", head: true }).eq("type", "T1"),
    supa.from("startups").select("id", { count: "exact", head: true }).eq("bucket", "fit").in("status", ["fit", "drafted", "sent", "replied", "skipped"]),
    supa.from("outreach").select("startup_id", { count: "exact", head: true }).eq("status", "drafted").gte("at", weekAgo),
  ]);
  return { newRounds: newRounds.count ?? 0, fits: fits.count ?? 0, draftedWeek: drafted.count ?? 0 };
}

export async function filteredCards() {
  const rows = must(
    await db().from("startups").select("*").in("status", ["filtered", "unclear", "closed"]).eq("sample", false).order("updated_at", { ascending: false }).limit(200),
    "load filtered",
  ) as Record<string, any>[];
  const cards = await buildCards(rows);
  const contacted = must(
    await db().from("startups").select("*").in("status", ["drafted", "sent", "replied", "skipped"]).order("updated_at", { ascending: false }).limit(100),
    "load contacted",
  ) as Record<string, any>[];
  return { cards, contacted: await buildCards(contacted) };
}

export interface ReviewView {
  card: CardView;
  startup: Record<string, any>;
  rounds: Record<string, any>[];
  signals: SignalView[];
  criteria: CriterionScore[];
  draft: Record<string, any> | null;
  research: { url: string | null; title: string | null; description: string | null; contacts: Contact[]; ok: boolean; error: string | null } | null;
  outreach: Record<string, any> | null;
  queue: { ids: string[]; index: number };
  hardRule: string | null;
}

export async function reviewView(id: string): Promise<ReviewView | null> {
  const supa = db();
  const s = (await supa.from("startups").select("*").eq("id", id).maybeSingle()).data as Record<string, any> | null;
  if (!s) return null;
  const [card] = await buildCards([s]);
  const [rounds, signals, score, draft, research, outreach, queue] = await Promise.all([
    supa.from("rounds").select("*").eq("startup_id", id),
    supa.from("signals").select("*").eq("startup_id", id),
    supa.from("scores").select("*").eq("startup_id", id).order("created_at", { ascending: false }).limit(1),
    supa.from("drafts").select("*").eq("startup_id", id).order("created_at", { ascending: false }).limit(1),
    supa.from("research").select("*").eq("startup_id", id).maybeSingle(),
    supa.from("outreach").select("*").eq("startup_id", id).maybeSingle(),
    todayCards(),
  ]);
  const ids = queue.map((c) => c.id);
  return {
    card,
    startup: s,
    rounds: ((rounds.data ?? []) as Record<string, any>[]).sort((a, b) => (a.publisher_tier ?? 9) - (b.publisher_tier ?? 9)),
    signals: ((signals.data ?? []) as Record<string, any>[]).map((x) => ({
      group: x.grp, name: x.name, label: SIGNAL_LABEL[x.name] ?? x.name, value: x.value, quote: x.quote, source_url: x.source_url,
    })),
    criteria: ((score.data?.[0]?.criteria ?? []) as CriterionScore[]),
    draft: (draft.data?.[0] ?? null) as Record<string, any> | null,
    research: research.data as ReviewView["research"],
    outreach: outreach.data as Record<string, any> | null,
    queue: { ids, index: ids.indexOf(id) },
    hardRule: score.data?.[0]?.hard_rule_failed ?? null,
  };
}

export async function runsView() {
  const supa = db();
  const [runs, sources, calls, decisions] = await Promise.all([
    supa.from("runs").select("*").order("started_at", { ascending: false }).limit(10),
    supa.from("sources").select("*").order("tier").order("name"),
    supa.from("llm_calls").select("run_id, step, model, tokens_in, tokens_out, cost_usd_est, ok, created_at").gte("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString()),
    supa.from("decisions").select("action, reason, actor, at").eq("actor", "rohit").gte("at", new Date(Date.now() - 30 * 86_400_000).toISOString()),
  ]);
  return {
    runs: (runs.data ?? []) as Record<string, any>[],
    sources: (sources.data ?? []) as Record<string, any>[],
    calls: (calls.data ?? []) as Record<string, any>[],
    decisions: (decisions.data ?? []) as Record<string, any>[],
  };
}
