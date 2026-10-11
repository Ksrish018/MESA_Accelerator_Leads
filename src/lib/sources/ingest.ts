import "server-only";
import { db, must } from "../db";
import { canonicalUrl, domainOf, hostMatches, normalizeTitle } from "../text";
import { fetchFeed } from "./fetch";
import { parseFeed, type FeedItem } from "./rss";
import { isFundingCandidate } from "./prefilter";

export interface SourceRow {
  id: string; name: string; url: string; kind: "rss" | "google_news" | "press"; tier: number; enabled: boolean;
}

export interface SourceResult { name: string; ok: boolean; items: number; kept: number; candidates: number; error?: string }

interface Publisher { domain: string; name: string; tier: number }

function publisherFor(domain: string | null, pubs: Publisher[]): Publisher | null {
  if (!domain) return null;
  return pubs.find((p) => hostMatches(domain, p.domain)) ?? null;
}

/** Fetch one feed and report what came back, without storing anything (M0 source check). */
export async function checkSource(s: Pick<SourceRow, "name" | "url">): Promise<SourceResult & { latest: string | null }> {
  const t0 = Date.now();
  try {
    const items = parseFeed(await fetchFeed(s.url));
    const latest = items.map((i) => i.published_at).filter(Boolean).sort().pop() ?? null;
    return {
      name: s.name, ok: items.length > 0, items: items.length, kept: items.length,
      candidates: items.filter((i) => isFundingCandidate(i.title, i.summary)).length, latest,
      error: items.length ? undefined : `No items (${Date.now() - t0} ms)`,
    };
  } catch (e) {
    return { name: s.name, ok: false, items: 0, kept: 0, candidates: 0, latest: null, error: (e as Error).message };
  }
}

/**
 * Ingest (PRD §5.2): fetch every enabled source, keep title, link, publisher,
 * date and summary, pre-filter in code, dedupe by canonical URL and
 * normalised title. Google News items count only when the original publisher
 * is on the Tier 1 or 2 allowlist.
 */
export async function ingestSources(since: Date | null): Promise<SourceResult[]> {
  const supa = db();
  const sources = must(await supa.from("sources").select("*").eq("enabled", true), "load sources") as SourceRow[];
  const pubs = must(await supa.from("publishers").select("*"), "load publishers") as Publisher[];

  const results = await Promise.all(
    sources.map(async (s): Promise<SourceResult> => {
      let items: FeedItem[];
      try {
        items = parseFeed(await fetchFeed(s.url));
      } catch (e) {
        const msg = (e as Error).message.slice(0, 200);
        await supa.from("sources").update({ last_checked_at: new Date().toISOString(), last_error: msg }).eq("id", s.id);
        return { name: s.name, ok: false, items: 0, kept: 0, candidates: 0, error: msg };
      }
      await supa.from("sources").update({
        last_checked_at: new Date().toISOString(), last_ok_at: new Date().toISOString(),
        last_item_count: items.length, last_error: null,
      }).eq("id", s.id);

      const rows = [];
      for (const it of items) {
        if (since && it.published_at && new Date(it.published_at) < since) continue;
        let publisher = s.name;
        let pubDomain = domainOf(it.link);
        let tier = s.tier;
        if (s.kind === "google_news") {
          pubDomain = domainOf(it.publisher_url);
          const p = publisherFor(pubDomain, pubs);
          if (!p || p.tier === 0) continue; // discovery only: unlisted publishers never count
          publisher = p.name;
          tier = p.tier;
        } else {
          const p = publisherFor(pubDomain, pubs);
          if (p?.tier === 0) continue;
        }
        const title = s.kind === "google_news" ? it.title.replace(/\s+-\s+[^-]+$/, "") : it.title;
        rows.push({
          source_id: s.id,
          url: canonicalUrl(it.link),
          title,
          title_norm: normalizeTitle(title),
          publisher,
          publisher_domain: pubDomain,
          publisher_tier: tier,
          published_at: it.published_at,
          summary: it.summary,
          body_text: it.content && it.content.length > it.summary.length + 200 ? it.content : null,
          is_candidate: isFundingCandidate(title, it.summary),
        });
      }
      return { name: s.name, ok: true, items: items.length, kept: rows.length, candidates: rows.filter((r) => r.is_candidate).length, _rows: rows } as SourceResult & { _rows: typeof rows };
    }),
  );

  // Dedupe across sources by canonical URL and normalised title, then insert.
  const all = results.flatMap((r) => ((r as any)._rows ?? []) as any[]);
  const byTitle = new Map<string, any>();
  for (const row of all) {
    const prev = byTitle.get(row.title_norm);
    // Same story from two feeds: keep the more credible publisher (lower tier number).
    if (!prev || (row.publisher_tier ?? 9) < (prev.publisher_tier ?? 9)) byTitle.set(row.title_norm, row);
  }
  const unique = [...byTitle.values()];
  if (unique.length) {
    const existing = new Set<string>();
    for (let i = 0; i < unique.length; i += 100) {
      const chunk = unique.slice(i, i + 100);
      const res = await supa.from("articles").select("title_norm").in("title_norm", chunk.map((r) => r.title_norm));
      for (const r of res.data ?? []) existing.add(r.title_norm);
    }
    const fresh = unique.filter((r) => !existing.has(r.title_norm));
    for (let i = 0; i < fresh.length; i += 100) {
      must(
        await supa.from("articles").upsert(fresh.slice(i, i + 100), { onConflict: "url", ignoreDuplicates: true }),
        "insert articles",
      );
    }
  }
  return results.map(({ _rows, ...r }: any) => r);
}
