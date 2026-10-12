// Drives one pipeline run on the deployed app until it finishes. Usage: node --env-file=.env.local scripts/run-live.mjs <base-url>
const base = process.argv[2] ?? "https://funding-radar-sand.vercel.app";
const h = { Authorization: `Bearer ${process.env.CRON_SECRET}`, "Content-Type": "application/json" };
const show = (r) => {
  const c = r.counts ?? {};
  console.log(new Date().toISOString().slice(11, 19), r.step, r.status, JSON.stringify({ fetched: c.fetched, candidates: c.candidates, read: c.articles_read, rounds: c.rounds_found, new: c.round_new, more: c.round_more_coverage, hist: c.round_historical, checked: c.checked, filtered: c.filtered, parked: c.parked, worth: c.worth_a_look, notfit: c.not_a_fit, fits: c.fits, errors: (r.errors ?? []).length }));
};
let r = await (await fetch(`${base}/api/run`, { method: "POST", headers: h })).json();
show(r);
while (r.status === "running") {
  const res = await fetch(`${base}/api/run/step`, { method: "POST", headers: h, body: JSON.stringify({ runId: r.id }) });
  r = await res.json();
  show(r);
}
for (const e of (r.errors ?? []).slice(-8)) console.log("ERR", e.step, e.message);
