"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Help } from "./Help";

const NAV = [
  { href: "/", label: "Today", tour: "nav-today" },
  { href: "/filtered", label: "Filtered out", tour: "nav-filtered" },
  { href: "/thesis", label: "Thesis", tour: "nav-thesis" },
  { href: "/runs", label: "Runs", tour: "nav-runs" },
];

function active(path: string, href: string) {
  return href === "/" ? path === "/" || path.startsWith("/review") : path.startsWith(href);
}

export function TopBar() {
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  return (
    <>
      <header className="topbar">
        <div className="wrap topbar-inner">
          <Link href="/" className="brand">Funding Radar</Link>
          <nav className="nav" aria-label="Main">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} data-tour={n.tour} aria-current={active(path, n.href) ? "page" : undefined}>{n.label}</Link>
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
          <Link key={n.href} href={n.href} data-tour={`${n.tour}-m`} aria-current={active(path, n.href) ? "page" : undefined}>{n.label}</Link>
        ))}
      </nav>
    </>
  );
}
