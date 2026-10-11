"use client";

import { useEffect, useState } from "react";
import type { CardView } from "@/lib/queries";
import { StartupCard } from "./StartupCard";
import { useTour } from "./Tour";

/** Sample startup for empty days (PRD §10.5). Shown only while the tour runs. Never stored. */
export function SampleWhenTouring({ empty }: { empty: React.ReactNode }) {
  const { active } = useTour();
  const [card, setCard] = useState<CardView | null>(null);
  useEffect(() => {
    if (!active || card) return;
    fetch("/demo/sample.json").then((r) => r.json()).then((j) => setCard(j.card)).catch(() => {});
  }, [active, card]);
  if (!active || !card) return <>{empty}</>;
  return (
    <div className="cards" data-tour="today-list" data-review-href="/review/sample">
      <StartupCard c={card} index={0} href="/review/sample" sample />
    </div>
  );
}
