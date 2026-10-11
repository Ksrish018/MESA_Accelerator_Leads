import Image from "next/image";
import { IMAGES } from "@/lib/images";

type SlotName = keyof typeof IMAGES;

/** At most one hero per screen, always under a scrim when text sits on it. */
export function HeroImage({ slot, priority = false, zoom = false }: { slot: SlotName; priority?: boolean; zoom?: boolean }) {
  const img = IMAGES[slot];
  if (!img) return <div className="hero-fallback" aria-hidden />;
  return (
    <Image
      src={img.src}
      alt={img.alt}
      fill
      priority={priority}
      sizes="100vw"
      quality={70}
      className={`hero-img${zoom ? " kenburns" : ""}`}
    />
  );
}

export function PageHero({ slot, title, meta, children }: { slot: SlotName; title: string; meta?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="page-hero hero" data-parallax>
      <HeroImage slot={slot} priority />
      <div className="hero-scrim" />
      <div className="page-hero-content">
        <div className="wrap row between" style={{ alignItems: "flex-end" }}>
          <div className="reveal">
            <h1 className="h1">{title}</h1>
            {meta ? <div className="muted" style={{ marginTop: 6 }}>{meta}</div> : null}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
