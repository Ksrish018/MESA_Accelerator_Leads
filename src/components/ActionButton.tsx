"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "./Toast";

/** A single POST action with a busy state, a result toast and a page refresh. */
export function ActionButton({
  path, label, busyLabel, done, className = "btn btn-secondary btn-sm", ariaLabel,
}: {
  path: string; label: string; busyLabel: string; done: (json: any) => string; className?: string; ariaLabel?: string;
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();
  return (
    <button
      className={className}
      disabled={busy}
      aria-label={ariaLabel}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
          toast({ text: done(j), ms: 6000 });
          router.refresh();
        } catch (e) {
          toast({ text: `${label} failed. ${(e as Error).message}`, ms: 6000 });
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? busyLabel : label}
    </button>
  );
}
