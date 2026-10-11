/** Dates and times in the user's timezone (IST by default). Every number has a unit and a time. */
const TZ = "Asia/Kolkata";

export function fmtTime(iso: string | null | undefined, tz = TZ): string {
  if (!iso) return "never";
  return `${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }).format(new Date(iso))} IST`;
}

export function fmtDate(iso: string | Date | null | undefined, tz = TZ): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: tz }).format(new Date(iso));
}

export function fmtDateTime(iso: string | null | undefined, tz = TZ): string {
  if (!iso) return "never";
  return `${fmtDate(iso, tz)}, ${fmtTime(iso, tz)}`;
}

export function fmtShortDate(iso: string | null | undefined, tz = TZ): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: tz }).format(new Date(iso));
}

export function hostOf(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
