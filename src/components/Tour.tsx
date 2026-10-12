"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * First-run tour (PRD §10.5): spotlight coach marks on the real screens.
 * It only highlights; it never approves or skips anything. Esc or Skip ends it.
 */

interface Step { route: "today" | "review" | "any"; target: string; mobileTarget?: string; text: string }

const STEPS: Step[] = [
  { route: "today", target: '[data-tour="today-list"]', text: "Startups that match your thesis. Most urgent first." },
  { route: "today", target: '[data-tour="card-chips"]', text: "Day count, fit score and source count at a glance." },
  { route: "review", target: '[data-tour="facts"]', text: "Every fact links to its source. Check the quotes before approving." },
  { route: "review", target: '[data-tour="draft"]', text: "Edit the email, then Approve. It is saved to your Gmail Drafts." },
  { route: "any", target: '[data-tour="nav-filtered"]', mobileTarget: '[data-tour="nav-filtered-m"]', text: "Startups that did not qualify, with the reason. Rescue any you want." },
  { route: "any", target: '[data-tour="nav-thesis"]', mobileTarget: '[data-tour="nav-thesis-m"]', text: "What qualifies. Edit it in Supabase; the next run follows it." },
];

const DONE_KEY = "fr_tour_done";
const REVIEW_KEY = "fr_tour_review";

type Phase = "off" | "offer" | "steps" | "final";
interface Ctx { active: boolean; start: () => void }
const TourCtx = createContext<Ctx>({ active: false, start: () => {} });
export const useTour = () => useContext(TourCtx);

