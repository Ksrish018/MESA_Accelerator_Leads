import { NextResponse } from "next/server";
import { currentRun, latestRuns } from "@/lib/runs/pipeline";

export const dynamic = "force-dynamic";

export async function GET() {
  const [running, recent] = await Promise.all([currentRun(), latestRuns(1)]);
  return NextResponse.json({ running, last: recent[0] ?? null });
}
