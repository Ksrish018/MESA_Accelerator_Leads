"use client";

import { useEffect, useRef, useState } from "react";
import { CHIP_HELP, HELP_ORDER } from "@/lib/chips";
import { Chip } from "./Chip";
import { useTour } from "./Tour";

/** Help side sheet (PRD §10.5): Take the tour, chip guide, where things live. */
export function Help() {
  const [open, setOpen] = useState(false);
  const tour = useTour();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const h = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open]);

  return (
    <>
      <button className="icon-btn" aria-label="Help" onClick={() => setOpen(true)}>?</button>
      {open ? (
        <>
          <div className="sheet-backdrop" onClick={() => setOpen(false)} />
          <aside className="sheet" role="dialog" aria-modal="true" aria-labelledby="help-title">
            <div className="row between">
              <h2 id="help-title" className="h2">Help</h2>
              <button ref={closeRef} className="icon-btn" aria-label="Close" onClick={() => setOpen(false)}>×</button>
            </div>
            <button className="btn btn-primary" style={{ marginTop: 24, width: "100%" }} onClick={() => { setOpen(false); tour.start(); }}>
              Take the tour
            </button>

            <h3 className="eyebrow" style={{ marginTop: 32 }}>Status and chips</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0" }} className="stack-16">
              {HELP_ORDER.map((k) => (
                <li key={k}>
                  <Chip label={k} />
                  <div className="small muted" style={{ marginTop: 6 }}>{CHIP_HELP[k].help}</div>
                </li>
              ))}
            </ul>

            <h3 className="eyebrow" style={{ marginTop: 32 }}>Where things live</h3>
            <dl className="small" style={{ margin: "12px 0 0" }}>
              <dt style={{ fontWeight: 600 }}>Thesis</dt>
              <dd style={{ margin: "2px 0 12px" }} className="muted">Supabase table <code>thesis_versions</code></dd>
              <dt style={{ fontWeight: 600 }}>Drafts</dt>
              <dd style={{ margin: "2px 0 12px" }} className="muted">Your Gmail Drafts folder</dd>
              <dt style={{ fontWeight: 600 }}>Accelerator details</dt>
              <dd style={{ margin: "2px 0 0" }} className="muted">Supabase table <code>settings</code></dd>
            </dl>
          </aside>
        </>
      ) : null}
    </>
  );
}