function store(key: string, value: string | null) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* storage blocked: the server flag still applies */ }
}
function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function TourProvider({ completed, children }: { completed: boolean; children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>("off");
  const [step, setStep] = useState(0);
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (!completed && !read(DONE_KEY) && (path === "/" || path === "")) setPhase("offer");
    // first sign-in only; the dependency list is intentionally empty
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = useCallback(() => {
    setPhase("off");
    store(DONE_KEY, new Date().toISOString());
    fetch("/api/settings/tour", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => {});
  }, []);

  const goTo = useCallback((i: number) => {
    const s = STEPS[i];
    if (s.route === "today" && path !== "/") router.push("/");
    if (s.route === "review" && !path.startsWith("/review")) {
      const href = document.querySelector('[data-tour="today-list"]')?.getAttribute("data-review-href") ?? read(REVIEW_KEY) ?? "/review/sample";
      store(REVIEW_KEY, href);
      router.push(href);
    }
    setStep(i);
    setPhase("steps");
  }, [path, router]);

  const start = useCallback(() => {
    setStep(0);
    if (path !== "/") router.push("/");
    setPhase("steps");
  }, [path, router]);

  const next = useCallback(() => (step + 1 < STEPS.length ? goTo(step + 1) : setPhase("final")), [goTo, step]);
  const back = useCallback(() => (step > 0 ? goTo(step - 1) : undefined), [goTo, step]);

  return (
    <TourCtx.Provider value={{ active: phase === "steps" || phase === "final", start }}>
      {children}
      {phase === "offer" ? <Offer onStart={start} onSkip={finish} /> : null}
      {phase === "steps" ? <Spotlight step={step} onNext={next} onBack={back} onExit={finish} /> : null}
      {phase === "final" ? <Final onFinish={finish} /> : null}
    </TourCtx.Provider>
  );
}

function useTrap(ref: React.RefObject<HTMLDivElement | null>, onKey: (e: KeyboardEvent) => void) {
  useEffect(() => {
    const el = ref.current;
    el?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const h = (e: KeyboardEvent) => {
      if (e.key === "Tab" && el) {
        const f = [...el.querySelectorAll<HTMLElement>("button")];
        if (!f.length) return;
        const i = f.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
        return;
      }
      onKey(e);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [ref, onKey]);
}

function Offer({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useTrap(ref, useCallback((e: KeyboardEvent) => { if (e.key === "Escape") onSkip(); }, [onSkip]));
  return (
    <div className="tour-start" role="dialog" aria-modal="true" aria-labelledby="tour-offer-title">
      <div className="card reveal" ref={ref}>
        <h2 id="tour-offer-title" className="h3">Quick tour · 6 steps · about 1 minute</h2>
        <div className="row" style={{ justifyContent: "center", marginTop: 20 }}>
          <button className="btn btn-secondary" onClick={onSkip}>Skip</button>
          <button className="btn btn-primary" onClick={onStart} data-autofocus>Start</button>
        </div>
      </div>
    </div>
  );
}

function Final({ onFinish }: { onFinish: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useTrap(ref, useCallback((e: KeyboardEvent) => { if (e.key === "Escape" || e.key === "Enter") onFinish(); }, [onFinish]));
  return (
    <div className="tour-start" role="dialog" aria-modal="true" aria-labelledby="tour-final-title">
      <div className="card reveal" ref={ref}>
        <h2 id="tour-final-title" className="h3">Done. Nothing is ever sent without you.</h2>
        <div className="row" style={{ justifyContent: "center", marginTop: 20 }}>
          <button className="btn btn-primary" onClick={onFinish} data-autofocus>Finish</button>
        </div>
      </div>
    </div>
  );
}

function Spotlight({ step, onNext, onBack, onExit }: { step: number; onNext: () => void; onBack: () => void; onExit: () => void }) {
  const s = STEPS[step];
  const ref = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    let raf = 0;
    let tries = 0;
    const find = () => {
      const mobile = window.matchMedia("(max-width: 760px)").matches;
      const el = document.querySelector<HTMLElement>((mobile && s.mobileTarget) || s.target);
      if (!el) {
        if (tries++ < 120) raf = requestAnimationFrame(find);
        return;
      }
      // Instant scroll: smooth scrolling gets interrupted by layout changes and leaves the target off screen.
      const r0 = el.getBoundingClientRect();
      const fits = r0.top >= 64 && r0.bottom <= window.innerHeight - (mobile ? 200 : 24);
      if (!fits) window.scrollTo({ top: Math.max(0, window.scrollY + r0.top - 80), behavior: "auto" });
      // Track the target continuously so layout shifts, scrolling and late data never misplace the spotlight.
      let last = "";
      const update = () => {
        const r = el.getBoundingClientRect();
        const key = `${Math.round(r.top)}:${Math.round(r.left)}:${Math.round(r.width)}:${Math.round(r.height)}`;
        if (key !== last) { last = key; setRect(r); }
      };
      update();
      const timer = window.setInterval(update, 120);
      cleanup = () => window.clearInterval(timer);
    };
    let cleanup = () => {};
    setRect(null);
    find();
    return () => { cancelAnimationFrame(raf); cleanup(); };
  }, [s]);

  useTrap(ref, useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onExit();
    else if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); onNext(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); onBack(); }
  }, [onExit, onNext, onBack]));

  const pad = 8;
  const pop: React.CSSProperties = {};
  if (rect) {
    const below = rect.bottom + 16 + 180 < window.innerHeight;
    pop.top = below ? rect.bottom + pad + 12 : Math.max(16, rect.top - pad - 12 - 180);
    pop.left = Math.min(Math.max(16, rect.left), window.innerWidth - 356);
  } else {
    pop.top = "40%";
    pop.left = "calc(50% - 170px)";
  }

  return (
    <>
      <div className="tour-mask" style={{ pointerEvents: "auto" }} aria-hidden onClick={(e) => e.stopPropagation()} />
      {rect ? (
        <div className="tour-hole" style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
      ) : (
        <div className="tour-hole" style={{ top: "50%", left: "50%", width: 0, height: 0 }} />
      )}
      <div className="tour-pop" style={pop} ref={ref} role="dialog" aria-modal="true" aria-labelledby="tour-step-text" aria-describedby="tour-step-count">
        <p id="tour-step-count" className="tiny muted" aria-live="polite">Step {step + 1} of {STEPS.length}</p>
        <p id="tour-step-text" style={{ margin: "6px 0 16px", fontSize: 17, fontWeight: 500 }}>{s.text}</p>
        <div className="row between">
          <span className="dots" aria-hidden>{STEPS.map((_, i) => <i key={i} className={i === step ? "on" : ""} />)}</span>
          <div className="row">
            <button className="btn btn-ghost btn-sm" onClick={onExit}>Skip</button>
            {step > 0 ? <button className="btn btn-secondary btn-sm" onClick={onBack}>Back</button> : null}
            <button className="btn btn-primary btn-sm" onClick={onNext} data-autofocus>{step + 1 === STEPS.length ? "Done" : "Next"}</button>
          </div>
        </div>
      </div>
    </>
  );
}
