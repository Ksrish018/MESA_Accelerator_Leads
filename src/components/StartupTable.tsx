"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fmtShortDate } from "@/lib/format";

const STATUS: Record<string, { label: string; tone: string }> = {
  new: { label: "New", tone: "blue" }, unclear: { label: "Stage unclear", tone: "grey" }, fit: { label: "Fit", tone: "green" },
  filtered: { label: "Filtered", tone: "grey" }, drafted: { label: "Drafted", tone: "violet" }, sent: { label: "Sent", tone: "violet" },
  replied: { label: "Replied", tone: "green" }, skipped: { label: "Skipped", tone: "grey" }, closed: { label: "Closed", tone: "amber" },
};
const FILTERS: [string, string[]][] = [
  ["All", []], ["Fit", ["fit"]], ["Contacted", ["drafted", "sent", "replied", "skipped"]], ["Filtered", ["filtered"]],
  ["Stage unclear", ["unclear"]], ["Closed", ["closed"]],
];

/** Every startup ever seen, with status and window countdown (PRD §5.8 Pipeline). */
export function StartupTable({ rows, windowDays }: { rows: Record<string, any>[]; windowDays: number }) {
  const [filter, setFilter] = useState("All");
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const statuses = FILTERS.find(([k]) => k === filter)?.[1] ?? [];
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => (!statuses.length || statuses.includes(r.status)) && (!needle || `${r.name} ${r.location ?? ""}`.toLowerCase().includes(needle)));
  }, [rows, filter, q]);
  const now = Date.now();
  return (
    <section className="stack-16" aria-label="All startups">
      <div className="row between">
        <h2 className="h2">Startups <span className="muted num">· {rows.length}</span></h2>
        <input className="field" style={{ width: 220 }} placeholder="Search name or place" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search startups" />
      </div>
      <div className="row" role="group" aria-label="Filter by status">
        {FILTERS.map(([k, s]) => (
          <button key={k} className={`btn btn-sm ${filter === k ? "btn-primary" : "btn-secondary"}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>
            {k} <span className="num" style={{ opacity: 0.7 }}>{s.length ? rows.filter((r) => s.includes(r.status)).length : rows.length}</span>
          </button>
        ))}
      </div>
      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>Startup</th><th>Status</th><th>Window</th><th>Place</th><th>Sources</th><th>Reason</th></tr></thead>
          <tbody>
            {shown.map((r) => {
              const day = r.first_announced_at ? Math.max(0, Math.floor((now - new Date(r.first_announced_at).getTime()) / 86_400_000)) : null;
              const st = STATUS[r.status] ?? { label: r.status, tone: "grey" };
              return (
                <tr key={r.id}>
                  <td><Link href={`/review/${r.id}`} style={{ color: "var(--text)", fontWeight: 600 }}>{r.name}</Link></td>
                  <td><span className={`chip chip-${st.tone}`}>{st.label}</span></td>
                  <td>
                    {day != null ? (
                      <span className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                        <span className={`windowbar${windowDays - day <= 10 ? " closing" : ""}`} style={{ width: 64 }} aria-hidden><span style={{ width: `${Math.min(100, (day / windowDays) * 100)}%` }} /></span>
                        <span className="tiny num">{day > windowDays ? "Closed" : `Day ${day}`}</span>
                      </span>
                    ) : "–"}
                    <div className="tiny muted">{fmtShortDate(r.first_announced_at)}</div>
                  </td>
                  <td className="small">{r.location ?? "–"}</td>
                  <td className="num small">{r.source_count}</td>
                  <td className="small muted">{r.filter_reason ?? ""}</td>
                </tr>
              );
            })}
            {!shown.length ? <tr><td colSpan={6} className="muted small">No startups match.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
