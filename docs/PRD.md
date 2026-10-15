# PRD: Funding Radar (Timed Funding Outreach Engine)

**Product:** Funding Radar. Morning outreach drafts for an accelerator's programme lead.
**User:** Rohit, programme recruitment lead at an early-stage accelerator.
**Owner:** Srish Kulkarni (MESA Cohort C4, AI and its Applications, Section 1 Final Examination, Hard level)
**Status:** **v2.0 · as built · 15 Oct 2026.** Supersedes v1.4 (12 Oct 2026, kept in git history).
**Live:** https://funding-radar-sand.vercel.app (password in the submission note) · **Repo:** https://github.com/Ksrish018/MESA_Accelerator_Leads

**Booklet rules (all met):**
- Live external data, working at submission.
- Gemini Flash for every AI step (`gemini-3.8-flash`). No Claude API.
- Deployed on Vercel.
- Thesis editable in Supabase with no code change.
- No duplicate outreach.
- Submit the public URL, GitHub repo and Components Map.

---

## 0. What changed since v1.4

| Area | v1.4 (plan) | v2.0 (as built) |
|---|---|---|
| Gmail | Draft created only when Rohit approves | **Every Fit gets a Gmail draft each morning**; Approve saves edits into it; Skip removes it; never a second draft |
| Geography | India only (thesis v1) | **Global** (thesis v2) with a code-scored *Home market: India* boost |
| Sources | 6–8 India-first feeds | **20 feeds**, India and global |
| Undisclosed stage | Always parked | **Scored with a flag** when the amount is inside the thesis range; still never inferred |
| Websites | Only URLs printed in text | Also **links in the article**, quote-checked; social and short links ignored |
| Pipeline screen | v1.1 | **Built**: animated live flow with sources at every stage, replay, startup table |
| Runs | Single chain of slices | **Self-healing** runs, public hand-off address, parallel batches, error logging |
| Access | Password gate | Password gate **plus a sign-in log** on Runs |
| UI | Premium static | Per-tab animated wallpapers, glass surfaces, tab transitions, one context line per screen |

---

## 1. Summary

Founders who have just raised pre-seed or seed money are most open to an accelerator in the first 30–60 days. Rohit catches only 60–70% of those announcements and spends about 20 minutes on each.

Funding Radar reads 20 free news and press-release feeds every morning at 06:00 IST. It finds new pre-seed and seed rounds, checks every fact against a verbatim quote from its source, merges coverage of the same round, and drops anyone already contacted or outside the window. It scores each startup against a thesis stored in Supabase and writes a personalised email for every Fit, which waits in Rohit's **Gmail Drafts** folder. Rohit reads, edits and presses Send himself. **The system never sends email.**

**Core rule: code checks, Gemini reads and writes.**

---

## 2. Problem, user and outcomes

| Loss today | Evidence | Cause |
|---|---|---|
| Coverage | Misses 30–40% of relevant announcements | Checks 3–4 sources by hand |
| Speed | About 20 minutes per startup | Research, fit and drafting done one by one |
| Memory | Bookmarks and a spreadsheet | Duplicate outreach and lapsed windows |

**User:** Rohit only. He reviews, edits, approves and sends, and he owns the thesis.

| Outcome | Target |
|---|---|
| Announcement to draft ready | Next morning (< 24 h) |
| Rohit's time per startup | About 2 minutes |
| Duplicate outreach | 0 |
| Facts in drafts traceable to a source | 100% |
| Contacts guessed | 0 (published or absent) |

**Human judgment points:** the thesis, approve/skip/rescue, and pressing Send.

---

## 3. Scope

**In scope (built):** daily cron and Run now · 20 live sources · Gemini extraction with quotes and lead signals · code verification, dedupe, window · thesis in Supabase with versions · hard rules and weighted scoring · website research · drafts with lint and claim checks · Gmail drafts (create, update, delete) · Today, Pipeline, Review, Filtered out, Thesis, Runs, Credits, Help with tour · password gate and sign-in log · health check · cost log · unit tests and golden set.

**Out of scope:** sending email · guessing or buying email addresses, email finders, LinkedIn scraping · paid databases (Crunchbase, Tracxn, Dealroom) · Series A and later rounds · CRM sync and reply tracking · multiple users and roles.

---

## 4. Business logic

### 4.1 The thesis (Supabase `thesis_versions`, active version v2)

A thesis is a **versioned row**. To change it, insert a new version and mark it active. Every score records the version it used. Nothing about the thesis is in code.

