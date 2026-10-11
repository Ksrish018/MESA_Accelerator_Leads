import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { advanceRun } from "@/lib/runs/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const { runId } = (await req.json().catch(() => ({}))) as { runId?: string };
  if (!runId) return NextResponse.json({ error: "runId required" }, { status: 400 });
  const run = await advanceRun(runId, 40_000);
  return NextResponse.json(run);
}

export async function GET(req: Request) {
  const runId = new URL(req.url).searchParams.get("runId");
  if (!runId) return NextResponse.json({ error: "runId required" }, { status: 400 });
  const r = await db().from("runs").select("*").eq("id", runId).single();
  return NextResponse.json(r.data);
}
