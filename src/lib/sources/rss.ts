import { XMLParser } from "fast-xml-parser";
import { decodeEntities, domainOf, extractLinks, htmlToText } from "../text";

export interface FeedItem {
  title: string;
  link: string;
  published_at: string | null;
  summary: string;
  content: string | null; // full content:encoded when the publisher puts it in the feed
  publisher: string | null; // Google News <source>
  publisher_url: string | null;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  cdataPropName: "#cdata",
  processEntities: true,
  htmlEntities: true,
});

function text(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (Array.isArray(v)) return text(v[0]);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("#cdata" in o) return text(o["#cdata"]);
    if ("#text" in o) return text(o["#text"]);
    if ("@_href" in o) return text(o["@_href"]);
  }
  return "";
}

function toIso(s: string): string | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function withLinks(text: string, links: string[]): string {
  return links.length ? `${text}\nLinks in article:\n${links.join("\n")}` : text;
}

/** Parses RSS 2.0 and Atom into a flat list. Keeps only what PRD §5.2 allows. */
export function parseFeed(xml: string): FeedItem[] {
  const doc = parser.parse(xml);
  const rssItems = doc?.rss?.channel?.item ?? doc?.["rdf:RDF"]?.item;
  const atomEntries = doc?.feed?.entry;
  const raw: unknown[] = rssItems ? [rssItems].flat() : atomEntries ? [atomEntries].flat() : [];
  return raw
    .map((it) => {
      const o = it as Record<string, unknown>;
      let link = text(o.link);
      if (!link && Array.isArray(o.link)) link = text((o.link as unknown[])[0]);
      const src = o.source as Record<string, unknown> | string | undefined;
      const descHtml = text(o.description ?? o.summary);
      const contentHtml = text(o["content:encoded"] ?? o.content);
      return {
        title: decodeEntities(htmlToText(text(o.title))),
        link: link.trim(),
        published_at: toIso(text(o.pubDate ?? o.published ?? o.updated ?? o["dc:date"])),
        summary: htmlToText(descHtml).slice(0, 2000),
        content: contentHtml ? withLinks(htmlToText(contentHtml).slice(0, 20000), extractLinks(contentHtml, domainOf(link))) : null,
        publisher: src ? text(src) || null : null,
        publisher_url: src && typeof src === "object" ? (text((src as Record<string, unknown>)["@_url"]) || null) : null,
      };
    })
    .filter((i) => i.title && i.link);
}
