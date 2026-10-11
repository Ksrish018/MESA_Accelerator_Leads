/** Window maths (PRD §5.4, §7.3 T4). Pure. */

const DAY = 24 * 60 * 60 * 1000;

export interface WindowInfo {
  day: number; // day N since announcement, 0-based
  daysLeft: number; // days until the window closes (0 on the last day)
  best: boolean; // days 0-30
  closing: boolean; // within closing_days of the end
  closed: boolean; // past the window
  endsAt: Date;
}

export function windowInfo(
  announcedAt: Date | string,
  now: Date = new Date(),
  windowDays = 60,
  closingDays = 10,
): WindowInfo {
  const start = new Date(announcedAt);
  const day = Math.max(0, Math.floor((now.getTime() - start.getTime()) / DAY));
  const daysLeft = windowDays - day;
  return {
    day,
    daysLeft: Math.max(0, daysLeft),
    best: day <= 30,
    closing: daysLeft >= 0 && daysLeft <= closingDays && day <= windowDays,
    closed: day > windowDays,
    endsAt: new Date(start.getTime() + windowDays * DAY),
  };
}

/** Earliest credible publication date wins (PRD §5.4). Ignores tier 3 sources. */
export function earliestCredible(dates: { at: string | Date | null; tier: number | null }[]): Date | null {
  const ok = dates
    .filter((d) => d.at && d.tier != null && d.tier <= 2)
    .map((d) => new Date(d.at as string))
    .filter((d) => !Number.isNaN(d.getTime()));
  if (!ok.length) return null;
  return new Date(Math.min(...ok.map((d) => d.getTime())));
}
