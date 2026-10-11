import { NextResponse } from "next/server";
import { advanceRun, startRun } from "@/lib/runs/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Run now: start (or resume) the run and advance it for one short slice. The page keeps calling /api/run/step. */
export async function POST() {
  const run = await startRun("manual");
  const advanced = await advanceRun(run.id, 40_000);
  return NextResponse.json(advanced);
}
