"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "./Toast";

export function RescueButton({ id, name }: { id: string; name: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();
  return (
    <button
      className="btn btn-secondary btn-sm"
      disabled={busy}
      aria-label={`Rescue ${name}`}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await fetch(`/api/startups/${id}/rescue`, { method: "POST" });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
          toast({ text: `${name} moved to Today`, actions: [{ label: "Review", onClick: () => router.push(`/review/${id}`) }], ms: 6000 });
          router.refresh();
        } catch (e) {
          toast({ text: `Rescue failed. ${(e as Error).message}`, ms: 6000 });
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Drafting" : "Rescue"}
    </button>
  );
}
