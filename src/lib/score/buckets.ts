import type { Bucket, Criterion } from "../types";

/** Weighted score 0-100 from criterion scores 0-5 (PRD §5.6). Pure. */
export function computeTotal(scores: { key: string; score_0_5: number }[], criteria: Criterion[]): number {
  const totalWeight = criteria.reduce((s, c) => s + c.weight, 0);
  if (!totalWeight) return 0;
  let sum = 0;
  for (const c of criteria) {
    const s = scores.find((x) => x.key === c.key);
    const v = Math.max(0, Math.min(5, s?.score_0_5 ?? 0));
    sum += (v / 5) * c.weight;
  }
  return Math.round((sum / totalWeight) * 100);
}

export function bucketFor(total: number, fitThreshold: number, reviewThreshold: number): Bucket {
  if (total >= fitThreshold) return "fit";
  if (total >= reviewThreshold) return "worth_a_look";
  return "not_a_fit";
}

/**
 * "Round size in range" is a deterministic criterion: 5 inside the thesis
 * range, 2 when undisclosed or within 2x of it, 0 otherwise.
 */
export function roundSizeScore(usd: number | null | undefined, min: number | null, max: number | null): number {
  if (usd == null || usd <= 0) return 2;
  const lo = min ?? 0;
  const hi = max ?? Number.POSITIVE_INFINITY;
  if (usd >= lo && usd <= hi) return 5;
  if (usd >= lo / 2 && usd <= hi * 2) return 2;
  return 0;
}

export const BUCKET_LABEL: Record<Bucket, string> = {
  fit: "Fit",
  worth_a_look: "Worth a look",
  not_a_fit: "Not a fit",
};