| Field | v2 value | Type of rule |
|---|---|---|
| Stages | Pre-seed, Seed | Hard rule |
| Geography | Global | Hard rule (v1 was India and 23 Indian cities) |
| Include sectors | B2B SaaS · applied and vertical AI · developer tools and AI infrastructure · B2B fintech infrastructure | Guides scoring |
| Exclude sectors | Consumer D2C brands · food and beverage · real estate · crypto tokens · gambling · lending NBFCs (each with keywords) | Hard rule (B2B software serving these industries is not excluded) |
| Round size | $100K – $3M | Scored in code |
| Disqualifiers | Acquired · shut down · debt-only · grant-only · not a startup | Hard rule |
| Criteria (weight) | Sector and business-model fit (30) · Programme need (20) · Evidence of progress (20) · Team, work evidence only (15) · Round size in range (15, code) · Home market: India (10, code) | Weighted score |
| Thresholds | Fit ≥ 70 · Worth a look ≥ 55 (out of 100) | Buckets |
| Window | 60 days · Closing from 10 days left | Timing |

**Why edited in Supabase, not in the app:** the brief requires it; the thesis decides who gets contacted, so it is configuration rather than a daily action; the app password is shared with graders, but only Rohit's Supabase access can change strategy; every change is a new version, so decisions stay auditable. The app shows the active thesis, history and a diff, and offers **Rescore all in window**.

### 4.2 Hard rules (code, in order; no AI call when one fails)

1. Already contacted (an `outreach` row exists).
2. Window closed (more than 60 days since the earliest credible publication).
3. Disqualifier present (with a verbatim quote).
4. Stage: **undisclosed** → scored with a *Stage undisclosed* flag if the stated amount is inside the thesis range, otherwise parked until a source states it (T3). A stated stage outside the thesis (pre-Series A, bridge, Series A and later) → filtered.
5. Excluded sector.
6. Geography (always passes under a Global thesis).
7. At least one Tier 1 or Tier 2 source.

### 4.3 How the thesis is scored

Only startups that pass every hard rule (§4.2) are scored. Each criterion gets a score from **0 to 5**; code turns those into one total **out of 100**.

**Criteria, weights and who scores them (thesis v2)**

| # | Criterion | Weight | Share of total | Scored by | What earns a high score | What scores 0 |
|---|---|---|---|---|---|---|
| 1 | Sector and business-model fit | 30 | 27% | Gemini, with evidence | Builds B2B SaaS, applied or vertical AI, developer tools or AI infrastructure, or B2B fintech infrastructure; businesses or developers pay | Consumer product, or nothing in the sources says what they build |
| 2 | Programme need | 20 | 18% | Gemini, with evidence | Stated use of funds matches what the programme offers (hiring, go-to-market, product, expansion); first institutional round; not already in an accelerator | No use of funds stated |
| 3 | Evidence of progress | 20 | 18% | Gemini, with evidence | Live product, named customers, pilots or partners, revenue or user numbers, a recent launch | No evidence in the sources (never invented) |
| 4 | Team, from work evidence | 15 | 14% | Gemini, with evidence | Technical or engineering background, a prior startup, stated domain experience | No work evidence. College, age, gender, religion, caste, family and photos are never considered |
| 5 | Round size in range | 15 | 14% | **Code** | 5 = amount inside $100K–$3M · 2 = undisclosed, or within 2× of the range | 0 = far outside the range |
| 6 | Home market: India | 10 | 9% | **Code** | 5 = stated location is in India · 2 = location unknown | 0 = stated location is elsewhere |
| | **Total weight** | **110** | 100% | | | |

**Formula (code, `computeTotal`)**

> Total = ( Σ over criteria of (score ÷ 5) × weight ) ÷ ( Σ of weights ) × 100, rounded.

Because the total is divided by the sum of weights, Rohit can add, remove or reweight criteria in Supabase and the total stays on a 0–100 scale.

**Buckets**

| Total | Bucket | What happens |
|---|---|---|
| **70–100** | Fit | Draft written and checked; placed in Rohit's Gmail Drafts; shown on Today |
| **55–69** | Worth a look | Top of Filtered out, with Rescue |
| **0–54** | Not a fit | Filtered out, with the score as the reason |

**Worked example: CurvetAI (live, thesis v2)**

