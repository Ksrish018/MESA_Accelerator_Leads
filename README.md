# Funding Radar

Morning outreach drafts for an accelerator's programme lead. Every morning it reads free news and press-release feeds, finds new pre-seed and seed rounds, checks every fact against its source, drops anyone already contacted or outside the 60-day window, scores each startup against a thesis stored in Supabase, and prepares a sourced fact sheet plus a draft email. The programme lead reviews, edits and approves; Approve puts the email in Gmail Drafts. **The system never sends email.**

- Spec: [`docs/PRD.md`](docs/PRD.md) · Components Map: [`docs/components-map.png`](docs/components-map.png)
- Live URL: _added after first deploy_

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

## Safety

- Gmail scope `gmail.compose` only; the app calls `drafts.create`, `drafts.get` and `drafts.delete` (Undo). A test fails the build if any mail-delivery call appears in `src/`.
- Row level security is on for every table with no public policies; all access is server-side with the service-role key.
- Article and website text is wrapped as data; embedded instructions set `injection_suspected`.
- Contacts are only addresses published by the company. No pattern guessing, no email finders.
- robots.txt respected, identifying user agent, at most one request per second per domain.
