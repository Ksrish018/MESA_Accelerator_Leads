import { after, NextResponse } from "next/server";
import { chain } from "@/lib/runs/chain";
import { db } from "@/lib/db";
import { advanceRun, noteRunError } from "@/lib/runs/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Background continuation for cron runs. Responds at once, works for up to
 * 150 s after the response (plus one batch, under the 300 s limit), then calls itself again if the run is unfinished.
 * Requires CRON_SECRET (checked in middleware).
 */
async function isRunning(runId: string): Promise<boolean> {
  const r = await db().from("runs").select("status").eq("id", runId).maybeSingle();
  return r.data?.status === "running";
}

export async function POST(req: Request) {
  const { runId, hop = 0 } = (await req.json().catch(() => ({}))) as { runId?: string; hop?: number };
  if (!runId) return NextResponse.json({ error: "runId required" }, { status: 400 });
  const origin = new URL(req.url).origin;
  after(async () => {
    try {
      await advanceRun(runId, 150_000);
    } finally {
      // Keep going until the run is done; each hop is one slice of about 3 minutes.
      const still = await isRunning(runId);
      if (still && hop < 60 && !(await chain(origin, runId, hop + 1))) await noteRunError(runId, "chain", "Could not start the next background slice");
    }
  });
  return NextResponse.json({ accepted: true, runId, hop }, { status: 202 });
}
