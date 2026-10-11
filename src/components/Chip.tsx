import { chipMeta } from "@/lib/chips";

export function Chip({ label, tone }: { label: string; tone?: string }) {
  const meta = chipMeta(label);
  const t = tone ?? meta.tone;
  return (
    <span className={`chip chip-${t}`} data-tip={meta.help ?? undefined} tabIndex={meta.help ? 0 : undefined} aria-label={meta.help ? `${label}. ${meta.help}` : undefined}>
      {label}
    </span>
  );
}
