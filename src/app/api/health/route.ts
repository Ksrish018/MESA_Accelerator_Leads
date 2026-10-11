import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { gmailConfigured } from "@/lib/gmail/gmail";

export const dynamic = "force-dynamic";

/** Yes/no per dependency (PRD §5.10). Never returns secrets or values. */
export async function GET() {
  const out: Record<string, unknown> = {};

  try {
    const r = await db().from("thesis_versions").select("version").eq("is_active", true).limit(1);
    out.database = !r.error && (r.data?.length ?? 0) > 0;
  } catch {
    out.database = false;
  }

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel()}`, {
      headers: { "x-goog-api-key": env.geminiKey() },
      cache: "no-store",
    });
    out.gemini = res.ok;
  } catch {
    out.gemini = false;
  }
  out.model = env.geminiModel();

  out.gmail = false;
  if (gmailConfigured()) {
    try {
      const g = env.google();
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: g.clientId, client_secret: g.clientSecret, refresh_token: g.refreshToken, grant_type: "refresh_token" }),
        cache: "no-store",
      });
      out.gmail = res.ok;
    } catch {
      out.gmail = false;
    }
  }

  out.cron_secret = env.has("CRON_SECRET");
  out.app_password = env.has("APP_PASSWORD") && env.has("SESSION_SECRET");

  try {
    const s = await db().from("sources").select("name, enabled, last_ok_at, last_error").eq("enabled", true);
    const cutoff = Date.now() - 48 * 3600_000;
    out.sources = (s.data ?? []).map((x) => ({
      name: x.name,
      ok: !!x.last_ok_at && new Date(x.last_ok_at).getTime() > cutoff && !x.last_error,
    }));
  } catch {
    out.sources = [];
  }

  const healthy = out.database === true && out.gemini === true && out.cron_secret === true;
  return NextResponse.json(out, { status: healthy ? 200 : 503 });
}
