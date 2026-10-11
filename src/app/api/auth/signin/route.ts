import { NextResponse } from "next/server";
import { makeSession, safeEqual, SESSION_COOKIE, SESSION_DAYS } from "@/lib/auth";
import { env } from "@/lib/env";

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const password = String(form?.get("password") ?? "");
  const ok = password.length > 0 && safeEqual(password, env.appPassword());
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
