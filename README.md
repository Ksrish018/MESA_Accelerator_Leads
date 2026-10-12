# Funding Radar

Morning outreach drafts for an accelerator's programme lead. Every morning it reads free news and press-release feeds, finds new pre-seed and seed rounds, checks every fact against its source, drops anyone already contacted or outside the 60-day window, scores each startup against a thesis stored in Supabase, and prepares a sourced fact sheet plus a draft email. The programme lead reviews, edits and approves; Approve puts the email in Gmail Drafts. **The system never sends email.**

- **Live URL:** https://funding-radar-sand.vercel.app (password in the submission note; start with the Quick tour)
- Spec: [`docs/PRD.md`](docs/PRD.md) · Components Map: [`docs/components-map.png`](docs/components-map.png)
- Golden set: [`eval/cases.json`](eval/cases.json) · latest report: [`eval/report.json`](eval/report.json) (15/15 pass, extraction precision 1.0, recall 1.0, stage accuracy 1.0)

## Booklet rules and where they are enforced

| Rule | Where |
|---|---|
| Gemini Flash for every AI step, no Claude API | `src/lib/gemini.ts` is the only model client (`GEMINI_MODEL`, default `gemini-3.8-flash`); `tests/no-send.test.ts` fails on any other LLM API |
| Deployed on Vercel with live data | Vercel project `funding-radar`, daily cron `30 0 * * *` (06:00 IST) in `vercel.json`, Run now on Today and Runs |
| Thesis in Supabase, versioned | `thesis_versions` table; the active row is loaded at run time (`src/lib/thesis/load.ts`); every score stores its `thesis_version` |
| No duplicate outreach | `outreach` row per company (primary key `startup_id`); Approve refuses a contacted company; hard rule "Already contacted" |
| Never sends email | Gmail `drafts.create` / `drafts.get` / `drafts.delete` only, scope `gmail.compose`; `tests/no-send.test.ts` scans `src/` |

## How it works

| Step | Who | What |
|---|---|---|
| Trigger | Vercel Cron 00:30 UTC (06:00 IST), or **Run now** | Staged, resumable run: ingest → extract → evaluate → window |
| Ingest | Code | RSS feeds from the `sources` table, funding pre-filter, dedupe by canonical URL and normalised title |
| Extract | Gemini Flash | Structured JSON per round, with a verbatim quote for every fact and the lead signals (PRD §7.2) |
| Verify | Code | Quote check, stage mapping, amount parsing, company dedupe, credibility gate, window |
| Score | Code + Gemini Flash | Hard rules in code first; Gemini rates soft criteria 0–5 with fact IDs; code computes the total and bucket |
| Draft | Gemini Flash + code | Email from checked facts only; code lints it and checks every claim against a fact |
| Review | Rohit | Approve → Gmail draft (with Undo), Skip with a reason, Rescue from Filtered out |

Code does the checking; Gemini does the reading and writing. Gemini Flash is the only model used.

## Setup

1. `npm install`
2. Create a Supabase project and run the SQL in `supabase/migrations/` (schema, then seed) in the SQL editor.
3. Copy `.env.example` to `.env.local` and fill in the values. Add the same variables in Vercel.
4. `npm run dev`

### Environment variables (names only)

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GMAIL_SENDER`, `CRON_SECRET`, `APP_PASSWORD`, `SESSION_SECRET`

## Commands

| Command | What |
|---|---|
| `npm run dev` | Local app |
| `npm test` | Unit tests, including the no-send guard |
| `npm run eval` | Golden-set evaluation (`eval/cases.json`) |
| `npm run build` | Production build |

## Screens

Sign-in · Today · **Pipeline** · Review · Filtered out · Thesis · Runs · Credits · Help (`?`) with the 6-step Quick tour.

**Pipeline** shows each run as a live, animated flow: Sources → Articles → Rounds → Checked → Scored → Drafted. Every stage lists the real items with a link to their source (feed, article, publisher), updating every 2.5 s while a run is in progress; any earlier run can be replayed. Below it, every startup ever seen with its status and window. Today shows a compact live strip while a run is in progress. A labelled Sample startup (`public/demo/sample.json`) is used by the tour only when there is no live Fit; it is never stored or drafted.

## Sources (global startup network)

20 feeds respond from Vercel (checked 12 Oct 2026). India: Entrackr, ET Tech, Inc42, YourStory, two Google News queries. Global: PR Newswire Venture Capital, TechCrunch Venture and Startups, Crunchbase News, Tech.eu, Sifted, EU-Startups, Silicon Canals, TechCabal, Disrupt Africa, Contxto, and Google News queries for the US, Europe and Asia. Google News items count only when the original publisher is on the Tier 1–2 allowlist. Switched off because they refuse Vercel (403/404): Moneycontrol, VCCircle, e27, FinSMEs, Tech in Asia, GlobeNewswire.

**Thesis v2 (active):** geography Global, with a code-scored *Home market: India* criterion (weight 10) as a small boost. v1 (India only) stays in `thesis_versions` for history; Thesis shows the diff and **Rescore all in window**.

## Imagery

Curated Unsplash photos (Unsplash License), served from `public/images` through `next/image` (AVIF/WebP, under 100 KB per hero). Photographers are credited on `/credits`.

## Safety

- Gmail scope `gmail.compose` only; the app calls `drafts.create`, `drafts.get` and `drafts.delete` (Undo). A test fails the build if any mail-delivery call appears in `src/`.
- Row level security is on for every table with no public policies; all access is server-side with the service-role key.
- Article and website text is wrapped as data; embedded instructions set `injection_suspected`.
- Contacts are only addresses published by the company. No pattern guessing, no email finders.
- robots.txt respected, identifying user agent, at most one request per second per domain.
