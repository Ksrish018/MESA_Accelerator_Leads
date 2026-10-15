/**
 * Sign-in log: when someone signs in (or fails to), which browser and device,
 * and the approximate city and country Vercel reports. No IP address, no
 * cookies, nothing personal. Stored in the decisions log (action "signin").
 */

/** "Chrome on Windows", "Safari on iPhone", ... Pure, exported for tests. */
export function describeAgent(ua: string | null | undefined): string {
  if (!ua) return "Unknown browser";
  const s = ua.toLowerCase();
  if (/bot|crawler|spider|headless|curl|wget|python|node-fetch|undici/.test(s)) return "Automated client";
  const browser =
    /edg\//.test(s) ? "Edge" :
    /opr\/|opera/.test(s) ? "Opera" :
    /firefox\/|fxios/.test(s) ? "Firefox" :
    /chrome\/|crios/.test(s) ? "Chrome" :
    /safari\//.test(s) ? "Safari" : "Browser";
  const device =
    /iphone/.test(s) ? "iPhone" :
    /ipad/.test(s) ? "iPad" :
    /android/.test(s) ? "Android" :
    /windows/.test(s) ? "Windows" :
    /mac os x|macintosh/.test(s) ? "Mac" :
    /linux/.test(s) ? "Linux" : "unknown device";
  return `${browser} on ${device}`;
}

/** Approximate place from Vercel's edge headers, e.g. "Bengaluru, IN". */
export function describePlace(h: Headers): string | null {
  const city = h.get("x-vercel-ip-city");
  const country = h.get("x-vercel-ip-country");
  const c = city ? decodeURIComponent(city) : null;
  return [c, country].filter(Boolean).join(", ") || null;
}
