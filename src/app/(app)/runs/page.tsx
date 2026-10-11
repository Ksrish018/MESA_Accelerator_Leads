import { PageHero } from "@/components/Hero";
import { RunNow } from "@/components/RunNow";
import { fmtDateTime, fmtTime } from "@/lib/format";
import { runsView } from "@/lib/queries";

export const metadata = { title: "Runs" };
export const dynamic = "force-dynamic";

const usd = (n: number) => (n < 0.01 && n > 0 ? "<$0.01" : `$${n.toFixed(n < 1 ? 3 : 2)}`);

export default async function Runs() {
  const { runs, sources, calls, decisions } = await runsView();
  const last = runs[0] ?? null;
  const running = runs.find((r) => r.status === "running") ?? null;
  const c = (last?.counts ?? {}) as Record<string, any>;
  const lastCalls = last ? calls.filter((x) => x.run_id === last.id) : [];
  const cost = (xs: Record<string, any>[]) => xs.reduce((s, x) => s + Number(x.cost_usd_est || 0), 0);
  const tokens = (xs: Record<string, any>[]) => xs.reduce((s, x) => s + (x.tokens_in || 0) + (x.tokens_out || 0), 0);
  const model = calls[0]?.model ?? process.env.GEMINI_MODEL ?? "gemini-3.8-flash";
  const drafts = c.drafted ?? 0;

  const skipCounts = new Map<string, number>();
  for (const d of decisions.filter((x) => x.action === "skipped")) {
    const k = String(d.reason ?? "Other").split(":")[0];
    skipCounts.set(k, (skipCounts.get(k) ?? 0) + 1);
  }
  const rescues = decisions.filter((x) => x.action === "rescued").length;

  const funnel = [
    ["Fetched", c.fetched ?? 0],
    ["Candidates", c.candidates ?? 0],
    ["Articles read", c.articles_read ?? 0],
    ["Rounds", c.rounds_found ?? 0],
    ["New startups", c.round_new ?? 0],
    ["Fits", c.fits ?? 0],
  ] as const;

  return (
    <>
      <PageHero slot="runs" title="Runs" meta={last ? `Last run ${fmtDateTime(last.started_at)} · ${last.status === "done" ? "complete" : last.status === "running" ? "in progress" : "failed"}` : "No runs yet"}>
        <RunNow resumeId={running?.id ?? null} label={running ? "Resume run" : "Run now"} />
      </PageHero>

      <div className="wrap section stack-24">
        <section className="stack-16 reveal">
          <h2 className="h2">Funnel</h2>
          <div className="funnel">
            {funnel.map(([k, v]) => (
              <div key={k}><div className="kpi-n" style={{ fontSize: 32 }}>{v}</div><div className="tiny muted">{k}</div></div>
            ))}
          </div>
          {last ? (
            <p className="small muted" style={{ margin: 0 }}>
              {c.round_more_coverage ?? 0} more coverage · {c.round_historical ?? 0} historical rounds ignored · {c.facts_dropped ?? 0} unverified facts dropped · {c.injection_flags ?? 0} injection flags · {c.filtered ?? 0} filtered by hard rules · {c.worth_a_look ?? 0} worth a look
            </p>
          ) : null}
        </section>

        <section className="stack-16 reveal reveal-1">
          <h2 className="h2">Cost</h2>
          <div className="funnel" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
            <div><div className="kpi-n" style={{ fontSize: 28 }}>{usd(cost(lastCalls))}</div><div className="tiny muted">Last run</div></div>
            <div><div className="kpi-n" style={{ fontSize: 28 }}>{drafts ? usd(cost(lastCalls) / drafts) : "–"}</div><div className="tiny muted">Per drafted email, last run</div></div>
            <div><div className="kpi-n" style={{ fontSize: 28 }}>{usd(cost(calls))}</div><div className="tiny muted">Last 30 days</div></div>
            <div><div className="kpi-n" style={{ fontSize: 28 }}>{Math.round(tokens(lastCalls) / 1000)}k</div><div className="tiny muted">Tokens, last run · {lastCalls.length} calls</div></div>
          </div>
          <p className="small muted" style={{ margin: 0 }}>Model {model}</p>
        </section>

        <section className="stack-16 reveal reveal-2">
          <h2 className="h2">Sources</h2>
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Source</th><th>Tier</th><th>Items</th><th>Last OK</th><th>Status</th></tr></thead>
              <tbody>
                {sources.map((s) => {
                  const silent = !s.last_ok_at || Date.now() - new Date(s.last_ok_at).getTime() > 48 * 3600_000;
                  return (
                    <tr key={s.id}>
                      <td>{s.name}{!s.enabled ? <span className="muted"> · off</span> : null}</td>
                      <td className="num">{s.tier}</td>
                      <td className="num">{s.last_item_count ?? "–"}</td>
                      <td>{s.last_ok_at ? fmtDateTime(s.last_ok_at) : "never"}</td>
                      <td>{s.last_error ? <span className="chip chip-red">{String(s.last_error).slice(0, 40)}</span> : silent ? <span className="chip chip-amber">No items in 48 h</span> : <span className="chip chip-green">OK</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="stack-16 reveal reveal-3">
          <h2 className="h2">Decisions, 30 days</h2>
          <div className="funnel" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div><div className="kpi-n" style={{ fontSize: 28 }}>{decisions.filter((d) => d.action === "approved").length}</div><div className="tiny muted">Approved</div></div>
            <div><div className="kpi-n" style={{ fontSize: 28 }}>{decisions.filter((d) => d.action === "skipped").length}</div><div className="tiny muted">Skipped</div></div>
            <div><div className="kpi-n" style={{ fontSize: 28 }}>{rescues}</div><div className="tiny muted">Rescued</div></div>
          </div>
          {skipCounts.size ? (
            <div className="list">
              {[...skipCounts.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                <div key={k} className="list-row"><span className="grow">{k}</span><span className="num">{n}</span></div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="stack-16 reveal reveal-4">
          <h2 className="h2">History</h2>
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Started</th><th>Trigger</th><th>Status</th><th>Rounds</th><th>Fits</th><th>Errors</th></tr></thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td>{fmtDateTime(r.started_at)}</td>
                    <td>{r.trigger === "cron" ? "Daily 06:00 IST" : "Run now"}</td>
                    <td>{r.status === "done" ? `Done ${fmtTime(r.finished_at)}` : r.status === "running" ? `In progress · ${r.step}` : "Failed"}</td>
                    <td className="num">{r.counts?.rounds_found ?? 0}</td>
                    <td className="num">{r.counts?.fits ?? 0}</td>
                    <td className="small">{(r.errors ?? []).length ? `${r.errors.length} · ${String(r.errors[r.errors.length - 1].message).slice(0, 80)}` : "0"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
