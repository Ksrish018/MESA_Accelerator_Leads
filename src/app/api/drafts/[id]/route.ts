import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { lintDraft } from "@/lib/draft/lint";
import { loadSettings } from "@/lib/thesis/load";

export const dynamic = "force-dynamic";

/** Autosave while Rohit edits. Lint runs again on the edited text, without the signature. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as { subject?: string; body?: string; recipient?: string };
  const supa = db();
  const d = (await supa.from("drafts").select("*").eq("id", id).maybeSingle()).data as Record<string, any> | null;
  if (!d) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  if (d.status !== "draft") return NextResponse.json({ error: "Draft already decided" }, { status: 409 });
  const subject = (b.subject ?? d.subject).slice(0, 300);
  const body = (b.body ?? d.body).slice(0, 8000);
  const recipient = b.recipient !== undefined ? b.recipient.trim().slice(0, 200) || null : d.recipient;
  const settings = await loadSettings();
  const sig = (settings.signature ?? "").trim();
  const core = sig && body.trim().endsWith(sig) ? body.trim().slice(0, -sig.length) : body;
  const lint_errors = lintDraft(subject, core);
  await supa.from("drafts").update({ subject, body, recipient, edited: true, lint_errors, updated_at: new Date().toISOString() }).eq("id", id);
  return NextResponse.json({ ok: true, lint_errors });
}
