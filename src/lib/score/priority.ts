/** Priority ordering for Today (PRD §7.4). Deterministic and pure. */

export interface PriorityItem {
  id: string;
  total: number;
  daysLeft: number;
  closing: boolean;
  warm: boolean;
  confidenceRank: number;
  announcedAt: string;
}

export function comparePriority(a: PriorityItem, b: PriorityItem): number {
  if (a.closing !== b.closing) return a.closing ? -1 : 1;
  if (a.closing && b.closing && a.daysLeft !== b.daysLeft) return a.daysLeft - b.daysLeft;
  if (a.total !== b.total) return b.total - a.total;
  if (a.warm !== b.warm) return a.warm ? -1 : 1;
  if (a.confidenceRank !== b.confidenceRank) return b.confidenceRank - a.confidenceRank;
  const t = new Date(b.announcedAt).getTime() - new Date(a.announcedAt).getTime();
  if (t !== 0) return t;
  return a.id.localeCompare(b.id);
}

export function sortByPriority<T extends PriorityItem>(items: T[]): T[] {
  return [...items].sort(comparePriority);
}

/** Warm path (PRD §7.2 group F): a network investor, a named founder or a published contact. */
export function warmPath(investors: string[], network: string[]): string | null {
  const net = network.map((n) => n.toLowerCase().trim()).filter(Boolean);
  for (const inv of investors) {
    const i = inv.toLowerCase();
    const hit = net.find((n) => i.includes(n) || n.includes(i));
    if (hit) return inv;
  }
  return null;
}

/** Confidence chip text and rank (PRD §5.8, group G). */
export function confidence(sourceCount: number, hasTier1: boolean, quotesVerified: boolean): { label: string; rank: number } {
  const label =
    sourceCount <= 1 ? "1 source" : `${sourceCount} sources${quotesVerified ? " · verified" : ""}`;
  return { label, rank: sourceCount + (hasTier1 ? 1 : 0) + (quotesVerified ? 1 : 0) };
}
