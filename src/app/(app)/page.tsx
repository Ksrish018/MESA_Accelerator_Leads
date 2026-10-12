import { CountUp } from "@/components/CountUp";
import { PageHero, HeroImage } from "@/components/Hero";
import { RunNow } from "@/components/RunNow";
import { SampleWhenTouring } from "@/components/SampleCard";
import { StartupCard } from "@/components/StartupCard";
import { fmtDate, fmtTime } from "@/lib/format";
import { kpis, lastRun, todayCards } from "@/lib/queries";
import { LiveStrip } from "@/components/LiveStrip";

export const metadata = { title: "Today" };
export const dynamic = "force-dynamic";

export default async function Today() {
  const [cards, runs] = await Promise.all([todayCards(), lastRun()]);
  const since = runs.lastDone?.started_at ?? null;
  const k = await kpis(since);
  const closing = cards.filter((c) => c.closing).length;
  const lastLabel = runs.lastDone ? `Last run ${fmtTime(runs.lastDone.finished_at ?? runs.lastDone.started_at)}` : "No completed run yet";
  const incomplete = runs.latest && runs.latest.status === "running" ? runs.latest : null;
  const sinceLabel = since ? fmtTime(since) : "the first run";
  // A run still going after 45 minutes has stalled (each slice is about a minute).
  const stalled = !!incomplete && Date.now() - new Date(incomplete.started_at).getTime() > 45 * 60_000;

  const empty = (
    <div className="card card-flat hero" style={{ position: "relative", minHeight: 260, display: "grid", placeItems: "center", textAlign: "center", overflow: "hidden" }}>
      <HeroImage slot="empty" />
      <div className="hero-scrim" />
      <div style={{ position: "relative", color: "#fff", padding: 24 }}>
        <p className="h3" style={{ margin: 0 }}>No new pre-seed or seed rounds since {sinceLabel}.</p>
        <p className="small" style={{ margin: "8px 0 0", opacity: 0.85 }}>Run now, or check Filtered out.</p>
      </div>
    </div>
  );

  return (
    <>
      <PageHero slot="today" title="Today" lede="Startups that fit your thesis, most urgent first. Open one to review and approve." meta={`${fmtDate(new Date())} · ${lastLabel}`}>
        <div className="row">
          {stalled ? <span className="small" style={{ color: "#fff" }}>Last run incomplete</span> : null}
          <RunNow resumeId={incomplete?.id ?? null} label={incomplete ? "Resume run" : "Run now"} />
        </div>
      </PageHero>

      <div className="wrap section stack-24">
        <LiveStrip initial={incomplete ? { id: incomplete.id, status: incomplete.status, step: incomplete.step, counts: incomplete.counts ?? {} } : null} />
        <section aria-label="Key numbers" className="kpis reveal reveal-1">
          <div className="kpi"><div className="kpi-n"><CountUp value={k.newRounds} /></div><div className="kpi-l">New rounds since {sinceLabel}</div></div>
          <div className="kpi"><div className="kpi-n"><CountUp value={k.fits} /></div><div className="kpi-l">Fits in window</div></div>
          <div className="kpi"><div className="kpi-n"><CountUp value={closing} /></div><div className="kpi-l">Closing within 10 days</div></div>
          <div className="kpi"><div className="kpi-n"><CountUp value={cards.length} /></div><div className="kpi-l">Awaiting approval</div></div>
          <div className="kpi"><div className="kpi-n"><CountUp value={k.draftedWeek} /></div><div className="kpi-l">Drafted in 7 days</div></div>
        </section>

        {cards.length ? (
          <section className="cards" aria-label="Startups to review" data-tour="today-list" data-review-href={`/review/${cards[0].id}`}>
            {cards.map((c, i) => <StartupCard key={c.id} c={c} index={i} href={`/review/${c.id}`} />)}
          </section>
        ) : (
          <SampleWhenTouring empty={empty} />
        )}
      </div>
    </>
  );
}
