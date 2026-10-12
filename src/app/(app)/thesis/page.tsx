import { ActionButton } from "@/components/ActionButton";
import { PageHero } from "@/components/Hero";
import { formatUsd } from "@/lib/extract/amount";
import { fmtDateTime } from "@/lib/format";
import { thesisHistory } from "@/lib/thesis/load";
import type { Thesis } from "@/lib/types";

export const metadata = { title: "Thesis" };
export const dynamic = "force-dynamic";

const STAGE: Record<string, string> = { pre_seed: "Pre-seed", seed: "Seed", other: "Later stage", unknown: "Undisclosed" };
const DISQ: Record<string, string> = { acquired: "Acquired", shutdown: "Shut down", debt_only: "Debt-only round", grant_only: "Grant-only round", not_a_startup: "Not a startup" };

function summarize(t: Thesis): Record<string, string> {
  return {
    Stages: t.stages.map((s) => STAGE[s] ?? s).join(", "),
    Geography: t.geographies.join(", "),
    "Include sectors": t.include_sectors.join(", "),
    "Exclude sectors": t.exclude_sectors.join(", "),
    "Round size": `${formatUsd(t.min_round_usd) ?? "any"} to ${formatUsd(t.max_round_usd) ?? "any"}`,
    Disqualifiers: t.disqualifiers.map((d) => DISQ[d] ?? d).join(", "),
    Criteria: t.criteria.map((c) => `${c.name} ${c.weight}`).join(" · "),
    Thresholds: `Fit ≥ ${t.fit_threshold} · Worth a look ≥ ${t.review_threshold}`,
    Window: `${t.window_days} days · Closing from ${t.closing_days} days left`,
  };
}

function supabaseTableUrl(): string | null {
  const ref = process.env.SUPABASE_URL?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
  return ref ? `https://supabase.com/dashboard/project/${ref}/editor` : null;
}

export default async function ThesisPage() {
  const versions = await thesisHistory();
  const active = versions.find((v) => v.is_active) ?? versions[0];
  const prev = active ? versions.find((v) => v.version < active.version) : undefined;
  const now = active ? summarize(active) : {};
  const before = prev ? summarize(prev) : null;
  const link = supabaseTableUrl();

  return (
    <>
      <PageHero slot="thesis" title="Thesis" meta={active ? `Version ${active.version} · active since ${fmtDateTime(active.created_at)}` : "No active version"} />
      <div className="wrap wrap-narrow section stack-24">
        {active ? (
          <section className="card stack-16 reveal">
            {Object.entries(now).map(([k, v]) => (
              <div key={k} className="fact">
                <div className="fact-label">{k}</div>
                <div style={{ fontSize: 19, letterSpacing: "-0.015em" }}>{v}</div>
              </div>
            ))}
            {active.criteria.map((c) => (
              <div key={c.key} className="fact">
                <div className="fact-label">{c.name} · weight {c.weight}</div>
                <div className="small">{c.description}</div>
              </div>
            ))}
            {link ? (
              <div className="row" style={{ paddingTop: 8 }}>
                <a className="btn btn-secondary btn-sm" href={link} target="_blank" rel="noreferrer">Open thesis_versions in Supabase</a>
                <ActionButton path="/api/rescore" label="Rescore all in window" busyLabel="Queuing"
                  done={(j) => (j.queued ? `${j.queued} startups queued for v${j.version} · Run now to score them` : "Every startup in window is on the active thesis")} />
              </div>
            ) : null}
          </section>
        ) : null}

        {before ? (
          <section className="stack-16 reveal reveal-1">
            <h2 className="h2">Changes from version {prev!.version}</h2>
            <div className="card">
              {Object.keys(now).filter((k) => now[k] !== before[k]).map((k) => (
                <div key={k} className="fact">
                  <div className="fact-label">{k}</div>
                  <div className="small"><span className="diff-del">{before[k]}</span></div>
                  <div className="small" style={{ marginTop: 4 }}><span className="diff-add">{now[k]}</span></div>
                </div>
              ))}
              {Object.keys(now).every((k) => now[k] === before[k]) ? <p className="small muted" style={{ margin: 0 }}>No differences in the fields above.</p> : null}
            </div>
          </section>
        ) : null}

        <section className="stack-16 reveal reveal-2">
          <h2 className="h2">Versions</h2>
          <div className="list">
            {versions.map((v) => (
              <div key={v.id} className="list-row">
                <strong className="num">v{v.version}</strong>
                <span className="grow small">{v.note ?? ""}</span>
                <span className="small muted">{fmtDateTime(v.created_at)}</span>
                {v.is_active ? <span className="chip chip-green">Active</span> : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
