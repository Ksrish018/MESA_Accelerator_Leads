/**
 * Golden-set evaluation (PRD §12). Runs live Gemini extraction on each
 * article, then the same code checks the pipeline uses (quote check, stage
 * mapping, hard rules, dedupe, amount conflict, draft lint). Prints pass/fail
 * per case and a summary. Usage: npm run eval
 * Nothing is written to Supabase except llm_calls cost rows.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { extractArticle } from "../src/lib/extract/extract";
import { mapStage } from "../src/lib/extract/stage";
import { amountsConflict, parseAmount } from "../src/lib/extract/amount";
import { matchStartup, normalizeName, type KnownStartup } from "../src/lib/dedupe/names";
import { lintDraft } from "../src/lib/draft/lint";
import { verifyRound } from "../src/lib/verify/quotes";
import { applyHardRules } from "../src/lib/thesis/rules";
import { activeThesis } from "../src/lib/thesis/load";

type Exp = { company: string; is_new_round?: boolean; stage?: string; rule?: "pass" | "fail"; reason?: string; reason_prefix?: string; negative?: string; use_of_funds_quoted?: boolean };
interface Case {
  id: string; kind: "extract" | "dedupe" | "amounts" | "draft"; article?: string; expect?: Exp[];
  forbid_new_seed?: string[]; expect_injection?: boolean; expect_no_new_seed?: boolean;
  names?: { name: string; website_domain: string | null }[]; expect_unique?: number;
  amounts?: string[]; usd_inr_rate?: number; expect_conflict?: boolean;
  subject?: string; body?: string; expect_lint_fail?: boolean;
}

const file = JSON.parse(readFileSync(path.resolve(__dirname, "cases.json"), "utf8")) as { contacted: string[]; cases: Case[] };

async function main() {
  const thesis = await activeThesis();
  const contacted = new Set(file.contacted.map(normalizeName));
  const results: { id: string; pass: boolean; notes: string[] }[] = [];
  let stageRight = 0, stageTotal = 0, tp = 0, fp = 0, fn = 0;

  for (const c of file.cases) {
    const notes: string[] = [];
    let pass = true;
    const fail = (m: string) => { pass = false; notes.push(m); };
    try {
      if (c.kind === "extract") {
        const ex = await extractArticle({ runId: null, title: "", publisher: "eval", publishedAt: new Date().toISOString(), url: `eval://${c.id}`, text: c.article! });
        const verified = ex.rounds.map((r) => verifyRound(r, c.article!));
        const newRounds = verified.filter((v) => v.round.is_new_round && v.companyFound);
        if (c.expect_injection && !ex.injection_suspected) fail("injection not flagged");
        for (const v of newRounds) {
          const stage = mapStage(v.round.stage_text);
          const amt = parseAmount(v.round.amount_text, 88);
          if (c.expect_injection && (amt?.usd ?? 0) > 10_000_000) fail(`injected amount accepted: ${v.round.amount_text}`);
          if (stage === "other" && v.round.stage_text && /series c/i.test(v.round.stage_text) && c.expect_injection) fail("injected stage accepted");
        }
        if (c.expect_no_new_seed) {
          const seeds = newRounds.filter((v) => ["seed", "pre_seed"].includes(mapStage(v.round.stage_text)) && !v.round.negative_events.length);
          if (seeds.length) fail(`unexpected new seed round: ${seeds.map((s) => s.round.company).join(", ")}`);
          else tp++;
        }
        for (const name of c.forbid_new_seed ?? []) {
          if (newRounds.some((v) => normalizeName(v.round.company) === normalizeName(name) && ["seed", "pre_seed"].includes(mapStage(v.round.stage_text)))) fail(`${name} treated as a new seed round`);
        }
        for (const e of c.expect ?? []) {
          const v = newRounds.find((x) => normalizeName(x.round.company) === normalizeName(e.company));
          if (!v) { fail(`missing ${e.company}`); fn++; continue; }
          tp++;
          const stage = mapStage(v.round.stage_text);
          if (e.stage) { stageTotal++; if (stage === e.stage) stageRight++; else fail(`${e.company} stage ${stage}, expected ${e.stage}`); }
          if (e.negative && !v.round.negative_events.includes(e.negative as never)) fail(`${e.company} missing ${e.negative}`);
          if (e.use_of_funds_quoted && !(v.round.use_of_funds && v.round.quotes.use_of_funds)) fail(`${e.company} use of funds not captured with quote`);
          if (e.rule) {
            const res = applyHardRules({
              stage, stage_text: v.round.stage_text, negative_events: v.round.negative_events, sector_words: v.round.sector_words,
              location: v.round.location, announced_at: new Date().toISOString(), contacted: contacted.has(normalizeName(e.company)), has_credible_source: true,
            }, thesis);
            const got = res.pass ? "pass" : "fail";
            if (got !== e.rule) fail(`${e.company} hard rules ${got}${res.pass ? "" : ` (${res.reason})`}, expected ${e.rule}`);
            if (!res.pass && e.reason && res.reason !== e.reason) fail(`${e.company} reason "${res.reason}", expected "${e.reason}"`);
            if (!res.pass && e.reason_prefix && !res.reason.startsWith(e.reason_prefix)) fail(`${e.company} reason "${res.reason}"`);
            notes.push(`${e.company}: ${stage} · ${got}${res.pass ? "" : ` · ${res.reason}`}`);
          }
        }
        const expected = new Set((c.expect ?? []).map((e) => normalizeName(e.company)));
        for (const v of newRounds) if (!expected.has(normalizeName(v.round.company)) && !c.expect_no_new_seed && !c.forbid_new_seed) fp++;
        if (ex.injection_suspected) notes.push("injection_suspected");
      } else if (c.kind === "dedupe") {
        const known: KnownStartup[] = [];
        for (const n of c.names!) {
          const m = matchStartup(n, known);
          if (m.kind === "none") known.push({ id: String(known.length), name: n.name, name_norm: normalizeName(n.name), website_domain: n.website_domain });
        }
        if (known.length !== c.expect_unique) fail(`${known.length} startups, expected ${c.expect_unique}`);
      } else if (c.kind === "amounts") {
        const usd = c.amounts!.map((a) => parseAmount(a, c.usd_inr_rate ?? 88)?.usd ?? 0);
        if (amountsConflict(usd) !== c.expect_conflict) fail(`conflict ${!c.expect_conflict}, expected ${c.expect_conflict}`);
        notes.push(usd.map((u) => `$${u}`).join(" vs "));
      } else if (c.kind === "draft") {
        const errs = lintDraft(c.subject!, c.body!);
        if (c.expect_lint_fail && !errs.length) fail("lint passed a banned draft");
        notes.push(errs.slice(0, 3).join("; "));
      }
    } catch (e) {
      fail(`error: ${(e as Error).message}`);
    }
    results.push({ id: c.id, pass, notes });
    console.log(`${pass ? "PASS" : "FAIL"}  ${c.id}${notes.length ? `  · ${notes.join(" | ")}` : ""}`);
  }

  const passed = results.filter((r) => r.pass).length;
  const precision = tp + fp ? tp / (tp + fp) : 1;
  const recall = tp + fn ? tp / (tp + fn) : 1;
  const summary = {
    run_at: new Date().toISOString(),
    model: process.env.GEMINI_MODEL ?? "gemini-3.8-flash",
    passed: `${passed}/${results.length}`,
    extraction_precision: Number(precision.toFixed(2)),
    extraction_recall: Number(recall.toFixed(2)),
    stage_accuracy: stageTotal ? Number((stageRight / stageTotal).toFixed(2)) : null,
    results,
  };
  console.log(`\n${passed}/${results.length} passed · precision ${summary.extraction_precision} · recall ${summary.extraction_recall} · stage accuracy ${summary.stage_accuracy}`);
  writeFileSync(path.resolve(__dirname, "report.json"), JSON.stringify(summary, null, 2));
  process.exit(passed === results.length ? 0 : 1);
}

main();
