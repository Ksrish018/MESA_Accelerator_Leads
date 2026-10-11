import { NextResponse, type NextRequest } from "next/server";
import { hasCronSecret, SESSION_COOKIE, verifySession } from "./lib/auth";

const PUBLIC = [/^\/signin$/, /^\/api\/auth\/signin$/, /^\/api\/health$/];
const CRON_OK = [/^\/api\/cron$/, /^\/api\/run(\/.*)?$/, /^\/api\/sources\/check$/];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((r) => r.test(pathname))) return NextResponse.next();
  if (CRON_OK.some((r) => r.test(pathname)) && hasCronSecret(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.next();
  }
  const ok = await verifySession(process.env.SESSION_SECRET ?? "", req.cookies.get(SESSION_COOKIE)?.value);
  if (ok) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/signin";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|images/|demo/|favicon.ico|icon.svg|robots.txt).*)"],
};
