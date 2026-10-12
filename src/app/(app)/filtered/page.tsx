import Link from "next/link";
import { Chip } from "@/components/Chip";
import { PageHero } from "@/components/Hero";
import { RescueButton } from "@/components/RescueButton";
import { fmtShortDate, hostOf } from "@/lib/format";
import { filteredCards, type CardView } from "@/lib/queries";

export const metadata = { title: "Filtered out" };
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function category(c: CardView): string {
  const r = c.filterReason ?? "";
  if (c.status === "closed" || r === "Window closed") return "Window closed";
  if (c.status === "unclear" || r === "Stage undisclosed") return "Stage undisclosed";
  if (r.startsWith("Stage:")) return "Later stage";
  if (r.startsWith("Excluded sector")) return "Excluded sector";
  if (r.startsWith("Outside geography")) return "Outside geography";
  if (r.startsWith("Score")) return "Low score";
  if (r === "No Tier 1 or 2 source") return "One weak source";
  if (r === "Marked wrong extraction") return "Marked wrong";
  return "Disqualified";
}

function Row({ c, rescue = true }: { c: CardView; rescue?: boolean }) {
  const src = c.sources[0];
  return (
    <div className="list-row">
      <div className="grow stack-8">
        <div className="row">
          <Link href={`/review/${c.id}`} style={{ color: "var(--text)", fontWeight: 600 }}>{c.name}</Link>
          <span className="small muted">{[c.stage !== "unknown" ? c.stageText ?? c.stageLabel : null, c.amountText].filter(Boolean).join(" · ")}</span>
        </div>
        <div className="row small">
          <span>{c.filterReason ?? (c.status === "closed" ? "Window closed" : "Filtered")}</span>
          {src ? <a className="tiny" href={src.url} target="_blank" rel="noreferrer">{src.publisher ?? hostOf(src.url)} · {fmtShortDate(src.published_at)}</a> : null}
          {c.olderThesis ? <Chip label="Older thesis" /> : null}
        </div>
      </div>
      {c.total != null ? <span className="num small muted" aria-label={`Fit score ${c.total}`}>{c.total}/100</span> : null}
      {rescue ? <RescueButton id={c.id} name={c.name} /> : null}
    </div>
  );
}

export default async function Filtered() {
  const { cards, contacted } = await filteredCards();
  const worth = cards.filter((c) => c.bucket === "worth_a_look" && c.status === "filtered").sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
  const rest = cards.filter((c) => !worth.includes(c));
  const groups = new Map<string, CardView[]>();
  for (const c of rest) groups.set(category(c), [...(groups.get(category(c)) ?? []), c]);

  return (
    <>
      <PageHero slot="filtered" title="Filtered out" meta={`${cards.length} startups · ${contacted.length} already contacted`} />
      <div className="wrap section stack-24">
        {!cards.length && !contacted.length ? (
          <p className="muted">Nothing filtered out yet. Run now to read today&apos;s sources.</p>
        ) : null}

        {worth.length ? (
          <section className="stack-16 reveal">
            <h2 className="h2">Worth a look <span className="muted num">· {worth.length}</span></h2>
            <div className="list">{worth.map((c) => <Row key={c.id} c={c} />)}</div>
          </section>
        ) : null}

        {[...groups.entries()].map(([name, xs]) => (
          <section key={name} className="stack-16 reveal">
            <h2 className="h3">{name} <span className="muted num">· {xs.length}</span></h2>
            <div className="list">{xs.map((c) => <Row key={c.id} c={c} />)}</div>
          </section>
        ))}

        {contacted.length ? (
          <section className="stack-16 reveal">
            <h2 className="h3">Already contacted <span className="muted num">· {contacted.length}</span></h2>
            <div className="list">
              {contacted.map((c) => (
                <div key={c.id} className="list-row">
                  <div className="grow">
                    <Link href={`/review/${c.id}`} style={{ color: "var(--text)", fontWeight: 600 }}>{c.name}</Link>
                    <span className="small muted"> · {c.status === "skipped" ? "Skipped" : c.status === "drafted" ? "Drafted" : c.status === "sent" ? "Sent" : "Replied"}</span>
                  </div>
                  <Chip label="Already contacted" />
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
