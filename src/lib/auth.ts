/**
 * Password gate (PRD §11): APP_PASSWORD checked once, then a signed HTTP-only
 * cookie (HMAC-SHA256 with SESSION_SECRET) for 30 days. Web Crypto only, so
 * the same code runs in middleware and in route handlers.
 */
export const SESSION_COOKIE = "fr_session";
export const SESSION_DAYS = 30;

const enc = new TextEncoder();

function b64url(buf: ArrayBuffer): string {
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function makeSession(secret: string, now = Date.now()): Promise<string> {
  const payload = `v1.${now + SESSION_DAYS * 86_400_000}`;
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function verifySession(secret: string, token: string | undefined | null, now = Date.now()): Promise<boolean> {
  if (!token || !secret) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp < now) return false;
  return safeEqual(parts[2], await hmac(secret, `${parts[0]}.${parts[1]}`));
}

/** Bearer CRON_SECRET, as Vercel Cron sends it. */
export function hasCronSecret(authHeader: string | null, secret: string | undefined): boolean {
  if (!authHeader || !secret) return false;
  return safeEqual(authHeader, `Bearer ${secret}`);
}
