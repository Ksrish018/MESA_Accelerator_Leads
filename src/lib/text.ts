/** Text helpers shared by ingest, verification and dedupe. Pure, no I/O. */

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘",
  rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…", rupee: "₹", inr: "₹",
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

/** Strip tags, scripts and styles; keep paragraph breaks as spaces. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|iframe)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalise for quote matching: lower case, unify quotes, dashes and currency
 * spellings, collapse whitespace. Used on both sides of every comparison.
 */
export function normalizeForMatch(s: string): string {
  return decodeEntities(s)
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[‘’‚‛′`]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTitle(title: string): string {
  return normalizeForMatch(title).replace(/[^a-z0-9₹$ ]/g, "").replace(/\s+/g, " ").trim();
}

const TRACKING = /^(utm_|fbclid|gclid|mc_|ref$|ref_src|cmpid|ito$)/i;

export function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) u.pathname = u.pathname.replace(/\/+$/, "");
    return u.toString();
  } catch {
    return raw.trim();
  }
}

/** Registrable-ish domain: hostname without www. Good enough for allowlists and identity. */
export function domainOf(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const host = new URL(withProto).hostname.toLowerCase().replace(/^www\./, "");
    return host.includes(".") ? host : null;
  } catch {
    return null;
  }
}

/** True when `host` is `domain` or a subdomain of it. */
export function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

export function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

const SKIP_LINK = /(facebook|twitter|x\.com|linkedin|instagram|youtube|youtu\.be|whatsapp|t\.me|telegram|pinterest|reddit|google\.|apple\.com|play\.google|feedburner|wp\.me|gravatar|disqus|mailto:|javascript:)/i;

/**
 * Outbound links printed in an article, as "Anchor (https://site)" lines.
 * Lets extraction read a company website the article actually links to;
 * the lines are part of the source text, so the quote check still applies.
 */
export function extractLinks(html: string, ownHost: string | null, max = 20): string[] {
  const out = new Map<string, string>();
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = decodeEntities(m[1]).trim();
    const text = htmlToText(m[2]).slice(0, 60);
    if (!/^https?:\/\//i.test(href) || SKIP_LINK.test(href) || text.length < 2) continue;
    const host = domainOf(href);
    if (!host || (ownHost && hostMatches(host, ownHost))) continue;
    let origin: string;
    try { origin = new URL(href).origin; } catch { continue; }
    if (!out.has(origin)) out.set(origin, `${text} (${origin})`);
    if (out.size >= max) break;
  }
  return [...out.values()];
}
