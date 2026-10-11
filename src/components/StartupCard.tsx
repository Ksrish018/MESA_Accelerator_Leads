import Link from "next/link";
import type { CardView } from "@/lib/queries";
import { fmtShortDate, hostOf } from "@/lib/format";
import { Chip } from "./Chip";

export function DayChip({ day, windowDays, closing, daysLeft }: { day: number; windowDays: number; closing: boolean; daysLeft: number }) {
  return (
    <span className="row" style={{ gap: 8 }}>
      <span className={`windowbar${closing ? " closing" : ""}`} aria-hidden>
        <span style={{ width: `${Math.min(100, (day / windowDays) * 100)}%` }} />
      </span>
      <span className="small num">Day {day} of {windowDays}</span>
      {closing ? <Chip label="Closing" /> : null}
      {closing ? <span className="sr-only">{daysLeft} days left</span> : null}
    </span>
  );
}

export function StartupCard({ c, index, href, sample = false }: { c: CardView; index: number; href: string; sample?: boolean }) {
  return (
    <Link href={href} className={`card startup-card reveal reveal-${Math.min(index + 1, 4)}`} aria-label={`${c.name}, fit score ${c.total ?? "not scored"}`}>
      <div className="stack-8" style={{ minWidth: 0 }}>
        <div className="row">
          <h2 className="h3">{c.name}</h2>
          {sample ? <Chip label="Sample" /> : null}
        </div>
        {c.what ? (
          <p className="small muted" style={{ margin: 0 }}>
            <q className="quote" style={{ quotes: "none" }}>{c.what.quote}</q>
            {c.what.source_url ? <span className="tiny"> · {hostOf(c.what.source_url)}</span> : null}
          </p>
        ) : null}
        <div className="row small">
          <span style={{ fontWeight: 500 }}>{c.stageText ?? c.stageLabel}</span>
          {c.amountText ? <span className="muted">· {c.amountText}{c.amountUsd && !c.amountText.includes("$") ? ` (≈${c.amountUsd})` : ""}</span> : <span className="muted">· Amount undisclosed</span>}
          <span className="muted">· Announced {fmtShortDate(c.announcedAt)}</span>
        </div>
        <div className="row" data-tour={index === 0 ? "card-chips" : undefined}>
          <DayChip day={c.day} windowDays={c.windowDays} closing={c.closing} daysLeft={c.daysLeft} />
          <Chip label={c.confidenceLabel} />
          {c.chips.map((x) => <Chip key={x.key} label={x.label} />)}
          {c.olderThesis ? <Chip label="Older thesis" /> : null}
          {c.flags.filter((f) => ["Conflicting amounts", "Find contact", "In another accelerator", "Possible duplicate", "Injection suspected", "Conflicting stage"].includes(f)).map((f) => <Chip key={f} label={f} />)}
        </div>
        {c.topCriteria.length ? (
          <div className="stack-8" style={{ marginTop: 4 }}>
            {c.topCriteria.map((k) => (
              <p key={k.key} className="evidence" style={{ margin: 0 }}>
                <b>{k.name} · {k.score_0_5}/5</b> · <q>{k.evidence_quote}</q>
              </p>
            ))}
          </div>
        ) : null}
      </div>
      <div className="score">
        <div className="score-n">{c.total ?? "–"}</div>
        <div className="score-l">Fit score / 100</div>
      </div>
    </Link>
  );
}
