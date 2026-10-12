"use client";

import { useEffect, useRef, useState } from "react";

/** KPI counter (PRD §10.1 motion). Counts from the previous value; instant under reduced motion. */
export function CountUp({ value }: { value: number }) {
  const [n, setN] = useState(value);
  const from = useRef(0);
  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || start === value) { setN(value); return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 700);
      setN(Math.round(start + (value - start) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // Background tabs pause animation frames; the number must still end up right.
    const settle = setTimeout(() => setN(value), 800);
    return () => { cancelAnimationFrame(raf); clearTimeout(settle); };
  }, [value]);
  return <span className="num">{n}</span>;
}
