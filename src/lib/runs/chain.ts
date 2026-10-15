import "server-only";
import { env } from "../env";

/**
 * Where the next background slice is sent. Always the public production
 * address: a deployment-specific URL (what Vercel Cron calls) sits behind
 * Vercel's deployment protection, so a call to it never arrives.
 */
export function chainOrigin(requestOrigin: string): string {
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return prod ? `https://${prod}` : requestOrigin;
}

/** Fire the next background slice of a run (see /api/run/chain). Returns false if it could not be started. */
export async function chain(origin: string, runId: string, hop: number): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${chainOrigin(origin)}/api/run/chain`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.cronSecret()}` },
        body: JSON.stringify({ runId, hop }),
        cache: "no-store",
      });
      if (res.status === 202) return true;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  return false;
}
