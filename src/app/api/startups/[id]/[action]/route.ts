import { NextResponse } from "next/server";
import { db, must } from "@/lib/db";
import { composeUrl } from "@/lib/gmail/compose";
import { createDraft, deleteDraft, gmailConfigured } from "@/lib/gmail/gmail";
import { draftStartup, evaluateStartup } from "@/lib/runs/evaluate";
import { domainOf } from "@/lib/text";
import { activeThesis, loadSettings, loadStageMap } from "@/lib/thesis/load";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Body = Record<string, string | undefined>;
const SKIP_REASONS = ["Not our sector", "Too early", "Too late", "Already in touch", "Other"];

async function log(startupId: string, action: string, reason: string) {
  const supa = db();
  await supa.from("decisions").insert({ startup_id: startupId, action, reason, actor: "rohit" });
  await supa.from("triggers").insert({ startup_id: startupId, type: "T7", detail: `${action}${reason ? ` · ${reason}` : ""}` });
}

async function latestDraft(startupId: string) {
  const r = await db().from("drafts").select("*").eq("startup_id", startupId).order("created_at", { ascending: false }).limit(1);
  return (r.data?.[0] ?? null) as Record<string, any> | null;
}

async function ctx() {
  const [thesis, settings, stageMap] = await Promise.all([activeThesis(), loadSettings(), loadStageMap()]);
  return { runId: null, thesis, settings, stageMap };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await params;
  const body = ((await req.json().catch(() => ({}))) ?? {}) as Body;
  const supa = db();
  const s = (await supa.from("startups").select("*").eq("id", id).maybeSingle()).data as Record<string, any> | null;
  if (!s) return NextResponse.json({ error: "Startup not found" }, { status: 404 });
  const now = new Date().toISOString();

  try {
    switch (action) {
      /** Approve → Gmail draft (never delivered by the app). Records outreach so it is never drafted again. */
      case "approve": {
        const outreach = (await supa.from("outreach").select("startup_id").eq("startup_id", id).maybeSingle()).data;
        if (outreach) return NextResponse.json({ error: "Already contacted" }, { status: 409 });
        const d = await latestDraft(id);
        if (!d) return NextResponse.json({ error: "No draft" }, { status: 400 });
        const subject = body.subject ?? d.subject;
        const text = body.body ?? d.body;
        const recipient = (body.recipient ?? d.recipient ?? "").trim() || null;
        const manual = body.mode === "manual";

        let gmailId: string | null = null;
        let fallback = false;
        if (!manual && gmailConfigured()) {
          try {
            gmailId = (await createDraft({ to: recipient, subject, body: text })).id;
          } catch {
            fallback = true;
          }
        } else if (!manual) {
          fallback = true;
        }
        if (fallback) {
          return NextResponse.json({ fallback: true, composeUrl: composeUrl({ to: recipient, subject, body: text }) }, { status: 200 });
        }
        must(await supa.from("outreach").insert({ startup_id: id, status: "drafted", by: "rohit", at: now, gmail_draft_id: gmailId, note: manual ? "Copied or opened in Gmail" : null }), "record outreach");
        await supa.from("drafts").update({ subject, body: text, recipient, status: "approved", gmail_draft_id: gmailId, approved_at: now, updated_at: now }).eq("id", d.id);
        await supa.from("startups").update({ status: "drafted", updated_at: now }).eq("id", id);
        await log(id, "approved", gmailId ? "Saved to Gmail Drafts" : "Copied or opened in Gmail");
        return NextResponse.json({ ok: true, gmailDraftId: gmailId, recipientMissing: !recipient });
      }

      /** Undo within 10 s: delete the Gmail draft and the outreach record. */
      case "undo": {
        const o = (await supa.from("outreach").select("*").eq("startup_id", id).maybeSingle()).data as Record<string, any> | null;
        if (!o) return NextResponse.json({ ok: true });
        if (Date.now() - new Date(o.at).getTime() > 60_000) return NextResponse.json({ error: "Undo window passed" }, { status: 409 });
        if (o.gmail_draft_id) await deleteDraft(o.gmail_draft_id);
        await supa.from("outreach").delete().eq("startup_id", id);
        const d = await latestDraft(id);
        if (d) await supa.from("drafts").update({ status: "draft", gmail_draft_id: null, approved_at: null }).eq("id", d.id);
        await supa.from("startups").update({ status: "fit", updated_at: now }).eq("id", id);
        await log(id, "undo", o.status === "skipped" ? "Skip undone" : "Approve undone");
        return NextResponse.json({ ok: true });
      }

      case "skip": {
        const reason = SKIP_REASONS.includes(body.reason ?? "") ? body.reason! : "Other";
        const note = (body.note ?? "").slice(0, 300) || null;
        await supa.from("outreach").upsert({ startup_id: id, status: "skipped", by: "rohit", at: now, note: note ? `${reason}: ${note}` : reason });
        const d = await latestDraft(id);
        if (d) await supa.from("drafts").update({ status: "skipped", updated_at: now }).eq("id", d.id);
        await supa.from("startups").update({ status: "skipped", updated_at: now }).eq("id", id);
        await log(id, "skipped", note ? `${reason}: ${note}` : reason);
        return NextResponse.json({ ok: true });
      }

      /** Rescue: Rohit overrides a filter. Scores (for the record) and drafts it now. */
      case "rescue": {
        if ((await supa.from("outreach").select("startup_id").eq("startup_id", id).maybeSingle()).data) {
          return NextResponse.json({ error: "Already contacted" }, { status: 409 });
        }
        await supa.from("startups").update({ rescued: true, needs_eval: true, eval_attempts: 0, updated_at: now }).eq("id", id);
        await log(id, "rescued", s.filter_reason ?? "");
        await evaluateStartup(id, await ctx());
        return NextResponse.json({ ok: true });
      }

      case "regenerate": {
        const d = await draftStartup(id, await ctx());
        await log(id, "regenerated", "");
        return NextResponse.json({ ok: true, draft: d });
      }

      /** "Not seed / wrong company": the extraction was wrong. Feeds the eval set. */
      case "wrong": {
        await supa.from("startups").update({ status: "filtered", filter_reason: "Marked wrong extraction", needs_eval: false, updated_at: now }).eq("id", id);
        await supa.from("decisions").insert({ startup_id: id, action: "wrong_extraction", reason: body.reason ?? "Not seed / wrong company", actor: "rohit" });
        return NextResponse.json({ ok: true });
      }

      /** Add a website Rohit found. Re-evaluates the lead (T3). */
      case "website": {
        const domain = domainOf(body.url ?? "");
        if (!domain) return NextResponse.json({ error: "Enter a website address" }, { status: 400 });
        const clash = (await supa.from("startups").select("id").eq("website_domain", domain).neq("id", id)).data ?? [];
        if (clash.length) return NextResponse.json({ error: "Another startup already uses this website" }, { status: 409 });
        await supa.from("startups").update({
          website_url: body.url!.startsWith("http") ? body.url : `https://${domain}`, website_domain: domain,
          flags: (s.flags ?? []).filter((f: string) => f !== "No website found"), needs_eval: true, eval_attempts: 0, updated_at: now,
        }).eq("id", id);
        await supa.from("triggers").insert({ startup_id: id, type: "T3", detail: "Website added by Rohit" });
        if (!["drafted", "sent", "replied", "skipped"].includes(s.status)) await evaluateStartup(id, await ctx());
        return NextResponse.json({ ok: true });
      }

      /** Rescore on the active thesis (T5). Hard rules run again, then score and draft if it is now a Fit. */
      case "rescore": {
        if (["drafted", "sent", "replied", "skipped"].includes(s.status)) return NextResponse.json({ error: "Already contacted" }, { status: 409 });
        await supa.from("startups").update({
          needs_eval: true, eval_attempts: 0, flags: (s.flags ?? []).filter((f: string) => f !== "Older thesis"), updated_at: now,
        }).eq("id", id);
        await supa.from("triggers").insert({ startup_id: id, type: "T5", detail: "Rescored on the active thesis" });
        const outcome = await evaluateStartup(id, await ctx());
        return NextResponse.json({ ok: true, outcome });
      }

      /** Only Rohit can reopen a contacted company. */
      case "reopen": {
        await supa.from("outreach").delete().eq("startup_id", id);
        await supa.from("startups").update({ status: "new", needs_eval: true, eval_attempts: 0, rescued: false, updated_at: now }).eq("id", id);
        await log(id, "reopened", "");
        return NextResponse.json({ ok: true });
      }

      case "status": {
        if (!["sent", "replied"].includes(body.status ?? "")) return NextResponse.json({ error: "Unknown status" }, { status: 400 });
        await supa.from("outreach").update({ status: body.status }).eq("startup_id", id);
        await supa.from("startups").update({ status: body.status, updated_at: now }).eq("id", id);
        await log(id, body.status!, "");
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 404 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
