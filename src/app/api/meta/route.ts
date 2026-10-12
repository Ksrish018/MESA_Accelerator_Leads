import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { activeThesis } from "@/lib/thesis/load";

export const dynamic = "force-dynamic";

/** What the system reads and checks, for Help. Live from Supabase; no secrets. */
export async function GET() {
  try {
    const [sources, thesis] = await Promise.all([
      db().from("sources").select("name, url, tier, country, kind, last_ok_at").eq("enabled", true).order("tier").order("name"),
      activeThesis(),
    ]);
    return NextResponse.json({
      sources: sources.data ?? [],
      thesis: {
        version: thesis.version,
        stages: thesis.stages,
        geographies: thesis.geographies,
        include_sectors: thesis.include_sectors,
        exclude_sectors: thesis.exclude_sectors,
        min_round_usd: thesis.min_round_usd,
        max_round_usd: thesis.max_round_usd,
        disqualifiers: thesis.disqualifiers,
        criteria: thesis.criteria.map((c) => ({ name: c.name, weight: c.weight, kind: c.kind, description: c.description })),
        fit_threshold: thesis.fit_threshold,
        review_threshold: thesis.review_threshold,
        window_days: thesis.window_days,
        closing_days: thesis.closing_days,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
