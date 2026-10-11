import { after, NextResponse } from "next/server";
import { hasCronSecret } from "@/lib/auth";
import { advanceRun, startRun } from "@/lib/runs/pipeline";
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
    const r = await advanceRun(run.id, 200_000);
    if (r.status === "running") await chain(origin, run.id, 1);
  });
  return NextResponse.json({ started: run.id });
}
