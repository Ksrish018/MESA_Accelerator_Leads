"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CountUp } from "./CountUp";

interface Run { id: string; status: string; step: string; counts: Record<string, any> }

const STEP_LABEL: Record<string, string> = {
  ingest: "Reading sources", extract: "Reading articles", evaluate: "Checking and scoring", window: "Updating windows", done: "Complete",
};
const ORDER = ["ingest", "extract", "evaluate", "window", "done"];

/** Compact live pipeline on Today while a run is in progress (cron or Run now). */
export function LiveStrip({ initial }: { initial: Run | null }) {
  const [run, setRun] = useState<Run | null>(initial);
  const router = useRouter();
  const was = useRef(initial?.status === "running");

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const j = await (await fetch("/api/run/status", { cache: "no-store" })).json();
        if (stop) return;
        const r = (j.running ?? null) as Run | null;
        setRun(r);
        if (was.current && !r) router.refresh(); // a run just finished: show the new Fits
        was.current = !!r;
      } catch { /* keep the last state; try again */ }
      if (!stop) timer = setTimeout(tick, was.current ? 3000 : 15000);
    };
    const h = () => { clearTimeout(timer); timer = setTimeout(tick, 500); };
    window.addEventListener("fr:run", h);
    timer = setTimeout(tick, was.current ? 3000 : 15000);
    return () => { stop = true; clearTimeout(timer); window.removeEventListener("fr:run", h); };
  }, [router]);

  if (!run || run.status !== "running") return null;
  const c = run.counts ?? {};
  const pct = Math.round(((ORDER.indexOf(run.step) + 0.5) / (ORDER.length - 1)) * 100);
  const items: [string, number][] = [
    ["Sources", c.sources_ok ?? 0], ["Articles", c.articles_read ?? 0], ["Rounds", c.rounds_found ?? 0],
    ["Checked", c.checked ?? 0], ["Scored", c.scored ?? 0], ["Drafted", c.drafted ?? 0],
  ];
  return (
    <section className="card strip reveal" aria-live="polite" aria-label="Run in progress">
      <div className="row between">
        <span className="chip chip-blue live-dot">{STEP_LABEL[run.step] ?? "Running"}</span>
        <Link href="/pipeline" className="small">View pipeline</Link>
      </div>
      <div className="strip-track" aria-hidden><span style={{ width: `${Math.min(100, pct)}%` }} /></div>
      <div className="strip-stages">
        {items.map(([k, v], i) => (
          <div key={k} className="strip-stage">
            <span className="kpi-n" style={{ fontSize: 22 }}><CountUp value={v} /></span>
            <span className="tiny muted">{k}</span>
            {i < items.length - 1 ? <i className="strip-arrow" aria-hidden>›</i> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
