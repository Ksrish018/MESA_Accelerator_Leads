import { after, NextResponse } from "next/server";
import { chain } from "@/lib/runs/chain";
import { currentRun, latestRuns } from "@/lib/runs/pipeline";

export const dynamic = "force-dynamic";

/**
 * Current run for Today and Pipeline. Self-healing: if a run is in progress but no
 * slice holds its lock (a hand-off was lost), the next viewer's poll restarts it.
 */
export async function GET(req: Request) {
  const [running, recent] = await Promise.all([currentRun(), latestRuns(1)]);
  const idle = running && (!running.lock_until || new Date(running.lock_until).getTime() < Date.now());
  if (running && idle) after(() => chain(new URL(req.url).origin, running.id, 0).then(() => undefined));
  return NextResponse.json({ running, last: recent[0] ?? null });
}
