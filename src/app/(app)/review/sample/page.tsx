"use client";

import { useEffect, useState } from "react";
import { ReviewClient } from "@/components/ReviewClient";
import type { ReviewView } from "@/lib/queries";

/** The labelled Sample startup (PRD §10.5). Loaded from public/demo/sample.json; never touches the database or Gmail. */
export default function SampleReview() {
  const [v, setV] = useState<ReviewView | null>(null);
  useEffect(() => {
    fetch("/demo/sample.json").then((r) => r.json()).then((j) => setV(j as ReviewView)).catch(() => {});
  }, []);
  if (!v) {
    return (
      <div className="wrap section review">
        <div className="sk" style={{ height: 520, borderRadius: 20 }} />
        <div className="sk" style={{ height: 520, borderRadius: 20 }} />
      </div>
    );
  }
  return <ReviewClient v={v} sample />;
}
