import { db } from "@/lib/db";
import { IMAGES } from "@/lib/images";

export const metadata = { title: "Credits" };
export const dynamic = "force-dynamic";

export default async function Credits() {
  const sources = ((await db().from("sources").select("name, url, tier").eq("enabled", true).order("tier")).data ?? []) as { name: string; url: string; tier: number }[];
  const photos = Object.entries(IMAGES).filter(([, v]) => v) as [string, NonNullable<(typeof IMAGES)[keyof typeof IMAGES]>][];
  return (
    <div className="wrap wrap-narrow section stack-24">
      <h1 className="h1 reveal">Credits</h1>
      <section className="stack-16 reveal reveal-1">
        <h2 className="h3">Photography</h2>
        {photos.length ? (
          <div className="list">
            {photos.map(([slot, p]) => (
              <div key={slot} className="list-row">
                <span className="grow">{p.alt}</span>
                <span className="small">
                  <a href={p.photo} target="_blank" rel="noreferrer">Photo</a> by <a href={p.profile} target="_blank" rel="noreferrer">{p.photographer}</a> on Unsplash
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="small muted">No photographs in use.</p>
        )}
      </section>
      <section className="stack-16 reveal reveal-2">
        <h2 className="h3">Data sources</h2>
        <div className="list">
          {sources.map((s) => (
            <div key={s.name} className="list-row">
              <span className="grow">{s.name}</span>
              <span className="small muted">Tier {s.tier}</span>
              <a className="small" href={s.url} target="_blank" rel="noreferrer">Feed</a>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
