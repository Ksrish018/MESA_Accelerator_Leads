import { PageHero } from "@/components/Hero";
import { PipelineFlow } from "@/components/PipelineFlow";
import { StartupTable } from "@/components/StartupTable";
import { allStartups, pipelineView } from "@/lib/pipeline";
import { activeThesis } from "@/lib/thesis/load";

export const metadata = { title: "Pipeline" };
export const dynamic = "force-dynamic";

export default async function Pipeline() {
  const [view, rows, thesis] = await Promise.all([pipelineView(null), allStartups(), activeThesis()]);
  const sourcesOn = view.sources.length;
  return (
    <>
      <PageHero compact slot="runs" title="Pipeline" lede="Watch each run turn news into drafts. Tap any item to see its source." meta={`${sourcesOn} sources · thesis v${thesis.version} · ${rows.length} startups tracked`} />
      <div className="wrap wrap-wide section-tight">
        <PipelineFlow initial={view} table={<StartupTable rows={rows} windowDays={thesis.window_days} />} />
      </div>
    </>
  );
}
