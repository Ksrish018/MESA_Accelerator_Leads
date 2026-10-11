import type { Contact } from "../types";

/**
 * Contacts are published or absent (PRD §5.5). We only read addresses printed
 * on the page (mailto: links or visible text). No pattern guessing, ever.
 */
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const IGNORE = /(example\.com|sentry|wixpress|\.png|\.jpg|\.jpeg|\.gif|\.webp|\.svg|@2x|noreply|no-reply|donotreply|privacy@|abuse@|postmaster@|webmaster@)/i;
const GENERAL = /^(founders?|hello|hi|contact|info|team|connect|partnerships?|business|sales|support|careers|hr|jobs)@/i;
const PRESS = /^(press|media|pr|comms|communications)@/i;
const PERSONAL_WEBMAIL = /@(gmail|yahoo|hotmail|outlook|rediffmail|icloud|proton|protonmail)\./i;

export function extractEmails(html: string): string[] {
  const found = new Set<string>();
  for (const m of html.matchAll(/mailto:([^"'?\s>]+)/gi)) found.add(decodeURIComponent(m[1]).toLowerCase());
  const visible = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ");
  for (const m of visible.matchAll(EMAIL)) found.add(m[0].toLowerCase());
  return [...found].filter((e) => !IGNORE.test(e) && e.length < 80);
}

/**
 * Ranks published addresses: founder-named first, then general inboxes
 * (founders@, hello@, contact@), then press. Personal webmail addresses are
 * kept only when they are on the company's own page, and ranked last.
 */
export function rankContacts(
  emails: { address: string; where_found_url: string }[],
  founderNames: string[],
  companyDomain: string | null,
): Contact[] {
  const firstNames = founderNames
    .map((n) => n.trim().split(/\s+/)[0]?.toLowerCase())
    .filter((n): n is string => !!n && n.length > 2);
  const seen = new Set<string>();
  const out: (Contact & { rank: number })[] = [];
  for (const e of emails) {
    const addr = e.address.toLowerCase();
    if (seen.has(addr)) continue;
    seen.add(addr);
    const local = addr.split("@")[0];
    const domain = addr.split("@")[1] ?? "";
    const onCompanyDomain = companyDomain ? domain === companyDomain || domain.endsWith(`.${companyDomain}`) : false;
    let kind: Contact["kind"] = "other";
    let rank = 4;
    if (firstNames.some((f) => local.includes(f))) { kind = "founder"; rank = 0; }
    else if (GENERAL.test(addr)) { kind = "general"; rank = /^founders?@/.test(addr) ? 1 : 2; }
    else if (PRESS.test(addr)) { kind = "press"; rank = 3; }
    if (!onCompanyDomain) rank += 2;
    if (PERSONAL_WEBMAIL.test(addr)) rank += 3;
    out.push({ address: addr, where_found_url: e.where_found_url, kind, rank });
  }
  return out.sort((a, b) => a.rank - b.rank).map(({ rank: _r, ...c }) => c);
}
