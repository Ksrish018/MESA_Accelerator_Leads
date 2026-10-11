import "server-only";
import { db, must } from "../db";
import type { Settings, Stage, Thesis } from "../types";
import { DEFAULT_STAGE_MAP } from "../extract/stage";

/** The active thesis version, loaded at run time. Nothing about it is hard-coded. */
export async function activeThesis(): Promise<Thesis> {
  const rows = must(
    await db().from("thesis_versions").select("*").eq("is_active", true).limit(1),
    "load thesis",
  ) as Thesis[];
  if (!rows.length) throw new Error("No active thesis version in Supabase");
  const t = rows[0];
  return {
    ...t,
    min_round_usd: t.min_round_usd == null ? null : Number(t.min_round_usd),
    max_round_usd: t.max_round_usd == null ? null : Number(t.max_round_usd),
    sector_keywords: t.sector_keywords ?? {},
  };
}

export async function thesisHistory(): Promise<Thesis[]> {
  return must(
    await db().from("thesis_versions").select("*").order("version", { ascending: false }),
    "load thesis history",
  ) as Thesis[];
}

export async function loadSettings(): Promise<Settings> {
  const s = must(await db().from("settings").select("*").eq("id", 1).single(), "load settings") as Settings;
  return { ...s, usd_inr_rate: Number(s.usd_inr_rate) || 88 };
}

export async function loadStageMap(): Promise<Record<string, Stage>> {
  const res = await db().from("stage_map").select("label, stage");
  if (res.error || !res.data?.length) return DEFAULT_STAGE_MAP;
  return Object.fromEntries(res.data.map((r) => [String(r.label).toLowerCase(), r.stage as Stage]));
}
