/**
 * Image slots (PRD §10.2). Curated Unsplash photos under the Unsplash License,
 * downloaded into /public/images (not hotlinked) and credited on /credits.
 * A slot set to null falls back to a calm gradient.
 */
export interface Slot { src: string; alt: string; photographer: string; profile: string; photo: string }

export const IMAGES: Record<"signin" | "today" | "empty" | "filtered" | "thesis" | "runs", Slot | null> = {
  signin: {
    src: "/images/signin.jpg",
    alt: "Mumbai skyline across the sea at golden hour",
    photographer: "Palak Pitroda",
    profile: "https://unsplash.com/@palak_pitroda",
    photo: "https://unsplash.com/photos/a-sunset-over-a-body-of-water-with-a-city-in-the-distance-XdF-MUJO4eM",
  },
  today: {
    src: "/images/today.jpg",
    alt: "Soft pink and blue dawn sky",
    photographer: "Adrian Infernus",
    profile: "https://unsplash.com/@adrian_infernus",
    photo: "https://unsplash.com/photos/a-pink-and-blue-sky-with-a-few-clouds-GLf7bAwCdYg",
  },
  empty: {
    src: "/images/empty.jpg",
    alt: "Still water meeting an open horizon",
    photographer: "Thomas Vimare",
    profile: "https://unsplash.com/@vimarethomas",
    photo: "https://unsplash.com/photos/body-of-water-under-blue-and-white-sky-at-daytime-IZ01rjX0XQA",
  },
  filtered: {
    src: "/images/filtered.jpg",
    alt: "White building facade seen from below",
    photographer: "Lance Anderson",
    profile: "https://unsplash.com/@lanceanderson",
    photo: "https://unsplash.com/photos/worm-eye-view-of-white-building-sHEOEceOCE4",
  },
  thesis: {
    src: "/images/thesis.jpg",
    alt: "Architectural drawing of curved stairs",
    photographer: "Amsterdam City Archives",
    profile: "https://unsplash.com/@amsterdamcityarchives",
    photo: "https://unsplash.com/photos/architectural-drawings-of-curved-stairs-and-structures-1i1ncG9x1CE",
  },
  runs: {
    src: "/images/runs.jpg",
    alt: "Light trails on a road at night",
    photographer: "Christian Englmeier",
    profile: "https://unsplash.com/@christianem",
    photo: "https://unsplash.com/photos/timelapse-on-road-J7EUjSlNQtg",
  },
};
