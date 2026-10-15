import { NextResponse } from "next/server";
import { describeAgent, describePlace } from "@/lib/access";
import { makeSession, safeEqual, SESSION_COOKIE, SESSION_DAYS } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

/** Sign-in log entry (shown on Runs). Never blocks or breaks signing in. */
async function logSignIn(req: Request, ok: boolean) {
  try {
    const place = describePlace(req.headers);
    const reason = [describeAgent(req.headers.get("user-agent")), place].filter(Boolean).join(" · ");
    await db().from("decisions").insert({ startup_id: null, action: ok ? "signin" : "signin_failed", reason, actor: "rohit" });
  } catch { /* logging must not stop a sign-in */ }
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const password = String(form?.get("password") ?? "");
  const ok = password.length > 0 && safeEqual(password, env.appPassword());
  await logSignIn(req, ok);
  if (!ok) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return NextResponse.redirect(new URL("/signin?error=1", req.url), 303);
  }
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.set(SESSION_COOKIE, await makeSession(env.sessionSecret()), {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: SESSION_DAYS * 86_400,
  });
  return res;
}
