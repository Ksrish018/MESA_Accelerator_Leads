"use client";

import { useEffect, useState } from "react";

/**
 * The run as a river: one band from Sources to Drafted whose width narrows
 * with each stage's count (log scale so 2 and 200 both stay visible), with
 * particles drifting along it. Faster while a run is live. Decorative.
 */
export function FlowRibbon({ counts, activeIndex, running }: { counts: number[]; activeIndex: number[]; running: boolean }) {
  const [still, setStill] = useState(false);
  useEffect(() => { setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches); }, []);

  const W = 1200, H = 120, mid = H / 2, n = counts.length, step = W / n;
  const max = Math.max(1, ...counts);
  const half = counts.map((c) => 5 + 44 * (Math.log1p(c) / Math.log1p(max)));
  const xs = counts.map((_, i) => (i + 0.5) * step);

  const edge = (sign: 1 | -1) => {
    let d = `M0 ${mid + sign * half[0]} L${xs[0]} ${mid + sign * half[0]}`;
    for (let i = 0; i < n - 1; i++) {
      const y0 = mid + sign * half[i], y1 = mid + sign * half[i + 1], cx = step / 2;
      d += ` C${xs[i] + cx} ${y0} ${xs[i + 1] - cx} ${y1} ${xs[i + 1]} ${y1}`;
    }
    return `${d} L${W} ${mid + sign * half[n - 1]}`;
  };
  const top = edge(-1);
  const bottom = edge(1);
  // Close the band: top edge left to right, then bottom edge right to left.
  const bottomRev = (() => {
    let d = `L${W} ${mid + half[n - 1]} L${xs[n - 1]} ${mid + half[n - 1]}`;
    for (let i = n - 1; i > 0; i--) {
      const y0 = mid + half[i], y1 = mid + half[i - 1], cx = step / 2;
      d += ` C${xs[i] - cx} ${y0} ${xs[i - 1] + cx} ${y1} ${xs[i - 1]} ${y1}`;
    }
    return `${d} L0 ${mid + half[0]} Z`;
  })();

  const dur = running ? 3.2 : 9;
  const lanes = [-0.45, 0, 0.45];
  const particles = still ? [] : Array.from({ length: running ? 18 : 9 }, (_, i) => ({ lane: lanes[i % 3], delay: (i * dur) / (running ? 18 : 9) }));

  return (
    <svg className="ribbon" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="ribbon-fill" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#5ac8fa" />
          <stop offset="35%" stopColor="#0a84ff" />
          <stop offset="70%" stopColor="#8b6cff" />
          <stop offset="100%" stopColor="#30d158" />
        </linearGradient>
        <filter id="ribbon-glow" x="-10%" y="-50%" width="120%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <clipPath id="ribbon-clip"><path d={`${top} ${bottomRev}`} /></clipPath>
      </defs>
      <path d={`${top} ${bottomRev}`} fill="url(#ribbon-fill)" opacity="0.28" filter="url(#ribbon-glow)" />
      <path d={`${top} ${bottomRev}`} fill="url(#ribbon-fill)" opacity="0.78" />
      <path d={top} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <path d={bottom} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <g clipPath="url(#ribbon-clip)">
        {particles.map((p, i) => (
          <circle key={i} r="2.4" fill="#fff" opacity="0.85">
            <animateMotion dur={`${dur}s`} begin={`${-p.delay}s`} repeatCount="indefinite"
              path={`M-10 ${mid + p.lane * 10} L${W + 10} ${mid + p.lane * 10}`} />
          </circle>
        ))}
      </g>
      {xs.map((x, i) => (
        <g key={i}>
          <line x1={x} x2={x} y1={mid - half[i] - 4} y2={mid + half[i] + 4} stroke="rgba(255,255,255,0.55)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          {activeIndex.includes(i) && !still ? (
            <circle cx={x} cy={mid} r="9" fill="none" stroke="#fff" strokeWidth="1.5" vectorEffect="non-scaling-stroke">
              <animate attributeName="r" values="6;16;6" dur="1.8s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0;1" dur="1.8s" repeatCount="indefinite" />
            </circle>
          ) : null}
        </g>
      ))}
    </svg>
  );
}
