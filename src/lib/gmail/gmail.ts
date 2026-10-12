import "server-only";
import { env } from "../env";

/**
 * Gmail is used only to create, read and delete drafts (scope gmail.compose).
 * There is deliberately no code path that delivers mail; Rohit presses the
 * button in Gmail himself. tests/no-send.test.ts enforces this.
 */

const API = "https://gmail.googleapis.com/gmail/v1/users/me/drafts";

let cached: { token: string; exp: number } | null = null;

export function gmailConfigured(): boolean {
  const g = env.google();
  return !!(g.clientId && g.clientSecret && g.refreshToken);
}

async function accessToken(): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const g = env.google();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: g.clientId, client_secret: g.clientSecret, refresh_token: g.refreshToken, grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !json.access_token) throw new Error(`Gmail auth failed: ${json.error ?? res.status}`);
  cached = { token: json.access_token, exp: Date.now() + (json.expires_in ?? 3000) * 1000 };
  return cached.token;
}

function b64url(s: string): string {
  return Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeHeader(s: string): string {
  return /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`;
}

/** RFC 2822 message for a plain-text draft. Pure, exported for tests. */
export function buildMime(opts: { from: string; to: string | null; subject: string; body: string }): string {
  const lines = [
    `From: ${opts.from}`,
    ...(opts.to ? [`To: ${opts.to}`] : []),
    `Subject: ${encodeHeader(opts.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(opts.body.replace(/\r?\n/g, "\r\n"), "utf8").toString("base64").replace(/(.{76})/g, "$1\r\n"),
  ];
  return lines.join("\r\n");
}

async function call(path: string, init: RequestInit): Promise<Response> {
  const token = await accessToken();
  return fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
  });
}

/** users.drafts.create */
export async function createDraft(opts: { to: string | null; subject: string; body: string }): Promise<{ id: string; messageId: string | null }> {
  const raw = b64url(buildMime({ from: env.google().sender, ...opts }));
  const res = await call("", { method: "POST", body: JSON.stringify({ message: { raw } }) });
  const json = (await res.json().catch(() => ({}))) as { id?: string; message?: { id?: string }; error?: { message?: string } };
  if (!res.ok || !json.id) throw new Error(`Gmail draft failed: ${json.error?.message ?? res.status}`);
  return { id: json.id, messageId: json.message?.id ?? null };
}

/** users.drafts.update: replace the content of an existing draft (Approve with edits, Regenerate). */
export async function updateDraft(id: string, opts: { to: string | null; subject: string; body: string }): Promise<void> {
  const raw = b64url(buildMime({ from: env.google().sender, ...opts }));
  const res = await call(`/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ id, message: { raw } }) });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(`Gmail drafts.update failed: ${json.error?.message ?? res.status}`);
  }
}

/** users.drafts.get: true if the draft still exists in Drafts. */
export async function draftExists(id: string): Promise<boolean> {
  const res = await call(`/${encodeURIComponent(id)}?format=minimal`, { method: "GET" });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`Gmail drafts.get failed: ${res.status}`);
  return true;
}

/** users.drafts.delete: used only by Undo within 10 seconds of Approve. */
export async function deleteDraft(id: string): Promise<void> {
  const res = await call(`/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error(`Gmail drafts.delete failed: ${res.status}`);
}
