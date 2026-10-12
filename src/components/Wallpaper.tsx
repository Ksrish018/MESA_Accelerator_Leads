"use client";

import { usePathname } from "next/navigation";

/**
 * Animated wallpaper behind every screen: four soft colour fields that drift
 * slowly. Each tab has its own palette; colours cross-fade on navigation.
 * Purely decorative (aria-hidden) and still under reduced motion.
 */
function themeFor(path: string): string {
  if (path === "/") return "today";
  if (path.startsWith("/review")) return "review";
  if (path.startsWith("/pipeline")) return "pipeline";
  if (path.startsWith("/filtered")) return "filtered";
  if (path.startsWith("/thesis")) return "thesis";
  if (path.startsWith("/runs")) return "runs";
  return "default";
}

export function Wallpaper() {
  const theme = themeFor(usePathname());
  return (
    <div className="wallpaper" data-theme={theme} aria-hidden>
      <i className="blob b1" />
      <i className="blob b2" />
      <i className="blob b3" />
      <i className="blob b4" />
      <i className="wall-grid" />
    </div>
  );
}
