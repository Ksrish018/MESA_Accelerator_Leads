"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CHIP_HELP, HELP_ORDER } from "@/lib/chips";
import { formatUsd } from "@/lib/extract/amount";
import { Chip } from "./Chip";
import { useTour } from "./Tour";

interface Meta {
  sources: { name: string; url: string; tier: number; country: string | null; kind: string }[];
  thesis: {
    version: number; stages: string[]; geographies: string[]; include_sectors: string[]; exclude_sectors: string[];
    min_round_usd: number | null; max_round_usd: number | null; disqualifiers: string[];
    criteria: { name: string; weight: number; kind: string; description: string }[];
    fit_threshold: number; review_threshold: number; window_days: number; closing_days: number;
  };
}

/** Every check a startup passes through, in pipeline order. One line each. */
const CHECKS: [string, string][] = [
  ["Funding filter", "Only headlines and summaries that mention a raise, round or amount are read."],
  ["Facts with quotes", "Gemini Flash extracts each fact with a verbatim quote from the article."],
  ["Quote check", "A fact whose quote is not in the source text is dropped and flagged."],
  ["New round only", "Earlier rounds mentioned in passing never count."],
  ["Stage", "Pre-seed and seed only. Pre-Series A, bridge and Series A or later are filtered."],
  ["One company, many outlets", "Coverage of the same round merges into one startup with several sources."],
  ["Credible source", "At least one Tier 1 or Tier 2 source is required."],
  ["60-day window", "Announced within 60 days. Closing from day 50."],
  ["Already contacted", "Any company with an outreach record is never drafted again."],
  ["Disqualifiers", "Acquired, shut down, debt-only, grant-only, or not a startup."],
  ["Sector and geography", "Excluded sectors and the thesis geography are hard rules."],
  ["Fit score", "Gemini rates each criterion 0 to 5 with evidence; code adds up the weighted total."],
  ["Draft check", "Every claim must map to a checked fact. Banned phrases, emojis and ! fail."],
  ["Contacts", "Only addresses the company publishes. Never guessed."],
];

const STAGE: Record<string, string> = { pre_seed: "Pre-seed", seed: "Seed" };
const REGION: Record<string, string> = { IN: "India", US: "United States", EU: "Europe", SEA: "Southeast Asia", AFRICA: "Africa", LATAM: "Latin America", GLOBAL: "Global" };
const TIER: Record<number, string> = { 1: "Tier 1 · primary", 2: "Tier 2 · press", 3: "Tier 3 · discovery" };

