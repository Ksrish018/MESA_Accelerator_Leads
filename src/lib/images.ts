/**
 * Image slots (PRD §10.2). Curated Unsplash photos, downloaded into
 * /public/images and credited on /credits. A slot with no file falls back to a
 * calm gradient, so pages never depend on an image being present.
 */
export interface Slot { src: string; alt: string; photographer: string; profile: string; photo: string }

export const IMAGES: Record<"signin" | "today" | "empty" | "filtered" | "thesis" | "runs", Slot | null> = {
  signin: null,
  today: null,
  empty: null,
  filtered: null,
  thesis: null,
  runs: null,
};
