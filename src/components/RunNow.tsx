"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

interface Run { id: string; status: string; step: string; counts: Record<string, any>; errors: { message: string }[] }

const STAGES: { key: string; label: string; value: (c: Record<string, any>) => number | string }[] = [
  { key: "sources", label: "Sources", value: (c) => (c.sources ? `${c.sources_ok ?? 0}/${c.sources.length}` : 0) },
  { key: "articles", label: "Articles", value: (c) => c.articles_read ?? 0 },
  { key: "rounds", label: "Rounds", value: (c) => c.rounds_found ?? 0 },
  { key: "checked", label: "Checked", value: (c) => c.checked ?? 0 },
  { key: "scored", label: "Scored", value: (c) => c.scored ?? 0 },
  { key: "drafted", label: "Drafted", value: (c) => c.drafted ?? 0 },
];

const STEP_LABEL: Record<string, string> = {
  ingest: "Reading sources", extract: "Reading articles", evaluate: "Checking and scoring", window: "Updating windows", done: "Finished",
};

/** Run now with a live progress panel (PRD §10.6). Keeps advancing the same run until it is done. */
export function RunNow({ label = "Run now", resumeId = null }: { label?: string; resumeId?: string | null }) {
  const [run, setRun] = useState<Run | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const stop = useRef(false);
  const router = useRouter();

  const loop = useCallback(async (first: Promise<Response>) => {
    setBusy(true);
    setError(null);
    setOpen(true);
    stop.current = false;
    try {
      let res = await first;
      let r = (await res.json()) as Run & { error?: string };
      if (!res.ok) throw new Error(r.error ?? `HTTP ${res.status}`);
      setRun(r);
      window.dispatchEvent(new CustomEvent("fr:run", { detail: r.id }));
      let idle = 0;
      while (r.status === "running" && !stop.current) {
        res = await fetch("/api/run/step", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ runId: r.id }) });
        const next = (await res.json()) as Run & { error?: string };
        if (!res.ok) throw new Error(next.error ?? `HTTP ${res.status}`);
        idle = JSON.stringify(next.counts) === JSON.stringify(r.counts) && next.step === r.step ? idle + 1 : 0;
        r = next;
        setRun(r);
      window.dispatchEvent(new CustomEvent("fr:run", { detail: r.id }));
        if (idle >= 12) throw new Error("The run is paused. Try again in a few minutes.");
        if (idle) await new Promise((w) => setTimeout(w, 5000));
        router.refresh();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      router.refresh();
    }
  }, [router]);

  useEffect(() => () => { stop.current = true; }, []);

  const startNew = () => loop(fetch("/api/run", { method: "POST" }));
  const resume = () => resumeId && loop(fetch("/api/run/step", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ runId: resumeId }) }));

  const c = run?.counts ?? {};
  const fits = c.fits ?? 0;
  return (
    <>
      <button className="btn btn-primary" onClick={resumeId ? resume : startNew} disabled={busy} aria-busy={busy}>
        {busy ? "Running" : label}
      </button>
      {open ? (
        <div className="runpanel card reveal" role="status" aria-live="polite">
          <div className="row between">
            <strong>{run ? STEP_LABEL[run.step] ?? run.step : "Starting"}</strong>
            <Link href="/pipeline" className="small" style={{ marginLeft: "auto", marginRight: 8 }}>Pipeline</Link>
            <button className="icon-btn" aria-label="Close" onClick={() => setOpen(false)}>×</button>
          </div>
          <div className="funnel" style={{ marginTop: 12, gridTemplateColumns: "repeat(3, 1fr)" }}>
            {STAGES.map((s) => (
              <div key={s.key}>
                <div className="kpi-n" style={{ fontSize: 24 }}>{s.value(c)}</div>
                <div className="tiny muted">{s.label}</div>
              </div>
            ))}
          </div>
          {error ? <p className="small" style={{ color: "var(--chip-red)", marginBottom: 0 }}>{error}</p> : null}
          {run?.status === "done" ? (
            <p className="small" style={{ marginBottom: 0 }}>
              {fits} new {fits === 1 ? "Fit" : "Fits"} · <Link href="/" onClick={() => setOpen(false)}>View</Link> · <Link href="/pipeline" onClick={() => setOpen(false)}>Pipeline</Link>
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
