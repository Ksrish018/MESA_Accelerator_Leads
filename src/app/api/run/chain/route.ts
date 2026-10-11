import { after, NextResponse } from "next/server";
import { chain } from "@/lib/runs/chain";
import { advanceRun } from "@/lib/runs/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Background continuation for cron runs. Responds at once, works for up to
 * 200 s after the response, then calls itself again if the run is unfinished.
 * Requires CRON_SECRET (checked in middleware).
 */
export async function POST(req: Request) {
  const { runId, hop = 0 } = (await req.json().catch(() => ({}))) as { runId?: string; hop?: number };
  if (!runId) return NextResponse.json({ error: "runId required" }, { status: 400 });
  const origin = new URL(req.url).origin;
  after(async () => {
    const run = await advanceRun(runId, 200_000);
    if (run.status === "running" && hop < 12) await chain(origin, runId, hop + 1);
  });
  return NextResponse.json({ accepted: true, runId, hop }, { status: 202 });
}
