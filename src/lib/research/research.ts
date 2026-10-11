import "server-only";
import { db, must } from "../db";
import { fetchPage } from "../sources/fetch";
import { decodeEntities, htmlToText, truncate } from "../text";
import type { Contact } from "../types";
import { extractEmails, rankContacts } from "./contacts";

export interface ResearchRow {
  startup_id: string;
  url: string | null;
  title: string | null;
  description: string | null;
  text_excerpt: string | null;
  contacts: Contact[];
  pages: string[];
  ok: boolean;
  error: string | null;
}

function meta(html: string, name: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`,
    "i",
  );
  const m = html.match(re);
  const v = m?.[1] ?? m?.[2];
  return v ? decodeEntities(v).replace(/\s+/g, " ").trim() || null : null;
}

function titleOf(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1]).replace(/\s+/g, " ").trim() || null : null;
}

/** Links on the home page to about, team or contact pages on the same host. */
function subpageLinks(html: string, base: URL): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<a[^>]+href=["']([^"'#]+)["']/gi)) {
    try {
      const u = new URL(m[1], base);
      if (u.hostname.replace(/^www\./, "") !== base.hostname.replace(/^www\./, "")) continue;
      if (/\/(about|about-us|team|our-team|company|contact|contact-us)\/?$/i.test(u.pathname)) out.push(u.origin + u.pathname);
    } catch { /* ignore bad hrefs */ }
  }
  const rank = (s: string) => (/contact/i.test(s) ? 0 : /team/i.test(s) ? 1 : 2);
  return [...new Set(out)].sort((a, b) => rank(a) - rank(b));
}

/**
 * Light research on the startup's own website (PRD §5.5): home page title,
 * description, capped text and published addresses, plus up to two of
 * /about, /team, /contact. Only when robots.txt allows. Never searches for a
 * website that the sources did not name.
 */
export async function researchStartup(s: { id: string; website_url: string | null; website_domain: string | null }, founderNames: string[]): Promise<ResearchRow> {
  const empty: ResearchRow = {
    startup_id: s.id, url: null, title: null, description: null, text_excerpt: null, contacts: [], pages: [], ok: false, error: null,
  };
  if (!s.website_url && !s.website_domain) return { ...empty, error: "No website found" };
  const url = s.website_url && /^https?:\/\//i.test(s.website_url) ? s.website_url : `https://${s.website_domain ?? s.website_url}`;

  const home = await fetchPage(url);
  if (!home) {
    const row = { ...empty, url, error: "Website unreachable or disallowed" };
    await save(row);
    return row;
  }
  const base = new URL(home.finalUrl);
  const emails = extractEmails(home.html).map((address) => ({ address, where_found_url: home.finalUrl }));
  const pages = [home.finalUrl];
  let candidates = subpageLinks(home.html, base);
  if (!candidates.length) candidates = [`${base.origin}/contact`, `${base.origin}/about`];
  for (const link of candidates.slice(0, 2)) {
    const p = await fetchPage(link, 8000);
    if (!p) continue;
    pages.push(p.finalUrl);
    for (const address of extractEmails(p.html)) emails.push({ address, where_found_url: p.finalUrl });
  }

  const row: ResearchRow = {
    startup_id: s.id,
    url: home.finalUrl,
    title: titleOf(home.html),
    description: meta(home.html, "description") ?? meta(home.html, "og:description"),
    text_excerpt: truncate(htmlToText(home.html), 4000),
    contacts: rankContacts(emails, founderNames, s.website_domain ?? base.hostname.replace(/^www\./, "")),
    pages,
    ok: true,
    error: null,
  };
  await save(row);
  return row;
}

async function save(row: ResearchRow) {
  must(await db().from("research").upsert({ ...row, fetched_at: new Date().toISOString() }), "save research");
}