| Criterion | Score | Weight | Points = score ÷ 5 × weight | Evidence quote (verified) |
|---|---|---|---|---|
| Sector and business-model fit | 4/5 | 30 | 24.0 | "…CurvetAI operates an AI workspace…" |
| Programme need | 3/5 | 20 | 12.0 | "The fresh capital will be used to expand CurvetAI's engineering…" |
| Evidence of progress | 4/5 | 20 | 16.0 | "more than 1 lakh monthly users globally" |
| Team, from work evidence | 4/5 | 15 | 12.0 | "Founded in December 2025 by Vivek Dubey and Utkarsh Gupta…" |
| Round size in range | 5/5 | 15 | 15.0 | "…has raised Rs 6 crore in a pre-seed round…" (≈ $682K) |
| Home market: India | 5/5 | 10 | 10.0 | "Pune-based AI startup CurvetAI…" |
| | | **110** | **89.0** | |

89 ÷ 110 × 100 = **81 → Fit**.

**Guardrails on Gemini's scores (code)**

- Gemini scores only the four AI criteria, using numbered facts that have already passed the quote check, and must return the fact IDs it relied on.
- A score above 0 with no valid fact ID is set to **0**: no evidence, no score.
- Scores are clamped to whole numbers from 0 to 5.
- The quote shown to Rohit is the verified quote of a cited fact, never Gemini's own wording.
- Code, not Gemini, scores round size and home market, adds up the total and picks the bucket.
- Every score row records the **thesis version** that produced it (Older thesis → Rescore).