/** Help side sheet (PRD §10.5): tour, what is read, what is checked, chips, where things live. */
export function Help() {
  const [open, setOpen] = useState(false);
  const [meta, setMeta] = useState<Meta | null>(null);
  const tour = useTour();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    if (!meta) fetch("/api/meta").then((r) => r.json()).then((j) => !j.error && setMeta(j)).catch(() => {});
    const h = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, meta]);

  const byRegion = new Map<string, Meta["sources"]>();
  for (const s of meta?.sources ?? []) {
    const k = REGION[s.country ?? ""] ?? "Other";
    byRegion.set(k, [...(byRegion.get(k) ?? []), s]);
  }
  const t = meta?.thesis;

  return (
    <>
      <button className="icon-btn" aria-label="Help" onClick={() => setOpen(true)}>?</button>
      {open ? createPortal(
        <>
          <div className="sheet-backdrop" onClick={() => setOpen(false)} />
          <aside className="sheet" role="dialog" aria-modal="true" aria-labelledby="help-title">
            <div className="row between">
              <h2 id="help-title" className="h2">Help</h2>
              <button ref={closeRef} className="icon-btn" aria-label="Close" onClick={() => setOpen(false)}>×</button>
            </div>
            <button className="btn btn-primary" style={{ marginTop: 24, width: "100%" }} onClick={() => { setOpen(false); tour.start(); }}>
              Take the tour
            </button>

            <details className="help-sec" open>
              <summary className="eyebrow">What we check</summary>
              <ol className="help-list">
                {CHECKS.map(([k, v]) => <li key={k}><strong>{k}</strong><span className="small muted">{v}</span></li>)}
              </ol>
            </details>

            <details className="help-sec">
              <summary className="eyebrow">Fit criteria{t ? ` · thesis v${t.version}` : ""}</summary>
              {t ? (
                <div className="stack-8" style={{ marginTop: 12 }}>
                  {t.criteria.map((c) => (
                    <div key={c.name} className="help-crit">
                      <div className="row between"><strong className="small">{c.name}</strong><span className="small num muted">weight {c.weight}</span></div>
                      <div className="tiny muted">{c.description}</div>
                    </div>
                  ))}
                  <p className="small" style={{ margin: "8px 0 0" }}>Fit ≥ {t.fit_threshold} · Worth a look ≥ {t.review_threshold} · out of 100</p>
                  <p className="small muted" style={{ margin: 0 }}>
                    Stages: {t.stages.map((s) => STAGE[s] ?? s).join(", ")} · Geography: {t.geographies.join(", ")} · Round {formatUsd(t.min_round_usd) ?? "any"} to {formatUsd(t.max_round_usd) ?? "any"}
                  </p>
                  <p className="small muted" style={{ margin: 0 }}>Excluded: {t.exclude_sectors.join(", ")}</p>
                </div>
              ) : <p className="small muted">Loading</p>}
            </details>

            <details className="help-sec">
              <summary className="eyebrow">Sources we read{meta ? ` · ${meta.sources.length}` : ""}</summary>
              {meta ? (
                <div className="stack-16" style={{ marginTop: 12 }}>
                  {[...byRegion.entries()].map(([region, xs]) => (
                    <div key={region}>
                      <div className="small" style={{ fontWeight: 600 }}>{region}</div>
                      <ul className="help-src">
                        {xs.map((s) => (
                          <li key={s.name}><a href={s.url} target="_blank" rel="noreferrer">{s.name}</a> <span className="tiny muted">· {TIER[s.tier] ?? `Tier ${s.tier}`}</span></li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  <p className="tiny muted" style={{ margin: 0 }}>Google News items count only when the original publisher is on the Tier 1 or 2 list. Feeds are read daily at 06:00 IST and on Run now.</p>
                </div>
              ) : <p className="small muted">Loading</p>}
            </details>

            <details className="help-sec">
              <summary className="eyebrow">Status and chips</summary>
              <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0" }} className="stack-16">
                {HELP_ORDER.map((k) => (
                  <li key={k}>
                    <Chip label={k} />
                    <div className="small muted" style={{ marginTop: 6 }}>{CHIP_HELP[k].help}</div>
                  </li>
                ))}
              </ul>
            </details>

            <details className="help-sec">
              <summary className="eyebrow">Where things live</summary>
              <dl className="small" style={{ margin: "12px 0 0" }}>
                <dt style={{ fontWeight: 600 }}>Thesis</dt>
                <dd style={{ margin: "2px 0 12px" }} className="muted">Supabase table <code>thesis_versions</code></dd>
                <dt style={{ fontWeight: 600 }}>Sources</dt>
                <dd style={{ margin: "2px 0 12px" }} className="muted">Supabase table <code>sources</code></dd>
                <dt style={{ fontWeight: 600 }}>Drafts</dt>
                <dd style={{ margin: "2px 0 12px" }} className="muted">Your Gmail Drafts folder</dd>
                <dt style={{ fontWeight: 600 }}>Accelerator details</dt>
                <dd style={{ margin: "2px 0 0" }} className="muted">Supabase table <code>settings</code></dd>
              </dl>
            </details>
          </aside>
        </>,
        // Rendered on <body>: the top bar's backdrop-filter would otherwise clip a fixed sheet.
        document.body,
      ) : null}
    </>
  );
}
