import "server-only";
import { env } from "../env";

/** Fire the next background slice of a cron run (see /api/run/chain). */
export async function chain(origin: string, runId: string, hop: number) {
  await fetch(`${origin}/api/run/chain`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.cronSecret()}` },
    body: JSON.stringify({ runId, hop }),
    cache: "no-store",
  }).catch(() => undefined);
}
