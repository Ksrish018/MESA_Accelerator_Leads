"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Help } from "./Help";

const NAV = [
  { href: "/", label: "Today", tour: "nav-today" },
  { href: "/pipeline", label: "Pipeline", tour: "nav-pipeline" },
  { href: "/filtered", label: "Filtered out", tour: "nav-filtered" },
  { href: "/thesis", label: "Thesis", tour: "nav-thesis" },
  { href: "/runs", label: "Runs", tour: "nav-runs" },
];

function active(path: string, href: string) {
  return href === "/" ? path === "/" || path.startsWith("/review") : path.startsWith(href);
}

type VTDocument = Document & { startViewTransition?: (cb: () => Promise<void>) => { finished: Promise<void> } };

/**
 * Tab navigation with the View Transitions API: the header photo and title
 * morph into the next page's and the content fades and rises in. The new
 * state is captured once the next page has rendered (or after 900 ms).
 * Falls back to a plain navigation when the API or motion is unavailable.
 */
function useTabNavigate() {
  const router = useRouter();
  const path = usePathname();
  const pending = useRef<{ href: string; done: () => void } | null>(null);

  useEffect(() => {
    const p = pending.current;
    if (!p) return;
    const target = p.href.split("?")[0];
    if (target !== path && !(target === "/" && path === "/")) return;
    let tries = 0;
    const check = () => {
      const loading = document.querySelector('main [aria-label="Loading"]');
      if (!loading || tries++ > 30) { p.done(); pending.current = null; return; }
      setTimeout(check, 30);
    };
    check();
  }, [path]);

  return useCallback((href: string) => {
    const doc = document as VTDocument;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!doc.startViewTransition || reduce || href === path) { router.push(href); return; }
    document.documentElement.classList.add("vt-active");
    const t = doc.startViewTransition(
      () => new Promise<void>((resolve) => {
        const timer = setTimeout(() => { pending.current = null; resolve(); }, 900);
        pending.current = { href, done: () => { clearTimeout(timer); resolve(); } };
        router.push(href);
      }),
    );
    t.finished.finally(() => document.documentElement.classList.remove("vt-active"));
  }, [path, router]);
}

export function TopBar() {
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const navigate = useTabNavigate();
  const navRef = useRef<HTMLElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  // The highlight behind the active tab glides to the next tab.
  useLayoutEffect(() => {
    const place = () => {
      const a = navRef.current?.querySelector<HTMLElement>('a[aria-current="page"]');
      setPill(a ? { left: a.offsetLeft, width: a.offsetWidth } : null);
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [path]);

  const onNav = (href: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(href);
  };

  return (
    <>
      <header className="topbar">
        <div className="wrap topbar-inner">
          <Link href="/" className="brand" onClick={onNav("/")}>Funding Radar</Link>
          <nav className="nav" aria-label="Main" ref={navRef}>
            {pill ? <span className="nav-pill" aria-hidden style={{ transform: `translateX(${pill.left}px)`, width: pill.width }} /> : null}
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} data-tour={n.tour} aria-current={active(path, n.href) ? "page" : undefined} onClick={onNav(n.href)}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="row" style={{ marginLeft: "auto" }}>
            <Help />
            <div style={{ position: "relative" }}>
              <button className="icon-btn" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><circle cx="3" cy="8" r="1.5" fill="currentColor" /><circle cx="8" cy="8" r="1.5" fill="currentColor" /><circle cx="13" cy="8" r="1.5" fill="currentColor" /></svg>
              </button>
              {menu ? (
                <div className="card" style={{ position: "absolute", right: 0, top: 44, padding: 8, minWidth: 180, zIndex: 80 }} onMouseLeave={() => setMenu(false)}>
                  <Link className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "flex-start" }} href="/credits" onClick={() => setMenu(false)}>Credits</Link>
                  <form action="/api/auth/signout" method="post">
                    <button className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "flex-start" }} type="submit">Sign out</button>
                  </form>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>
      <nav className="bottom-nav" aria-label="Main">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} data-tour={`${n.tour}-m`} aria-current={active(path, n.href) ? "page" : undefined} onClick={onNav(n.href)}>
            {n.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
