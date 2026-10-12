import { NextResponse } from "next/server";
import { pipelineView } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const runId = new URL(req.url).searchParams.get("runId");
  try {
    return NextResponse.json(await pipelineView(runId));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
