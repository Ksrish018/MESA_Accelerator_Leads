"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

interface ToastAction { label: string; href?: string; onClick?: () => void }
interface ToastMsg { id: number; text: string; actions?: ToastAction[]; ms?: number }
const Ctx = createContext<(t: Omit<ToastMsg, "id">) => void>(() => {});
export const useToast = () => useContext(Ctx);

/** One toast at a time, survives navigation (lives in the app layout). */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [t, setT] = useState<ToastMsg | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((m: Omit<ToastMsg, "id">) => {
    if (timer.current) clearTimeout(timer.current);
    const msg = { ...m, id: Date.now() };
    setT(msg);
    timer.current = setTimeout(() => setT((cur) => (cur?.id === msg.id ? null : cur)), m.ms ?? 10_000);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div aria-live="polite" role="status">
        {t ? (
          <div className="toast" key={t.id}>
            <span>{t.text}</span>
            {t.actions?.map((a) =>
              a.href ? (
                <a key={a.label} href={a.href} target="_blank" rel="noreferrer">{a.label}</a>
              ) : (
                <button key={a.label} onClick={() => { setT(null); a.onClick?.(); }}>{a.label}</button>
              ),
            )}
          </div>
        ) : null}
      </div>
    </Ctx.Provider>
  );
}
