import { after, NextResponse } from "next/server";
import { hasCronSecret } from "@/lib/auth";
import { advanceRun, noteRunError, startRun } from "@/lib/runs/pipeline";
import { chain } from "@/lib/runs/chain";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Daily at 00:30 UTC (06:00 IST). Vercel Cron sends Authorization: Bearer CRON_SECRET. */
export async function GET(req: Request) {
  if (!hasCronSecret(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const run = await startRun("cron");
  const origin = new URL(req.url).origin;
  after(async () => {
    let status = "running";
    try {
      status = (await advanceRun(run.id, 150_000)).status;
    } finally {
      if (status === "running" && !(await chain(origin, run.id, 1))) await noteRunError(run.id, "chain", "Could not start the next background slice");
    }
  });
  return NextResponse.json({ started: run.id });
}
