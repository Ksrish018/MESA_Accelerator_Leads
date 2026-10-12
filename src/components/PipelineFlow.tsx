"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PipelineView, StageKey } from "@/lib/pipeline";
import { fmtTime, hostOf } from "@/lib/format";
import { CountUp } from "./CountUp";
import { FlowRibbon } from "./FlowRibbon";
import { RunNow } from "./RunNow";

const STAGES: { key: StageKey; title: string }[] = [
  { key: "sources", title: "Sources" },
  { key: "articles", title: "Articles" },
  { key: "rounds", title: "Rounds" },
  { key: "checked", title: "Checked" },
  { key: "scored", title: "Scored" },
  { key: "drafted", title: "Drafted" },
];

const STEP_LABEL: Record<string, string> = {
  ingest: "Reading sources", extract: "Reading articles", evaluate: "Checking and scoring", window: "Updating windows", done: "Complete",
};

/** Stages a step is working on. */
const ACTIVE: Record<string, StageKey[]> = {
  ingest: ["sources"], extract: ["articles", "rounds"], evaluate: ["checked", "scored", "drafted"], window: ["drafted"], done: [],
};

const ARTICLE_STATUS: Record<string, { label: string; tone: string }> = {
  done: { label: "Rounds found", tone: "green" }, skipped: { label: "No round", tone: "grey" },
  failed: { label: "Failed", tone: "red" }, claimed: { label: "Reading", tone: "blue" }, pending: { label: "Queued", tone: "grey" },
};

const BUCKET: Record<string, { label: string; tone: string }> = {
  fit: { label: "Fit", tone: "green" }, worth_a_look: { label: "Worth a look", tone: "blue" }, not_a_fit: { label: "Not a fit", tone: "grey" },
};

function minutes(a: string, b: string | null) {
  const m = Math.max(1, Math.round(((b ? new Date(b).getTime() : Date.now()) - new Date(a).getTime()) / 60000));
  return `${m} min`;
}

