import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Stores tour completion so the tour does not reappear on another device (PRD §10.5). */
export async function POST(req: Request) {
  const { reset } = (await req.json().catch(() => ({}))) as { reset?: boolean };
  await db().from("settings").update({ tour_completed_at: reset ? null : new Date().toISOString() }).eq("id", 1);
  return NextResponse.json({ ok: true });
}
