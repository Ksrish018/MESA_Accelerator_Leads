import { after, NextResponse } from "next/server";
import { chain } from "@/lib/runs/chain";
import { currentRun } from "@/lib/runs/pipeline";
import { pipelineView } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const runId = new URL(req.url).searchParams.get("runId");
  try {
    const running = await currentRun();
    if (running && (!running.lock_until || new Date(running.lock_until).getTime() < Date.now())) {
      after(() => chain(new URL(req.url).origin, running.id, 0).then(() => undefined)); // revive an unattended run
    }
    return NextResponse.json(await pipelineView(runId));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
