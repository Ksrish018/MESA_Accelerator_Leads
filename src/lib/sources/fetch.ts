import "server-only";
import { USER_AGENT } from "../env";

/**
 * Polite fetching (PRD §6.3 rule 8): identifying user agent, robots.txt
 * respected for page fetches, at most one request per second per domain.
 * State lives for one function invocation, which is enough for our batches.
 */
const lastHit = new Map<string, number>();
const robotsCache = new Map<string, { disallow: string[]; allow: string[] } | null>();

async function pace(host: string) {
  const prev = lastHit.get(host) ?? 0;
  const wait = prev + 1000 - Date.now();
  lastHit.set(host, Math.max(Date.now(), prev + 1000));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

async function rawFetch(url: string, timeoutMs: number, accept = "*/*"): Promise<Response> {
  const host = new URL(url).hostname;
  await pace(host);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: accept, "Accept-Language": "en-IN,en;q=0.9" },
      redirect: "follow",
      signal: ctrl.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Minimal robots.txt parser for the "*" group and our own agent. */
export function parseRobots(txt: string): { disallow: string[]; allow: string[] } {
  const disallow: string[] = [];
  const allow: string[] = [];
  let applies = false;
  let sawRule = false;
  for (const line of txt.split(/\r?\n/)) {
    const l = line.replace(/#.*/, "").trim();
    if (!l) continue;
    const [k, ...rest] = l.split(":");
    const key = k.trim().toLowerCase();
    const val = rest.join(":").trim();
    if (key === "user-agent") {
      if (sawRule) { applies = false; sawRule = false; }
      const ua = val.toLowerCase();
      if (ua === "*" || ua.includes("fundingradar")) applies = true;
    } else if (key === "disallow" || key === "allow") {
      sawRule = true;
      if (!applies || !val) continue;
      (key === "disallow" ? disallow : allow).push(val);
    }
  }
  return { disallow, allow };
}

export function robotsAllows(rules: { disallow: string[]; allow: string[] } | null, path: string): boolean {
  if (!rules) return true;
  const match = (p: string) => {
    const re = new RegExp("^" + p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"));
    return re.test(path);
  };
  const longest = (xs: string[]) => xs.filter(match).reduce((m, p) => Math.max(m, p.length), -1);
  const a = longest(rules.allow);
  const d = longest(rules.disallow);
  return d < 0 || a >= d;
}

async function robotsFor(origin: string) {
  if (robotsCache.has(origin)) return robotsCache.get(origin)!;
  let rules: { disallow: string[]; allow: string[] } | null = null;
  try {
    const res = await rawFetch(`${origin}/robots.txt`, 6000, "text/plain");
    if (res.ok) rules = parseRobots(await res.text());
    else if (res.status === 401 || res.status === 403) rules = { disallow: ["/"], allow: [] };
  } catch {
    rules = null; // unreachable robots.txt: treat as no rules, like most crawlers
  }
  robotsCache.set(origin, rules);
  return rules;
}

/** Fetch an RSS feed. Feeds are published for machine reading; no robots check. */
export async function fetchFeed(url: string, timeoutMs = 12000): Promise<string> {
  const res = await rawFetch(url, timeoutMs, "application/rss+xml, application/atom+xml, application/xml, text/xml, */*");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/** Fetch an HTML page only if robots.txt allows it. Returns null when disallowed or failed. */
export async function fetchPage(url: string, timeoutMs = 10000): Promise<{ html: string; finalUrl: string } | null> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  const rules = await robotsFor(u.origin);
  if (!robotsAllows(rules, u.pathname + u.search)) return null;
  try {
    const res = await rawFetch(u.toString(), timeoutMs, "text/html,application/xhtml+xml");
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html")) return null;
    const html = (await res.text()).slice(0, 600_000);
    return { html, finalUrl: res.url || u.toString() };
  } catch {
    return null;
  }
}
