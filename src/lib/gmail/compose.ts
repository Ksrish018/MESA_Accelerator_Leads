/** Prefilled Gmail compose link for the Copy / Open in Gmail fallback. Safe for the browser. */
export function composeUrl(opts: { to: string | null; subject: string; body: string }): string {
  const p = new URLSearchParams({ view: "cm", fs: "1", su: opts.subject, body: opts.body });
  if (opts.to) p.set("to", opts.to);
  return `https://mail.google.com/mail/?${p.toString()}`;
}