**Signals that affect order, not score:** warm path (an investor on Rohit's network list), confidence (source count, Tier 1 present, quotes verified) and *Closing* decide the order on Today (§4.6). They never change the fit score.

### 4.4 Lead signals (extracted with quotes; `null` without one)

| Group | Signals |
|---|---|
| A · Trigger | New round, date, size, first institutional round |
| B · Fit | Business model (B2B/B2C/B2B2C), customer type, sector words, location |
| C · Programme need | Use of funds, accelerator mention (a flag, not a disqualifier) |
| D · Progress | Named customers, pilots, partners, revenue, users, launches |
| E · Team | Work evidence only; never college, age, gender, religion, caste, family or photos |
| F · Warm path | Investor on `settings.network_investors`, founder named, contact published (code) |
| G · Signal quality | Source count, Tier 1 present, quotes verified, amounts consistent (code) |

### 4.5 Triggers

| # | Trigger | Behaviour |
|---|---|---|
| T1 | New pre-seed or seed round | New lead → rules → research → score → draft if Fit |
| T2 | More coverage of a known round | Source added, confidence raised, missing facts filled; no new draft |
| T3 | Missing fact resolved (stage, website, credible source) | Lead re-evaluated |
| T4 | Window milestones | *Closing* from day 50; *Closed* after day 60 |
| T5 | Thesis changed | *Older thesis* flag, Rescore per lead, Rescore all in window |
| T7 | Rohit decides | Approve, Skip (with reason), Rescue, Undo, Reopen; counted on Runs |

### 4.6 Priority on Today

Closing first (fewest days left) → highest score → warm path → confidence → newer announcement. Deterministic.

### 4.7 Outreach rules

- **Gmail drafts each morning:** every Fit gets exactly one Gmail draft (`users.drafts.create`). Approve saves Rohit's edits into it (`users.drafts.update`); Skip deletes it; Regenerate replaces its content.
- **No duplicates:** one `outreach` row per company. Each run checks every Fit's draft (`users.drafts.get`); if it has left Drafts (sent or deleted), the company is recorded as contacted (*Left Drafts · Sent?*).
- **Contacts:** only addresses the company publishes on its own site or in a press release; founder-named first, then general inboxes. Never guessed. Missing → *Find contact*.
- **Greeting:** founder's first name if a source names them; otherwise "Hi [Company] team".
- `AUTO_GMAIL_DRAFTS=false` restores approve-only behaviour.

---

## 5. Tech logic

### 5.1 Stack

| Layer | Choice | Why |
|---|---|---|
| App | Next.js 15 (App Router, TypeScript) on Vercel Hobby | Booklet requirement; server code and UI together |
| Database | Supabase Postgres, RLS on every table, no public policies | Booklet requirement; constraints (one outreach per company), locking, a table editor for the thesis |
| AI | Gemini Flash REST, `responseSchema`, low thinking | Booklet requirement; structured, validated output |
| Email | Gmail API, scope `gmail.compose`, Internal OAuth | Drafts in Rohit's own mailbox; narrowest scope that can create drafts |
| Data | RSS feeds | Free, official, structured, fresh |

### 5.2 Pipeline (staged and resumable)

| Step | What happens |
|---|---|
| **Ingest** | Fetch enabled feeds; keep items since the last completed run minus 12 h; code pre-filter for funding terms; Google News items count only if the original publisher is Tier 1–2; dedupe by canonical URL and normalised title |
| **Extract** | 8 articles in parallel. Text = feed content, else the page if robots.txt allows, plus **Links in article**. Gemini returns rounds with quotes (schema-validated). Code: quote check, stage map (table in Supabase), amount parse (₹ Cr/lakh, $ M/K, € £ S$), company match (domain, then normalised name, fuzzy ≥ 0.9), credibility, window. Social and short links are never a website. |
| **Evaluate** | 3 startups in parallel: hard rules → website research (home + up to 2 pages, robots.txt, 1 request/s per domain) → score → draft → lint and claim check (regenerate once) → Gmail draft |
| **Finish** | T4/T5 updates; create missing Gmail drafts; record drafts that left Gmail Drafts |

**Slices:** the browser's Run now advances a run in 40-second slices. The cron runs 150-second background slices, each handing off to the next through the **public production address** (`VERCEL_PROJECT_PRODUCTION_URL`), with retries and up to 60 slices. A database lock (`claim_run`) outlasts the slowest slice, so two slices never overlap. Work items are claimed with `FOR UPDATE SKIP LOCKED`, so nothing is processed twice.

**Self-healing:** if a run is in progress but no slice holds its lock, the next poll of `/api/run/status` or `/api/pipeline` (Today and Pipeline poll these) restarts it. Only the slice that did work hands off, so a revival never starts a second chain. The 06:00 cron also resumes any unfinished run.

### 5.3 Gemini contract

- `responseMimeType: application/json` plus `responseSchema`; every response validated; one corrective retry with the error appended.
- Timeouts: extraction 90 s (long roundups), others 30 s. A timeout is retried once; 429/5xx up to three times with backoff.
- Source text is wrapped as data; embedded instructions set `injection_suspected`.
- Every call logged to `llm_calls` with tokens and estimated cost.
- **Extraction:** company, website, stage text, amount, date, `is_new_round`, first institutional, investors, lead, founders (work background only), location, sector words, business model, customer type, use of funds, traction, accelerator mention, negative events, `quotes{}`.
- **Scoring:** per criterion `{key, score_0_5, evidence_fact_ids[], evidence_quote}`.
- **Draft:** `{subject, body, greeting_name, claims[{text, fact_id}]}`. Subject < 60 characters; body 90–140 words; one sourced line, one fit line, one ask.

### 5.4 Verification

- **Quote check:** normalised (case, whitespace, quotes, dashes); "..." checked part by part, in order. A missing quote drops the fact and flags *Unverified facts dropped*.
- **Claim check:** every claim must map to a fact; every number in the email must appear in a fact or the settings.
- **Draft lint:** banned phrases ("I hope this email finds you well", "I came across", "exciting", "leverage", "seamless" and others), em dash, emoji, "!", word count, subject length.

### 5.5 Data model (Supabase)

`sources` · `publishers` (allowlist and tiers) · `articles` · `startups` · `rounds` (one per article × startup, with quotes) · `signals` · `triggers` · `research` · `thesis_versions` · `stage_map` · `scores` (with `thesis_version`) · `drafts` (with `gmail_draft_id`) · `outreach` (primary key `startup_id`) · `settings` · `runs` · `llm_calls` · `decisions` (actions and sign-in log). Claim functions: `claim_articles`, `claim_startups`, `claim_run`.

### 5.6 Access and security

- **Password gate:** `APP_PASSWORD` → HMAC-signed, HTTP-only, secure cookie for 30 days; checked in middleware on every page and API. **Why:** the app acts on a real Gmail account, controls the no-duplicate record, and costs money per run.
- `/api/cron`, `/api/run/*` and `/api/sources/check` also accept `CRON_SECRET`. `/api/health` is public and returns yes/no only.
- **Sign-in log:** time, browser and device, approximate city and country; failed attempts too. No IP or personal data. Shown on Runs.
- Supabase: RLS on, no public policies; service-role key only in server-only modules.
- Secrets only in `.env.local` and Vercel environment variables.
- A test fails the build if any mail-delivery call or non-Gemini LLM API appears in `src/`.

---

## 6. Sources (checked from Vercel, 12–15 Oct 2026)

| Region | Feeds | Tier |
|---|---|---|
| India | Entrackr, ET Tech, Inc42, YourStory | 2 |
| India (discovery) | Google News: "pre-seed or seed", "startup raises seed India" | 3 (publisher must be Tier 1–2) |
| Global primary | PR Newswire · Venture capital | 1 |
| US | TechCrunch Venture, TechCrunch Startups, Crunchbase News | 2 |
| Europe | Tech.eu, Sifted, EU-Startups, Silicon Canals | 2 |
| Africa | TechCabal, Disrupt Africa | 2 |
| Latin America | Contxto | 2 |
| Global (discovery) | Google News: global, Europe, Asia | 3 |

Switched off (refuse Vercel): Moneycontrol (403), VCCircle (404), e27, FinSMEs, Tech in Asia, GlobeNewswire (403). Sources live in the `sources` table and can be added or switched off without code.

**Respect publishers:** RSS first; full pages only where robots.txt allows; identifying user agent; at most one request per second per domain.

---

## 7. Product and UX

**Screens:**
- **Sign-in:** "Welcome, Rohit", product name, password.
- **Today:** KPIs and Fit cards in priority order; a live strip during a run.
- **Pipeline:** animated flow ribbon Sources → Articles → Rounds → Checked → Scored → Drafted, each stage listing items with source links; replay any run; Flow / Startups switch.
- **Review:** facts and signals with quotes and links, criterion · score · quote, contact; editable draft (autosave); Approve → Gmail draft (Undo 10 s), Skip with one-tap reasons, Regenerate, Rescore, Not seed / wrong company.
- **Filtered out:** Worth a look first, then reasons; Rescue and Rescore.
- **Thesis:** active version, criteria, diff, history, link to Supabase, Rescore all in window.
- **Runs:** funnel, cost per run and per draft, model, sources, decisions, sign-ins, history.
- **Credits** and **Help (?):** tour, what we check, fit criteria (live), sources (live), chip guide, where things live.

**Design:** Apple-style restraint; per-tab animated wallpapers with glass surfaces; curated Unsplash heroes (under 100 KB served); tab transitions (gliding highlight, hero and title morph) with fallback; light and dark; mobile with a bottom bar; everything respects reduced motion.

**Copy rules:** data and actions only; one context line per screen (≤ 15 words, what Rohit does there); titles are nouns, buttons are verbs; every number has a unit and time; every fact links to its source; the only long AI text is the draft.

**First run:** "Quick tour · 6 steps · about 1 minute" with Start and Skip; spotlight coach marks; replay from Help; a labelled Sample startup when there is no live Fit.

---

## 8. Evaluation and tests

- **120 unit tests:** stage mapping, amount parsing, name normalisation and fuzzy match, window maths, buckets, quote check, claim check, draft lint, hard rules (including undisclosed stage and global thesis), contacts, robots.txt, article links, session cookie, sign-in log, and the **no-send guard**.
- **Golden set:** 15 cases in `eval/cases.json`, run with `npm run eval`: **15/15 pass**, extraction precision 1.0, recall 1.0, stage accuracy 1.0. Traps: Series A mentioning an earlier seed, pre-Series A, weekly roundup, three outlets on one round, ₹ vs $ conflict, already contacted, prompt injection, use of funds with quote, debt-only round, banned-phrase draft, acquisition, fund launch.
- **Live (15 Oct):** 106 articles read, 97 startups checked, 5 new Fits; 8 Fits in Gmail Drafts; about $0.06 per run.

---

## 9. Operations and incidents

- **Cron:** `30 0 * * *` (06:00 IST). **Health:** `/api/health`. **Runs** page shows errors per run.
- **Incident, 14–15 Oct 2026:** the 06:00 run stalled after its first slice. *Cause:* the slice hand-off called the deployment URL that Vercel Cron uses, which is behind deployment protection, so it was refused silently. Testing had triggered the cron through the public address, so the test passed. A second cause slowed runs: weekly roundups took more than 30 s in Gemini and were retried four times. *Fix:* hand-off through the public production address with retries and error logging; self-healing revival on the next poll; single-chain guard; 90 s extraction timeout and one retry on timeout; 8 articles and 3 startups in parallel. *Impact:* no data lost or duplicated, nothing sent; the stuck run resumed where it stopped and completed. *Lesson:* test the real trigger path, not an equivalent one.

---

## 10. Known limits and next steps

**Limits:** RSS shows only recent items, and some publishers block automated readers; many funding articles don't link or publish a founder email, so some drafts need *Find contact*; Vercel Hobby keeps request logs for about an hour.

**Next:**
1. In-app thesis editor that only creates a new version, validates weights and thresholds, previews the impact, and is owner-only.
2. Recall check against Entrackr's weekly report.
3. T6: bad news on an open lead (Series A, acquisition, shutdown) holds its draft.
4. Reply tracking.
5. Retention purge of contact fields after 180 days.

---

## Appendix. Environment variables (names only)

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GMAIL_SENDER`, `CRON_SECRET`, `APP_PASSWORD`, `SESSION_SECRET`, optional `AUTO_GMAIL_DRAFTS`.
