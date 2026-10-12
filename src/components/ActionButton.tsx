"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "./Toast";

/**
 * A single POST action with a busy state, a result toast and a page refresh.
 * Messages are plain strings (so Server Components can render this): the key
 * matching the response's "outcome" wins, else "default"; {field} is filled
 * from the JSON response.
 */
function message(messages: Record<string, string>, json: Record<string, unknown>): string {
  let t = messages[String(json.outcome ?? "")];
  if (!t && json.queued === 0 && messages.none) t = messages.none;
  if (!t) t = messages.default ?? "Done";
  return t.replace(/\{(\w+)\}/g, (_, k: string) => String(json[k] ?? ""));
}

export function ActionButton({
  path, label, busyLabel, messages, className = "btn btn-secondary btn-sm", ariaLabel,
}: {
  path: string; label: string; busyLabel: string; messages: Record<string, string>; className?: string; ariaLabel?: string;
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
          toast({ text: message(messages, j), ms: 6000 });
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