export function PipelineFlow({ initial, table }: { initial: PipelineView; table?: React.ReactNode }) {
  const [view, setView] = useState<PipelineView>(initial);
  const [tab, setTab] = useState<"flow" | "startups">("flow");
  const [pinned, setPinned] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bump, setBump] = useState(0);

  // Run now on any screen announces its run; follow it at once.
  useEffect(() => {
    const h = () => setBump((b) => b + 1);
    window.addEventListener("fr:run", h);
    return () => window.removeEventListener("fr:run", h);
  }, []);
  const seen = useRef<Set<string>>(new Set());
  const first = useRef(true);

  const running = view.run?.status === "running";
  const status = useRef(view.run?.status);
  status.current = view.run?.status;

  // Live every 2.5 s while a run is in progress; otherwise every 12 s to pick up a new run (cron or Run now).
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const res = await fetch(`/api/pipeline${pinned ? `?runId=${pinned}` : ""}`, { cache: "no-store" });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
        if (!stop) { status.current = j.run?.status; setView(j); setError(null); }
      } catch (e) {
        if (!stop) setError((e as Error).message);
      }
      if (!stop) timer = setTimeout(tick, status.current === "running" ? 2500 : 12000);
    };
    timer = setTimeout(tick, pinned || bump ? 0 : status.current === "running" ? 2500 : 12000);
    return () => { stop = true; clearTimeout(timer); };
  }, [pinned, bump]);

  // Items not seen before glide in; on first paint they enter in a short stagger (replay).
  const fresh = (key: string) => !seen.current.has(key);
  useEffect(() => {
    for (const a of view.articles) seen.current.add(`a:${a.id}`);
    for (const r of view.rounds) seen.current.add(`r:${r.id}`);
    for (const c of view.checked) seen.current.add(`c:${c.id}`);
    for (const s of view.scored) seen.current.add(`s:${s.id}`);
    for (const d of view.drafted) seen.current.add(`d:${d.id}`);
    for (const s of view.sources) seen.current.add(`src:${s.name}:${s.ok}`);
    first.current = false;
  }, [view]);

  const active = new Set<StageKey>(running ? ACTIVE[view.run?.step ?? ""] ?? [] : []);
  const c = view.run?.counts ?? {};
  const okSources = view.sources.filter((s) => s.ok).length;
  const counts: Record<StageKey, number> = {
    sources: okSources,
    articles: view.articlesTotal,
    rounds: c.rounds_found ?? view.rounds.length,
    checked: view.checked.length,
    scored: view.scored.length,
    drafted: view.drafted.length,
  };
  const reached = (i: number) => STAGES.slice(i).some((s) => counts[s.key] > 0) || active.has(STAGES[i].key);

  const enter = (key: string, i: number) => {
    const isNew = fresh(key);
    if (!isNew) return undefined;
    return { className: "glide", style: { animationDelay: `${first.current ? Math.min(i, 14) * 45 : 0}ms` } };
  };

  const sub = useMemo(() => ({
    sources: `${view.sources.length} feeds · ${view.sources.reduce((s, x) => s + x.items, 0)} items`,
    articles: `${c.candidates ?? 0} funding candidates`,
    rounds: `${c.round_new ?? 0} new · ${c.round_more_coverage ?? 0} more coverage · ${c.round_historical ?? 0} historical`,
    checked: `${view.checked.filter((x) => x.passed).length} passed hard rules`,
    scored: `${view.scored.filter((x) => x.bucket === "fit").length} Fit · ${view.scored.filter((x) => x.bucket === "worth_a_look").length} worth a look`,
    drafted: "Waiting in Today",
  }), [view, c]);

  return (
    <section className="stack-16 pipeline" aria-label="Pipeline" data-run={view.run?.id ?? ""}>
      <div className="row between">
        <div className="stack-8">
          <div className="row">
            {view.run ? (
              <span className={`chip ${running ? "chip-blue live-dot" : view.run.status === "done" ? "chip-green" : "chip-red"}`}>
                {running ? STEP_LABEL[view.run.step] ?? "Running" : view.run.status === "done" ? "Complete" : "Failed"}
              </span>
            ) : <span className="chip">No runs yet</span>}
            {view.run ? (
              <span className="small muted">
                {view.run.trigger === "cron" ? "Daily 06:00 IST" : "Run now"} · started {fmtTime(view.run.started_at)} · {minutes(view.run.started_at, view.run.finished_at)}
                {view.run.errors ? ` · ${view.run.errors} errors` : ""}
              </span>
            ) : null}
          </div>
        </div>
        <div className="row">
          <div className="segmented" role="tablist" aria-label="View">
            <button role="tab" aria-selected={tab === "flow"} className={tab === "flow" ? "on" : ""} onClick={() => setTab("flow")}>Flow</button>
            <button role="tab" aria-selected={tab === "startups"} className={tab === "startups" ? "on" : ""} onClick={() => setTab("startups")}>Startups</button>
          </div>
          {view.runs.length > 1 && tab === "flow" ? (
            <label className="row small">
              <span className="sr-only">Run</span>
              <select className="field" style={{ width: "auto", padding: "8px 12px" }} value={pinned ?? ""} onChange={(e) => setPinned(e.target.value || null)}>
                <option value="">Latest run</option>
                {view.runs.map((r) => (
                  <option key={r.id} value={r.id}>{new Date(r.started_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })} IST · {r.status}</option>
                ))}
              </select>
            </label>
          ) : null}
          <RunNow resumeId={running ? view.run!.id : null} label={running ? "Resume run" : "Run now"} />
        </div>
      </div>
      {error ? <p className="small" role="alert" style={{ color: "var(--chip-red)", margin: 0 }}>Live updates paused. {error}</p> : null}

      {tab === "startups" ? <div className="startups-pane">{table}</div> : null}
      {tab === "flow" ? (
      <>
      <FlowRibbon
        counts={STAGES.map((s) => counts[s.key])}
        activeIndex={STAGES.map((s, i) => (active.has(s.key) ? i : -1)).filter((i) => i >= 0)}
        running={running}
      />
      <div className="flow" role="list">
        {STAGES.map((s, i) => (
          <div key={s.key} className="flow-cell" role="listitem">
            <div className={`stage${active.has(s.key) ? " stage-active" : ""}${reached(i) ? "" : " stage-idle"}`} aria-busy={active.has(s.key)}>
              <div className="stage-head">
                <span className="eyebrow">{s.title}</span>
                <span className="stage-n"><CountUp value={counts[s.key]} /></span>
                <span className="tiny muted">{sub[s.key]}</span>
              </div>
              <ul className="stage-list">
                {s.key === "sources" && view.sources.map((x, j) => (
                  <li key={x.name} {...enter(`src:${x.name}:${x.ok}`, j)}>
                    <span className={`dot ${x.ok === null ? "dot-idle" : x.ok ? "dot-ok" : "dot-bad"}`} aria-label={x.ok === null ? "Not read yet" : x.ok ? "Responded" : "Failed"} />
                    <span className="grow">
                      <a href={x.url} target="_blank" rel="noreferrer">{x.name}</a>
                      <span className="tiny muted"> · Tier {x.tier}{x.country ? ` · ${x.country}` : ""}{x.ok ? ` · ${x.items} items` : x.error ? ` · ${x.error.slice(0, 24)}` : ""}</span>
                    </span>
                  </li>
                ))}
                {s.key === "articles" && view.articles.map((a, j) => (
                  <li key={a.id} {...enter(`a:${a.id}`, j)}>
                    <span className="grow">
                      <a href={a.url} target="_blank" rel="noreferrer" className="clamp-2">{a.title}</a>
                      <span className="tiny muted">{a.publisher ?? hostOf(a.url)} · </span>
                      <span className={`tiny tone-${ARTICLE_STATUS[a.status]?.tone ?? "grey"}`}>{ARTICLE_STATUS[a.status]?.label ?? a.status}</span>
                    </span>
                  </li>
                ))}
                {s.key === "rounds" && view.rounds.map((r, j) => (
                  <li key={r.id} {...enter(`r:${r.id}`, j)}>
                    <span className="grow">
                      <Link href={`/review/${r.startupId}`} style={{ fontWeight: 600, color: "var(--text)" }}>{r.startup}</Link>
                      <span className="tiny muted"> · {[r.stage ?? "Stage undisclosed", r.amount, r.location].filter(Boolean).join(" · ")}</span>
                      <a className="tiny" href={r.url} target="_blank" rel="noreferrer"> · {r.publisher ?? hostOf(r.url)}</a>
                    </span>
                  </li>
                ))}
                {s.key === "checked" && view.checked.map((x, j) => (
                  <li key={x.id} {...enter(`c:${x.id}`, j)}>
                    <span className={`dot ${x.passed ? "dot-ok" : "dot-bad"}`} aria-hidden />
                    <span className="grow">
                      <Link href={`/review/${x.id}`} style={{ color: "var(--text)" }}>{x.name}</Link>
                      <span className="tiny muted"> · {x.passed ? "Passed" : x.reason}</span>
                    </span>
                  </li>
                ))}
                {s.key === "scored" && view.scored.map((x, j) => (
                  <li key={x.id} {...enter(`s:${x.id}`, j)}>
                    <span className="grow">
                      <Link href={`/review/${x.id}`} style={{ color: "var(--text)" }}>{x.name}</Link>
                      <span className="tiny muted"> · {x.total}/100 · v{x.version}</span>
                    </span>
                    <span className={`chip chip-${BUCKET[x.bucket ?? ""]?.tone ?? "grey"}`}>{BUCKET[x.bucket ?? ""]?.label ?? "Scored"}</span>
                  </li>
                ))}
                {s.key === "drafted" && view.drafted.map((d, j) => (
                  <li key={d.id} {...enter(`d:${d.id}`, j)}>
                    <span className="grow">
                      <Link href={`/review/${d.id}`} style={{ fontWeight: 600, color: "var(--text)" }}>{d.name}</Link>
                      <span className="tiny muted clamp-2"> {d.subject}</span>
                    </span>
                  </li>
                ))}
                {((s.key === "articles" && !view.articles.length) || (s.key === "rounds" && !view.rounds.length) || (s.key === "checked" && !view.checked.length) || (s.key === "scored" && !view.scored.length) || (s.key === "drafted" && !view.drafted.length)) ? (
                  <li className="tiny muted">{active.has(s.key) ? "Working" : "None in this run"}</li>
                ) : null}
              </ul>
            </div>
            {i < STAGES.length - 1 ? (
              <div className={`connector${running && (active.has(s.key) || active.has(STAGES[i + 1].key)) ? " connector-live" : ""}${reached(i + 1) ? " connector-reached" : ""}`} aria-hidden>
                <svg viewBox="0 0 40 8" preserveAspectRatio="none"><line x1="0" y1="4" x2="40" y2="4" /></svg>
                <i className="spark" />
              </div>
            ) : null}
          </div>
        ))}
      </div>
      </>
      ) : null}
    </section>
  );
}
