"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReviewView } from "@/lib/queries";
import { composeUrl } from "@/lib/gmail/compose";
import { fmtShortDate, hostOf } from "@/lib/format";
import { Chip } from "./Chip";
import { DayChip } from "./StartupCard";
import { useToast } from "./Toast";
import { ActionButton } from "./ActionButton";

const SKIP_REASONS = ["Not our sector", "Too early", "Too late", "Already in touch", "Other"];
const TIER: Record<number, string> = { 1: "Primary", 2: "Press", 3: "Discovery" };

function Src({ url, label }: { url: string | null | undefined; label?: string | null }) {
  if (!url) return null;
  return <a href={url} target="_blank" rel="noreferrer" className="tiny">{label || hostOf(url)}</a>;
}

async function post(path: string, body: unknown = {}) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json;
}

export function ReviewClient({ v, sample = false }: { v: ReviewView; sample?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const id = v.startup.id as string;
  const decided = !!v.outreach || ["drafted", "sent", "replied", "skipped"].includes(v.startup.status);
  const [subject, setSubject] = useState<string>(v.draft?.subject ?? "");
  const [body, setBody] = useState<string>(v.draft?.body ?? "");
  const [to, setTo] = useState<string>(v.draft?.recipient ?? "");
  const [lint, setLint] = useState<string[]>(v.draft?.lint_errors ?? []);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [busy, setBusy] = useState<string | null>(null);
  const [skipOpen, setSkipOpen] = useState(false);
  const [note, setNote] = useState("");
  const [fallback, setFallback] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [website, setWebsite] = useState("");
  const edited = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nextHref = (() => {
    const ids = v.queue.ids.filter((x) => x !== id);
    const after = v.queue.ids.slice(v.queue.index + 1).find((x) => x !== id);
    return after ? `/review/${after}` : ids[0] ? `/review/${ids[0]}` : "/";
  })();

  // Autosave while editing (PRD §10.6).
  const save = useCallback(async (patch: { subject?: string; body?: string; recipient?: string }) => {
    if (sample || !v.draft || decided) return;
    setSaved("saving");
    try {
      const res = await fetch(`/api/drafts/${v.draft.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setLint(j.lint_errors ?? []);
      setSaved("saved");
    } catch {
      setSaved("error");
    }
  }, [sample, v.draft, decided]);

  useEffect(() => {
    if (!edited.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save({ subject, body, recipient: to }), 800);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [subject, body, to, save]);

  const edit = <T,>(set: (x: T) => void) => (x: T) => { edited.current = true; set(x); };

  const undo = async (what: string) => {
    try {
      await post(`/api/startups/${id}/undo`);
      toast({ text: `${what} undone`, ms: 3000 });
      router.push(`/review/${id}`);
      router.refresh();
    } catch (e) {
      toast({ text: (e as Error).message, ms: 5000 });
    }
  };

  const approve = async (mode?: "manual") => {
    if (sample) { toast({ text: "Sample only. A real approval saves to Gmail Drafts.", ms: 5000 }); return; }
    setBusy("approve"); setErr(null);
    try {
      const j = await post(`/api/startups/${id}/approve`, { subject, body, recipient: to, mode });
      if (j.fallback) { setFallback(j.composeUrl); return; }
      toast({
        text: mode === "manual" ? "Marked as drafted" : `${j.updated ? "Updated in Gmail Drafts" : "Saved to Gmail Drafts"}${j.recipientMissing ? " · Add recipient in Gmail" : ""}`,
        actions: [
          ...(mode === "manual" ? [] : [{ label: "Open", href: "https://mail.google.com/mail/u/0/#drafts" }]),
          { label: "Undo", onClick: () => undo("Approve") },
        ],
      });
      router.push(nextHref);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const skip = async (reason: string) => {
    if (sample) { toast({ text: "Sample only. Nothing is saved.", ms: 4000 }); setSkipOpen(false); return; }
    setBusy("skip"); setErr(null);
    try {
      await post(`/api/startups/${id}/skip`, { reason, note: reason === "Other" ? note : "" });
      toast({ text: `Skipped · ${reason}`, actions: [{ label: "Undo", onClick: () => undo("Skip") }] });
      router.push(nextHref);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const regenerate = async () => {
    if (sample) return;
    if (edited.current && !window.confirm("Replace your edited draft with a new one?")) return;
    setBusy("regen"); setErr(null);
    try {
      const j = await post(`/api/startups/${id}/regenerate`);
      edited.current = false;
      setSubject(j.draft.subject); setBody(j.draft.body); setTo(j.draft.recipient ?? ""); setLint(j.draft.lint_errors ?? []);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const action = async (name: string, payload: unknown, done: string) => {
    if (sample) return;
    setBusy(name); setErr(null);
    try {
      await post(`/api/startups/${id}/${name}`, payload);
      toast({ text: done, ms: 4000 });
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const c = v.card;
  const founders = [...new Map(v.rounds.flatMap((r) => (r.founders ?? []) as { name: string; role: string | null }[]).map((f) => [f.name, f])).values()];
  const investors = [...new Set(v.rounds.flatMap((r) => r.investors ?? []))] as string[];
  const contacts = v.research?.contacts ?? [];
  const position = v.queue.index >= 0 ? `${v.queue.index + 1} of ${v.queue.ids.length}` : null;

  return (
    <div className="wrap section review-page">
      <div className="row between" style={{ marginBottom: 24 }}>
        <Link href="/" className="btn btn-ghost btn-sm">Back to Today</Link>
        {position ? <span className="small muted num" aria-label={`Startup ${position}`}>{position}</span> : null}
      </div>
      <p className="lede" style={{ marginBottom: 16 }}>Check each fact against its source, edit the email, then approve or skip.</p>

      <div className="review">
        {/* Left: facts, signals, evidence */}
        <section className="card stack-16" data-tour="facts" aria-label="Facts">
          <div>
            <div className="row">
              <h1 className="h2">{c.name}</h1>
              {sample ? <Chip label="Sample" /> : null}
            </div>
            {c.what ? (
              <p className="muted" style={{ margin: "8px 0 0" }}>
                <q>{c.what.quote}</q> <Src url={c.what.source_url} />
              </p>
            ) : null}
            <div className="row" style={{ marginTop: 12 }}>
              <DayChip day={c.day} windowDays={c.windowDays} closing={c.closing} daysLeft={c.daysLeft} />
              <Chip label={c.confidenceLabel} />
              {c.olderThesis ? <Chip label="Older thesis" /> : null}
              {c.flags.filter((f) => f !== "One source").map((f) => <Chip key={f} label={f} />)}
            </div>
            {c.olderThesis && !decided && !sample ? (
              <div className="row" style={{ marginTop: 12 }}>
                <ActionButton path={`/api/startups/${id}/rescore`} label="Rescore" busyLabel="Scoring" messages={{ fit: "Now a Fit · draft ready", default: "Rescored on the active thesis" }} />
              </div>
            ) : null}
          </div>

          <div>
            <h2 className="eyebrow">Round</h2>
            {v.rounds.map((r, i) => (
              <div key={r.id ?? i} className="fact">
                <div className="row between">
                  <strong>{r.stage_text ?? "Stage undisclosed"}{r.amount_text ? ` · ${r.amount_text}` : ""}</strong>
                  <span className="row" style={{ gap: 6 }}>
                    <span className="tiny muted">{TIER[r.publisher_tier] ?? ""} · {fmtShortDate(r.published_at)}</span>
                    <Src url={r.source_url} label={r.publisher} />
                  </span>
                </div>
                {r.quotes?.stage_text ? <p className="small muted" style={{ margin: "4px 0 0" }}><q>{r.quotes.stage_text}</q></p> : null}
                {r.quotes?.amount_text && r.quotes.amount_text !== r.quotes?.stage_text ? <p className="small muted" style={{ margin: "2px 0 0" }}><q>{r.quotes.amount_text}</q></p> : null}
              </div>
            ))}
            {c.amountConflict ? <p className="small" style={{ margin: "8px 0 0" }}><Chip label="Conflicting amounts" /> {c.amountConflict.join(" vs ")}</p> : null}
            {investors.length ? <div className="fact"><div className="fact-label">Investors</div>{investors.join(", ")}</div> : null}
            {founders.length ? <div className="fact"><div className="fact-label">Founders</div>{founders.map((f) => (f.role ? `${f.name} (${f.role})` : f.name)).join(", ")}</div> : null}
          </div>

          {v.signals.length ? (
            <div>
              <h2 className="eyebrow">Signals</h2>
              {v.signals.map((s, i) => (
                <div key={i} className="fact">
                  <div className="fact-label">{s.label}</div>
                  <div className="small"><q>{s.quote ?? s.value}</q> <Src url={s.source_url} /></div>
                </div>
              ))}
            </div>
          ) : null}

          <div>
            <h2 className="eyebrow">Fit · {c.total ?? "–"}/100{c.thesisVersion ? ` · thesis v${c.thesisVersion}` : ""}</h2>
            {v.criteria.length ? v.criteria.map((k) => (
              <div key={k.key} className="fact">
                <div className="row between"><span>{k.name}</span><strong className="num">{k.score_0_5}/5</strong></div>
                {k.evidence_quote ? <div className="small muted"><q>{k.evidence_quote}</q> <Src url={k.source_url} /></div> : <div className="small muted">No evidence in sources</div>}
              </div>
            )) : <p className="small muted">{v.hardRule ? `Hard rule · ${v.hardRule}` : "Not scored"}</p>}
          </div>

          <div>
            <h2 className="eyebrow">Contact</h2>
            {contacts.length ? contacts.slice(0, 4).map((ct) => (
              <div key={ct.address} className="fact row between">
                <span>{ct.address} <span className="tiny muted">· {ct.kind}</span></span>
                <Src url={ct.where_found_url} label="where found" />
              </div>
            )) : (
              <div className="fact stack-8">
                <Chip label="Find contact" />
                <div className="row small">
                  {v.startup.website_url ? <a href={v.startup.website_url} target="_blank" rel="noreferrer">Company website</a> : null}
                  {founders.slice(0, 2).map((f) => (
                    <a key={f.name} href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${f.name} ${c.name}`)}`} target="_blank" rel="noreferrer">LinkedIn · {f.name}</a>
                  ))}
                </div>
              </div>
            )}
            {!v.startup.website_url && !sample ? (
              <form className="row" style={{ marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); action("website", { url: website }, "Website added"); }}>
                <label htmlFor="website" className="sr-only">Company website</label>
                <input id="website" className="field grow" placeholder="Company website" value={website} onChange={(e) => setWebsite(e.target.value)} />
                <button className="btn btn-secondary btn-sm" disabled={!website || !!busy}>Add website</button>
              </form>
            ) : null}
          </div>

          {!sample && !decided ? (
            <div className="row" style={{ paddingTop: 8 }}>
              <button className="btn btn-danger btn-sm" disabled={!!busy} onClick={() => action("wrong", {}, "Marked as wrong extraction").then(() => router.push(nextHref))}>Not seed / wrong company</button>
            </div>
          ) : null}
        </section>

        {/* Right: the draft */}
        <section className="card review-right stack-16" data-tour="draft" aria-label="Draft">
          <div className="row between">
            <h2 className="eyebrow">Draft</h2>
            <span className="tiny muted" aria-live="polite">{saved === "saving" ? "Saving" : saved === "saved" ? "Saved" : saved === "error" ? "Not saved" : ""}</span>
          </div>
          {!decided && !sample && v.draft?.gmail_draft_id ? <div className="row"><Chip label="In Gmail Drafts" /><span className="tiny muted">Approve saves your edits to it</span></div> : null}
          {decided ? <p className="small muted" style={{ margin: 0 }}>{v.outreach?.status === "skipped" ? `Skipped · ${v.outreach?.note ?? ""}` : "Already contacted"}</p> : null}
          {v.draft ? (
            <>
              <label className="stack-8" style={{ display: "block" }}>
                <span className="fact-label">To</span>
                <input className="field" type="email" value={to} placeholder="Add recipient in Gmail" onChange={(e) => edit(setTo)(e.target.value)} disabled={decided} />
              </label>
              <label className="stack-8" style={{ display: "block" }}>
                <span className="fact-label">Subject</span>
                <input className="field" value={subject} onChange={(e) => edit(setSubject)(e.target.value)} disabled={decided} />
              </label>
              <label className="stack-8" style={{ display: "block" }}>
                <span className="fact-label">Body</span>
                <textarea className="field" value={body} onChange={(e) => edit(setBody)(e.target.value)} disabled={decided} />
              </label>
              {lint.length ? <div className="lint" role="note">{lint.join(" · ")}</div> : null}
            </>
          ) : (
            <p className="muted">No draft. Regenerate to write one.</p>
          )}

          {fallback ? (
            <div className="panel stack-8" role="alert">
              <p className="small" style={{ margin: 0 }}>Gmail not connected. Copy the draft or open it in Gmail.</p>
              <div className="row">
                <button className="btn btn-secondary btn-sm" onClick={async () => { await navigator.clipboard.writeText(`To: ${to}\nSubject: ${subject}\n\n${body}`); approve("manual"); }}>Copy</button>
                <a className="btn btn-secondary btn-sm" href={composeUrl({ to: to || null, subject, body })} target="_blank" rel="noreferrer" onClick={() => approve("manual")}>Open in Gmail</a>
              </div>
            </div>
          ) : null}
          {err ? <p className="small" role="alert" style={{ color: "var(--chip-red)", margin: 0 }}>{err}</p> : null}

          {skipOpen ? (
            <div className="panel stack-8">
              <div className="fact-label">Skip reason</div>
              <div className="row">
                {SKIP_REASONS.filter((r) => r !== "Other").map((r) => (
                  <button key={r} className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => skip(r)}>{r}</button>
                ))}
              </div>
              <div className="row">
                <input className="field grow" placeholder="Other (optional note)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Other reason" />
                <button className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => skip("Other")}>Other</button>
              </div>
            </div>
          ) : null}

          {!decided ? (
            <div className="actionbar sticky-mobile">
              <button className="btn btn-secondary" onClick={() => setSkipOpen((x) => !x)} disabled={!!busy} aria-expanded={skipOpen}>Skip</button>
              <button className="btn btn-secondary" onClick={regenerate} disabled={!!busy || sample}>{busy === "regen" ? "Writing" : "Regenerate"}</button>
              <button className="btn btn-primary grow" onClick={() => approve()} disabled={!!busy || !v.draft} style={{ marginLeft: "auto" }}>
                {busy === "approve" ? "Saving" : "Approve → Gmail draft"}
              </button>
            </div>
          ) : (
            <div className="actionbar">
              <button className="btn btn-secondary btn-sm" disabled={!!busy || sample} onClick={() => action("reopen", {}, "Reopened")}>Reopen</button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
