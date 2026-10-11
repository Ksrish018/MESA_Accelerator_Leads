import { NextResponse } from "next/server";
import { db, must } from "@/lib/db";
import { checkSource, type SourceRow } from "@/lib/sources/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** M0 source check: fetch every feed from Vercel itself and record which respond. */
export async function GET() {
  const supa = db();
  const sources = must(await supa.from("sources").select("*").order("name"), "load sources") as SourceRow[];
  const results = await Promise.all(sources.map((s) => checkSource(s)));
  const now = new Date().toISOString();
  await Promise.all(
    sources.map((s, i) =>
      supa.from("sources").update({
        last_checked_at: now,
        ...(results[i].ok ? { last_ok_at: now, last_item_count: results[i].items, last_error: null } : { last_error: results[i].error ?? "No items" }),
      }).eq("id", s.id),
    ),
  );
  return NextResponse.json({
    checked_at: now,
    sources: results.map((r, i) => ({ name: r.name, tier: sources[i].tier, ok: r.ok, items: r.items, funding_candidates: r.candidates, latest: r.latest, error: r.error ?? null })),
  });
}
