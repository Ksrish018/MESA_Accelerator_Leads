import "server-only";
import { db } from "../db";
import { createDraft, deleteDraft, draftExists, gmailConfigured, updateDraft } from "./gmail";

/**
 * Morning drafts in Gmail (problem statement: "a personalised email sitting in
 * Rohit's draft folder"). Every Fit gets exactly one Gmail draft; it is
 * updated, never duplicated. Nothing is ever sent. AUTO_GMAIL_DRAFTS=false
 * turns this off and drafts reach Gmail only on Approve.
 */
export function autoDrafts(): boolean {
  return gmailConfigured() && (process.env.AUTO_GMAIL_DRAFTS ?? "true").toLowerCase() !== "false";
}

interface DraftRow { id: string; startup_id: string; subject: string; body: string; recipient: string | null; gmail_draft_id: string | null }

/** Latest Gmail draft id already made for this startup, if any. */
export async function existingGmailId(startupId: string): Promise<string | null> {
  const r = await db().from("drafts").select("gmail_draft_id").eq("startup_id", startupId).not("gmail_draft_id", "is", null).order("created_at", { ascending: false }).limit(1);
  return (r.data?.[0]?.gmail_draft_id as string | undefined) ?? null;
}

/** Create the startup's Gmail draft, or update the one it already has. Returns the Gmail id or null on failure. */
export async function syncGmailDraft(d: DraftRow): Promise<string | null> {
  if (!autoDrafts()) return null;
  try {
    const content = { to: d.recipient, subject: d.subject, body: d.body };
    const prior = d.gmail_draft_id ?? (await existingGmailId(d.startup_id));
    let id: string;
    if (prior && (await draftExists(prior))) {
      await updateDraft(prior, content);
      id = prior;
    } else {
      id = (await createDraft(content)).id;
    }
    await db().from("drafts").update({ gmail_draft_id: id }).eq("id", d.id);
    return id;
  } catch {
    return null; // the next run's Gmail step retries
  }
}

/** Remove the startup's Gmail draft (Skip, wrong extraction). */
export async function removeGmailDraft(startupId: string): Promise<void> {
  const id = await existingGmailId(startupId);
  if (!id) return;
  try { await deleteDraft(id); } catch { /* already gone */ }
  await db().from("drafts").update({ gmail_draft_id: null }).eq("startup_id", startupId).eq("gmail_draft_id", id);
}

/**
 * Each run: make sure every undecided Fit has its Gmail draft, and record as
 * contacted any Fit whose draft has left Drafts (sent or deleted in Gmail), so
 * it is never drafted again. Returns counts for the run log.
 */
export async function gmailStep(): Promise<{ created: number; leftDrafts: number }> {
  const out = { created: 0, leftDrafts: 0 };
  if (!autoDrafts()) return out;
  const supa = db();
  const fits = ((await supa.from("startups").select("id, flags").eq("status", "fit").eq("sample", false)).data ?? []) as { id: string; flags: string[] }[];
  for (const s of fits) {
    const latest = (await supa.from("drafts").select("*").eq("startup_id", s.id).order("created_at", { ascending: false }).limit(1)).data?.[0] as DraftRow & { status: string } | undefined;
    if (!latest || latest.status !== "draft") continue;
    const gid = latest.gmail_draft_id ?? (await existingGmailId(s.id));
    if (!gid) {
      if (await syncGmailDraft(latest)) out.created++;
      continue;
    }
    let exists = true;
    try { exists = await draftExists(gid); } catch { continue; }
    if (!exists) {
      // Left Drafts: Rohit sent or deleted it in Gmail. Count as contacted; never draft again.
      await supa.from("outreach").upsert({ startup_id: s.id, status: "drafted", by: "system", note: "Left Gmail Drafts · sent or deleted in Gmail", gmail_draft_id: gid });
      await supa.from("startups").update({ status: "drafted", flags: [...new Set([...(s.flags ?? []), "Left Drafts · Sent?"])] }).eq("id", s.id);
      await supa.from("decisions").insert({ startup_id: s.id, action: "left_drafts", reason: "Draft left Gmail Drafts", actor: "system" });
      out.leftDrafts++;
    }
  }
  return out;
}
