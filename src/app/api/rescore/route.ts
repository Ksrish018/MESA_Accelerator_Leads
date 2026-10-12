import { NextResponse } from "next/server";
import { db, must } from "@/lib/db";
import { activeThesis } from "@/lib/thesis/load";

export const dynamic = "force-dynamic";

/**
 * Rescore all in window (T5): every undecided startup still inside its window
 * whose latest score used an older thesis is queued for the next run.
 */
export async function POST() {
  const supa = db();
  const thesis = await activeThesis();
  const since = new Date(Date.now() - thesis.window_days * 86_400_000).toISOString();
  const open = must(
    await supa.from("startups").select("id").in("status", ["new", "unclear", "fit", "filtered"]).eq("sample", false).gte("first_announced_at", since),
    "load open startups",
  ) as { id: string }[];
  if (!open.length) return NextResponse.json({ queued: 0 });
  const scores = must(
    await supa.from("scores").select("startup_id, thesis_version, created_at").in("startup_id", open.map((o) => o.id)).order("created_at", { ascending: false }),
    "load scores",
  ) as { startup_id: string; thesis_version: number }[];
  const latest = new Map<string, number>();
  for (const s of scores) if (!latest.has(s.startup_id)) latest.set(s.startup_id, s.thesis_version);
  const ids = open.map((o) => o.id).filter((id) => (latest.get(id) ?? 0) < thesis.version);
  if (ids.length) {
    must(await supa.from("startups").update({ needs_eval: true, eval_attempts: 0, eval_claimed_at: null }).in("id", ids), "queue rescore");
    await supa.from("triggers").insert(ids.map((id) => ({ startup_id: id, type: "T5", detail: `Queued for thesis v${thesis.version}` })));
  }
  return NextResponse.json({ queued: ids.length, version: thesis.version });
}
