# PRD: Timed Funding Outreach Engine

**Product:** Funding Radar. Morning outreach drafts for an accelerator's programme lead.
**User:** Rohit, who leads programme recruitment at an early-stage accelerator.
**Owner:** Srish Kulkarni (MESA Cohort C4, AI and its Applications, Section 1 Final Examination)
**Status:** v1.4 · 12 Oct 2026 (final pre-build version: adds the first-run demo, help and UX details) · **Deadline: 13 Oct 2026, live on Vercel.** Gmail drafts are created on Approve.
**Hard rules from the booklet:**
- Live external data, working with real data at submission.
- **Gemini Flash for every AI task. No Claude API.**
- Deploy on **Vercel**.
- Submit the public URL, the GitHub repo and the Components Map.
- No duplicate outreach.
- Thesis editable in **Supabase** with no code change.

---

## 0. One-day delivery plan (13 Oct 2026)

The deadline is tomorrow, so v1 ships the **must-have core**, built to a high standard. Everything below the line waits.

**Ships tomorrow (must-have)**
- Daily cron plus Run now.
- Live sources: Entrackr, PR Newswire, Google News (trusted publishers only), YourStory, Inc42 and TechCrunch, keeping whichever respond from Vercel.
- Gemini extraction with quotes, including the **lead signals** in §7.2, then code checks: quote check, stage mapping, dedupe, 60-day window.
- **Lead triggers T1–T5 and T7** (§7.3): new round, new coverage, a resolved missing fact, window milestones, a thesis change, and Rohit's decisions.
- Thesis loaded from Supabase, hard rules in code, Gemini criterion scores with code totals.
- Light research: the startup's home page title and description, plus any published email address.
- Drafts with a claim-to-fact check.
- Screens: **Today**, **Review**, **Filtered out** (with Rescue), **Thesis** (read-only plus version) and **Runs** (funnel and cost).
- **Approve → Gmail draft**, with a Copy / Open in Gmail fallback.
- Outreach record, so no company is ever drafted twice.
- Password gate, health check, LLM cost log.
- **Premium front end with curated imagery** (§10). It is part of the must-have, not polish.
- **First-run demo** (§10.5): a short guided tour on real screens, a labelled sample startup for empty days, and Help with a replay option.
- **Smooth review flow** (§10.6): auto-advance, Undo on Approve, one-tap skip reasons, skeleton loading, a live Run now progress view.
- Unit tests for the deterministic rules, the no-send guard, and a 15-case golden set run.

**Waits for v1.1 (cut order if time runs out, first to go first)**
1. Pipeline board view
2. Keyboard shortcuts and the shortcut sheet in Help
3. "Left Drafts · Sent?" sync
4. Rescore all
5. Backfill beyond what the feeds hold
6. Retention purge job
7. In-app thesis editor
8. Full 40-case eval

**Never cut:** live data, the Gemini-only rule, the Supabase thesis, dedupe, the human Approve gate, no sending, and the premium look.

**Decided defaults** (change any time in Supabase `settings`):
- The accelerator name is the neutral placeholder **"Your Accelerator"**, signed **"Rohit, Programme Lead"**.
- **Grader access:** the site opens on a clean sign-in page. The password goes in the submission note. How the system works is explained in the README and the submission note, **never on the website** (§10.4).

**Timeline**
| When | What |
|---|---|
| **Tonight, about 45 min** | Accounts and keys (Appendix B). Create the repo and put `docs/PRD.md`, `docs/components-map.png` and `CLAUDE.md` in it |
| **Tonight, Claude Code session 1** | M0 + M1 + M2: project, schema, sources check from Vercel, ingest → extract → verify → dedupe on live data. **Deploy and push** |
| **Tomorrow morning, session 2** | M3 + M5: scoring, research, drafts, Gmail drafts. **Deploy and push** |
| **Tomorrow midday, session 3** | M4: front end at full quality with imagery, the first-run demo, Help, and the §10.6 interaction details. Mobile check. **Deploy and push** |
| **Tomorrow afternoon** | M6: cron, golden-set run, README, final checklist (§16) **on the live URL**, then submit |

---

## 1. Summary

Rohit's job is about timing. Founders who have just raised a pre-seed or seed round are most open to an accelerator in the first 30–60 days. Today he catches only 60–70% of those announcements, and each one costs him about 20 minutes of research and writing.

Funding Radar reads free, credible news and press-release feeds every morning. It works out which announcements are new pre-seed or seed rounds, checks each fact against its source, and drops anything already contacted or outside the window. It then scores each startup against the accelerator's thesis, which lives in Supabase. It reads the signals that matter to a lead generator: why now, why this startup, and how to reach them (§7). For every fit, it prepares a sourced fact sheet and a personalised draft email.

Rohit reads, edits and approves. Approving puts the email into his **Gmail Drafts folder**, and he presses Send himself. **The system never sends anything.**

**Core rule: code does the checking, Gemini does the reading and writing.**
- Code: stage and window rules, hard exclusions, fact verification, dedupe, the score total and the threshold.
- Gemini: extracting facts from articles, rating fit against each criterion with a reason, and writing the draft.

---

## 2. Automation Brief

### Pain
| Loss | Evidence | Cause |
|---|---|---|
| **Coverage** | He misses at least 30–40% of relevant announcements | He checks 3–4 sources by hand. His attention decides when he looks and his habits decide where |
| **Speed** | About 20 minutes per startup to research, assess fit and draft | Every startup goes through the same slow steps one after another |
| **Memory** | Bookmarks plus a spreadsheet | No single record per company, so duplicate outreach and lapsed windows are likely |

### User
**Rohit, and only Rohit.** He reads, edits, approves and sends. He also owns the accelerator thesis and changes it when the accelerator's focus shifts.

### Outcome (measurable)
| Metric | Today | Target |
|---|---|---|
| Relevant announcements captured | about 60–70% | **≥ 90%**, measured against a reference list (§12) |
| Public announcement → draft ready | days to weeks | **next morning (< 24 h)** |
| Rohit's time per startup | about 20 min | **about 2 min** to read and approve |
| Duplicate outreach | not tracked | **0** |
| Drafts approved with light or no edits | n/a | **≥ 70%** |
| Facts in drafts traceable to a source | n/a | **100%** |
| Drafts with a published recipient | n/a | measured and reported, no target. A contact is never guessed |

### Journey today
1. A startup announces a pre-seed or seed round, and some outlet covers it.
2. Rohit sees it only if he checks that outlet that day.
3. He bookmarks it and logs it in a spreadsheet.
4. Later he researches the company, judges fit and writes an email. This takes about 20 minutes.
5. He sends it. Whether anyone already contacted them lives in the spreadsheet and his memory.

### Journey after
1. At about 6 am IST the system reads the last 24 hours of funding news from several free sources.
2. Gemini pulls the facts out of each article. Code checks every fact against the article text, merges duplicate coverage and skips anyone already contacted.
3. Survivors are researched on their own website, scored against the current thesis, and drafted.
4. Rohit opens **Today**, a ranked queue of fits. Each shows its sources, fit reasons and days left in the window.
5. He edits if needed and taps **Approve**. The email appears in his Gmail Drafts, and he sends it from Gmail.
6. Startups that were turned away sit in **Filtered out** with a reason. One click rescues any of them.

---

## 3. Nine Checks and the Cut

| # | Check | Evidence | Result |
|---|---|---|---|
| **Kill switches** | | | |
| 01 | Problem real | He misses 30–40% of announcements and spends 20 min per startup. Well-timed outreach converts far better than a cold email six months later | **YES** |
| 02 | Workflow repeated | Announcements arrive daily. Entrackr alone published 5 pre-seed or seed rounds between 7 and 10 Oct 2026 (Zinara, TailBlaze, The Dough Therapy, Credfix, Desible.ai) | **YES** |
| 03 | Input available | Announcement facts come from free public feeds, checked live on 12 Oct 2026. The thesis is Rohit's. **Founder emails are not in the news**, and paid databases are out of scope | **YES** for announcements and thesis · **NO** for founder emails |
| **Sizing** | | | |
| 04 | Output valuable | A sourced fact sheet plus a draft replaces about 20 minutes of work, but only if every fact is right | **YES** |
| 05 | Impact measurable | Recall against a reference list, time to draft, duplicates, approval rate, traceability | **YES** |
| 08 | ROI worth it | Free sources and free tiers. Gemini Flash costs about ₹14 a day (§9). One strong cohort company is worth far more | **YES** |
| **Boundary** | | | |
| 06 | Failure risk OK | **YES** for drafts, since Rohit reviews every one. **NO** for silent filtering: a wrong "not a fit" is invisible and permanent once the window closes. **NO** for auto-send: a wrong fact or a duplicate email damages the accelerator's name with founders | **YES** for drafting · **NO** for silent filtering and auto-send |
| 07 | Judgment protected | Rohit approves and sends every email himself | **YES** |
| 09 | Owner clear | Rohit owns sends and the thesis. **Nobody owns a rejection made by the system**, the same failure as Arjun's auto-reject | **YES** for sends · **NO** for system rejections |

### The Cut
**"If a startup does not fit, he should never see it" is cut back by checks 06 and 09.**

> *To Rohit:* "You'll never read a non-fit in your morning queue, but every startup the system turned away is one click away with its reason, so you can catch a wrong 'no' while the window is still open."

**A second, smaller cut from check 03:** when no contact is published, the draft lands with the recipient empty and a **Find contact** flag. An address is never guessed or bought.

**What gets automated:** finding announcements, extracting and checking facts, dedupe, window tracking, fit scoring, research, drafting, and creating the Gmail draft.

**What stays human:** the thesis, the final approve or skip, sending, and rescuing anything wrongly filtered.

---

## 4. Scope

**In scope (v1)**
- Daily pipeline, plus a manual **Run now** button.
- India-first sources plus global primary press releases (§6).
- Configurable thesis in Supabase.
- Dedupe by company.
- Window tracking.
- Research from the startup's own website.
- Fit scoring with reasons.
- Drafts.
- Review app.
- Gmail Drafts on Approve.
- Filtered-out view with rescue.
- Run log and cost log.
- Premium front end (§10).

**Non-goals (v1)**
- **Sending any email, ever.** There is no send code path (enforced by a test, §11).
- Guessing or buying email addresses (no Hunter or similar), and scraping LinkedIn.
- Paid databases (Crunchbase, Tracxn, Dealroom).
- Rounds after seed (Series A and beyond), except where the thesis says otherwise.
- Follow-up sequences, CRM sync, reply tracking beyond a manual "Replied" tag.
- Multiple users or roles.

---

## 5. Functional requirements

P0 = must ship. P1 = ship if time allows.

### 5.1 Run (Trigger)
- **P0** A Vercel Cron job runs once a day at 00:30 UTC (06:00 IST). Hobby cron fires anywhere within the hour, which is acceptable.
- **P0** A **Run now** button on the Runs page and in the Today header runs the same pipeline.
- **P0** The pipeline is **staged and resumable**. Each step claims a batch, does about 30–60 s of work and records progress, so no request gets near the 300 s Hobby limit. A run that dies mid-way is picked up by the next call. This is the same lock-and-claim pattern as Hireup.
- **P0** Every run is idempotent. Running twice never creates a second draft or a second record for the same company.
- **P0** Each run fetches items published since the last successful run, with a 12-hour overlap so nothing falls between runs.
- **P1** The first run backfills as far back as the sources allow, so a new install starts with real data.

### 5.2 Ingest (Input)
- **P0** Fetch every enabled source in `sources` (§6). Keep only title, link, publisher, publication date and summary or snippet. Full article text is fetched only where the publisher allows it (robots.txt), with a polite rate limit and an identifying user agent.
- **P0** Pre-filter in code before any AI call. Keep items whose title or summary mentions funding terms (raises, raised, funding, round, seed, pre-seed, angel, backed, led by, ₹/$/Cr/Mn). This cuts AI calls and cost.
- **P0** Dedupe raw items by canonical URL and normalised title.

### 5.3 Extract (AI step 1: Gemini)
- **P0** For each candidate article, Gemini returns structured JSON (§8). For each round announced *in this article*, it returns:
  - the round: company, stage label as written, amount and currency as written, announcement date, investors, founders, company website if mentioned, sector words, location
  - the **lead signals** in §7.2: business model, customer type, use of funds, traction, first institutional round, accelerator mention, negative events
  - a **verbatim quote** supporting each fact. A signal with no quote is `null`, never inferred.
- **P0** Multi-company articles, such as weekly roundups, return one entry per company.
- **P0** Earlier rounds mentioned in passing are tagged `historical`. For example, a Series A story that mentions a past seed round. They are never treated as new.
- **P0** Article text is **data, not instructions**. Text inside an article that tries to instruct the model is ignored and flagged.

### 5.4 Verify, normalise, dedupe (Processing: code)
- **P0 Quote check:** every extracted fact must have its quote found in the source text (normalised whitespace and case). A fact whose quote is missing is dropped and the entry is flagged. This is the same pattern as Hireup's quote verification.
- **P0 Stage normalisation:** map "pre-seed", "seed", "seed extension", "seed-plus" and "angel" to `pre_seed` or `seed`. Map "pre-Series A", "bridge" and "Series A+" to `other`. "Undisclosed" becomes `unknown` and is flagged. The mapping table lives in Supabase.
- **P0 Amount normalisation:** keep the original text (₹5.25 Cr, $1.3 Mn) and add a USD estimate using a stored rate. If two credible sources disagree, show both and flag **Conflicting amounts**. Never average.
- **P0 Company identity:**
  - Normalise the name: lower case, strip "Pvt Ltd", "Inc", ".ai", punctuation.
  - Match on website domain when known, else the normalised name plus fuzzy match ≥ 0.9.
  - Several outlets covering one round become **one startup with several sources**.
- **P0 Credibility:** a startup moves forward only if at least one source is Tier 1 or Tier 2 (§6). Single-source items are allowed but flagged **One source**.
- **P0 Window:**
  - `announced_at` is the earliest credible publication date.
  - The window is days 0–60, with 0–30 being the best part.
  - Anything past day 60 is skipped with the reason **Window closed**.
- **P0 Already contacted:** any company with an outreach record (drafted, sent, replied, or skipped by Rohit) is skipped with the reason **Already contacted** and never drafted again. Only Rohit can reopen it.

### 5.5 Research (Context: the startup's own website)
- **P0** For survivors with a known website, fetch the home page and up to two of /about, /team and /contact, if robots.txt allows. Extract the page title, meta description, visible text (capped) and any `mailto:` addresses or emails printed on the page.
- **P0** If no website is known, the system does not search for one. The startup stays flagged **No website found** and Rohit can add one from the review screen.
- **P0 Contact rule:** only addresses published by the company or in a press release (for example a media contact). Founder-named addresses come first, then general inboxes (founders@, hello@, contact@). **Pattern guessing is forbidden.**

### 5.6 Score fit (AI step 2: Gemini + code)
- **P0** Load the **active thesis version** from Supabase at run time (§7). Nothing about the thesis is hard-coded.
- **P0 Hard rules in code first:** stage, geography, excluded sectors, window, and the disqualifiers in §7.2. Failing any of these sends the startup to Filtered out with that rule as the reason. No AI call is made.
- **P0** Gemini rates each **soft criterion** in §7.1 from 0 to 5 and names the fact it relies on, with the verbatim evidence. The app shows the criterion, the score and the evidence quote. It does not show AI prose (§10.4).
- **P0** Signal quality and the warm path (§7.2, groups F and G) are computed in code. They set the confidence chip and the priority (§7.4); they do not change the fit score.
- **P0** Code computes the weighted score (0–100) and assigns a bucket:
  - **Fit** (≥ `fit_threshold`, default 70) → Today queue.
  - **Worth a look** (≥ `review_threshold`, default 55) → top of Filtered out.
  - **Not a fit** → Filtered out.
- **P0** Each score stores the `thesis_version` that produced it. When Rohit changes the thesis, future runs use the new version. Startups still in the window show **Scored on an older thesis · Rescore**.
- **P1** The **Rescore all in window** button re-scores every in-window startup on the new thesis.

### 5.7 Draft (AI step 3: Gemini)
- **P0** For each Fit, write a plain-text email using **only checked facts** (round, investors, what they build from their site) and the accelerator details from `settings`.
- **P0 Shape:**
  - Subject under 60 characters.
  - Body of 90–140 words.
  - One specific, sourced line about them.
  - One line on why this programme fits them, drawn from the fit reasons.
  - One clear ask: the application link or a 20-minute call.
  - Rohit's signature.
  - No flattery clichés, no invented numbers or customers, no exclamation marks.
- **P0 Personalisation hook,** in this order of preference:
  1. their stated use of funds
  2. a named customer, pilot or launch
  3. what they build, in their own words
  4. the round itself
- **P0 Draft lint (code).** The draft is checked against a banned list of phrases that read as machine-written:
  - "I hope this email finds you well", "I came across", "I wanted to reach out"
  - "exciting", "thrilled", "game-changer", "revolutionise", "cutting-edge", "leverage", "synergy", "delve", "innovative solution", "in today's fast-paced", "unlock", "empower", "seamless"
  - the em dash, emojis and `!`
  - It also checks word count. A failed draft is regenerated once with the errors attached. If it fails again, the problems are listed on the Review page.
- **P0** Gemini returns `claims[]`, mapping each specific claim to a fact ID. Code rejects any draft with a claim that has no fact behind it, and regenerates once with the error.
- **P0** The greeting uses the founder's first name only if a founder is named in a source. Otherwise it uses "Hi [Company] team".
- **No AI-written summaries on screen.** The Review page shows structured facts and verbatim quotes (§10.4). The draft email is the only long AI-written text in the product.

### 5.8 Review (Output: the app)
- **P0 Today:** ranked Fit cards for startups not yet decided. Each card shows:
  - name, what they do (their own words, quoted), stage and amount
  - day N of 60, with a **Closing** chip from day 50
  - fit score, plus the two strongest criteria with their evidence
  - signal chips: first institutional round, named customers, warm path
  - a confidence chip ("3 sources · verified" or "1 source") and any flags
- **P0 Review screen:**
  - Left: the facts. Round details with clickable sources, signals with their quotes, each criterion's score with its evidence, flags, and the contact found (or Find contact).
  - Right: an editable subject and body, with a recipient field.
  - Actions:
    - **Approve → Gmail draft**
    - **Skip**, with a reason
    - **Regenerate**
    - **Not seed / wrong company**, which marks the extraction as wrong and feeds the eval set
- **P0 Filtered out:** every startup turned away, with its reason (hard rule, low score, window closed, already contacted, one weak source). "Worth a look" sits on top. **Rescue** moves a startup to Today and records Rohit's override.
- **P0 Pipeline:** every startup ever seen, with status (New, Drafted, Sent, Replied, Skipped, Filtered), window countdown and history.
- **P0 Thesis:** a read-only view of the active thesis, its version history, a diff from the previous version, and a link to the Supabase table. **P1:** an in-app editor that writes a new version row to Supabase.
- **P0 Runs:** last run time, items per source, funnel counts (fetched → candidates → rounds → new startups → fits), errors, tokens and estimated cost.
- **P0 Keyboard:** `J`/`K` next and previous, `A` approve, `S` skip, `E` edit.

### 5.9 Gmail drafts (Output: Gmail)
- **P0** On Approve, call Gmail `users.drafts.create` with the edited subject, body and recipient, if one exists. If the recipient is empty, the draft is still created and the app flags it **Add recipient in Gmail**.
- **P0** Store the `draft_id`. The startup becomes **Drafted**, and that counts as contacted for dedupe.
- **P0** Each run checks every drafted item's `draft_id` with `users.drafts.get`. If the draft is gone, it shows **Left Drafts · Sent?** with one-tap **Sent** or **Deleted**. (With this scope we can't read the Sent folder.)
- **P0** OAuth uses an **Internal** consent screen on the MESA Workspace, as in the Case 4 pre-read. Scope: `https://www.googleapis.com/auth/gmail.compose` only. It is the narrowest scope that can create drafts. Google classes it as *restricted*, and it technically allows sending. **The app never calls any send method, and a test enforces this (§11).**
- **P0** If Gmail is unavailable or not yet authorised, Approve falls back to **Copy** and **Open in Gmail** (prefilled compose link). The flow never blocks.

### 5.10 Logs and settings
- **P0** Every LLM call logs: run, step, model, input and output tokens, latency, estimated cost.
- **P0** Every decision is logged with a reason and actor (system or Rohit): filtered, scored, drafted, approved, skipped, rescued.
- **P0** `/api/health` reports yes/no per dependency (database, Gemini, Gmail, cron secret, each source reachable) and never returns secrets.
- **P0** `settings` table: accelerator name, programme one-liner, application link, Rohit's name, title and signature, booking link, timezone.

---

## 6. Live sources and information quality

### 6.1 Credibility tiers
| Tier | What | How it is used |
|---|---|---|
| **1 · Primary** | The company's or investor's own announcement on a newswire, the company website or blog | Strongest evidence |
| **2 · Established press with editors** | Entrackr, Inc42, YourStory, Economic Times, Mint, Business Standard, Moneycontrol, TechCrunch | Counts as confirmation |
| **3 · Discovery only** | Google News RSS aggregate | Used only to find stories. An item counts only if its **original publisher** is on the Tier 1 or 2 allowlist |
| **Never** | LinkedIn scraping, paid databases, email finders, content farms, AI-rewritten aggregators | Blocked list in `sources` |

### 6.2 Starting sources (free; checked 12 Oct 2026)
| Source | Feed | Live check | Role |
|---|---|---|---|
| Entrackr | `https://entrackr.com/rss` | Valid. 25 items over about 3 days, 5 of them pre-seed or seed | **Core India source (Tier 2)** |
| PR Newswire, venture capital | `https://www.prnewswire.com/rss/financial-services-latest-news/venture-capital-list.rss` | Valid. 20 items over 2 days, including primary seed announcements | **Global primary (Tier 1)** |
| TechCrunch, venture | `https://techcrunch.com/category/venture/feed/` | Valid. 20 items, mostly larger rounds | Global (Tier 2) |
| YourStory | `https://yourstory.com/feed` | Valid but thin, 7 items | India (Tier 2) |
| Inc42 | `https://inc42.com/feed/` | Valid but only 4 items. The funding tag feed is stale (2023), so don't use it | India (Tier 2, supplementary) |
| Google News RSS, en-IN | `news.google.com/rss/search?q=…&hl=en-IN&gl=IN&ceid=IN:en` with queries such as `"pre-seed" OR "seed round" when:1d` and `startup raises seed funding India when:1d` | Our test fetcher is blocked by robots, but it worked in production from Vercel in Srish's Founderbot | **Recall net (Tier 3)**, filtered to the publisher allowlist |
| ET Tech, VCCircle, Moneycontrol | their RSS feeds | Blocked to our test fetcher | **Re-test from Vercel in M0.** Keep any that respond |

Sources live in a Supabase `sources` table (name, URL, tier, enabled, country, last_ok_at, last_item_count), so Rohit can add or switch one off without a code change. Google News RSS is not an official API and may change, so the direct publisher feeds are the backbone.

### 6.3 Quality rules (the bar for anything Rohit sees)
1. **Every fact carries its source** (URL plus quote). No source means it doesn't appear.
2. **New round only.** Historical rounds mentioned in passing never trigger outreach.
3. **Stage is normalised and checked.** Pre-Series A, bridge and Series A are excluded by default.
4. **Conflicts are shown, never resolved silently.** Amounts, dates and investors that disagree are flagged.
5. **Freshness is explicit.** Every card shows the announcement date and day N of 60.
6. **Contacts are published or absent.** Nothing is guessed.
7. **Articles are data.** Instructions found inside source text are ignored and flagged.
8. **Respect publishers.** RSS summaries and links. Full pages only where robots.txt allows. Rate limits. An identifying user agent.

Quality traps already seen in today's live data, which the tests must cover:
- A Series A press release mentions an earlier $8.5 M seed round. It must not trigger outreach.
- A "pre-Series A" round looks like seed to a keyword filter. It isn't.
- Amounts appear in both ₹ crore and $ million.
- Weekly roundup articles cover many startups in one piece.

---

## 7. Thesis, lead signals and triggers

This section works like a lead-generation playbook:
- **Triggers** say *why now*.
- **Signals** say *why this startup*.
- **Priority** says *which one first*.

All of it is driven by data in Supabase, so Rohit can tune it without code.

### 7.1 Thesis: configurable in Supabase
A thesis is a **versioned row**. Editing means inserting a new version and marking it active. Every score records the version used. No code change is ever needed.

**Table `thesis_versions`:**
- id, version, is_active, created_at, note
- `stages` (text[])
- `geographies` (text[])
- `include_sectors` (text[])
- `exclude_sectors` (text[])
- `min_round_usd`, `max_round_usd`
- `disqualifiers` (text[])
- `criteria` (jsonb: name, description, weight)
- `fit_threshold`, `review_threshold`
- `closing_days` (default 10)
- `email_tone_notes`

**Starting thesis (fictional accelerator; edit freely):**
| Field | Value |
|---|---|
| Stages (hard) | pre-seed, seed |
| Geography (hard) | India-headquartered, or Indian founders building for India or global markets |
| Include sectors | B2B SaaS, applied AI and vertical AI, developer tools and AI infrastructure, fintech infrastructure (B2B) |
| Exclude sectors (hard) | consumer D2C brands, food and beverage, real estate, crypto tokens, gambling, lending NBFCs |
| Disqualifiers (hard) | acquired, shut down, debt-only or grant-only round, not a startup (fund launch, listed company, subsidiary) |
| Round size | $100k – $3M (about ₹0.8 – 25 Cr) |
| Soft criteria and weights | **Sector and business-model fit** 30 · **Programme need** 20 · **Evidence of progress** 20 · **Team, from work evidence** 15 · **Round size in range** 15 (total 100) |
| Thresholds | Fit ≥ 70 · Worth a look ≥ 55 |

**Acceptance test:** change `exclude_sectors` or a weight in Supabase, press Run now, and the next scores use the new version, with no deploy.

### 7.2 Lead signals: what makes a startup worth Rohit's two minutes

Each signal comes from a source quote or a code check. It is never inferred without evidence.

| Group | The question Rohit asks | Signals | Where it comes from | How it is used |
|---|---|---|---|---|
| **A · Trigger** | Is there a real, new reason to write now? | A new pre-seed or seed round is announced. Announcement date. Round size. **First institutional round** (first money from a fund, after friends, family or angels) | Article | Hard rules (new round, stage, window) plus timing |
| **B · Fit** | Is this our kind of company? | Sector. **Business model** (B2B, B2C or B2B2C, and who pays). **Customer type** (enterprise, SMB or consumer). Headquarters and target market | Article and company site | Hard rules (geography, excluded sectors), then the *Sector and business-model fit* score |
| **C · Programme need** | Would our programme help them now? | **Use of funds** stated (hiring, go-to-market, product, expansion) and how it matches what the programme offers. First institutional round. **Not already in another accelerator** (or flagged if the article says they are) | Article quotes | *Programme need* score, and the first choice of personalisation hook |
| **D · Evidence of progress** | Is there something real? | A live product (not a placeholder site). **Named customers, pilots or partners.** Revenue or user numbers mentioned. A recent launch | Article and company site | *Evidence of progress* score |
| **E · Team** | Can this team build it? | **Work-related evidence only:** technical or engineering background, a prior startup, stated domain experience | Article and company site | *Team* score. **Never** scored: college, age, gender, religion, caste, family background, photos |
| **F · Warm path** | Do we have a way in? | Lead or co-investor is on Rohit's **investor network list** (`settings.network_investors`). A founder is named. A contact address is published | Code | Priority boost and a chip. Mentioned in the draft only if the investor is on the list |
| **G · Signal quality** | Can I trust this? | Number of sources. A Tier 1 source present. Quotes verified. Amounts consistent. Website live | Code | A gate (at least one Tier 1 or 2 source), the confidence chip, and flags |

**Disqualifiers** (hard rules in code; the startup goes to Filtered out with the reason shown):
- The round is historical or after seed.
- The round is debt-only or grant-only.
- The company was acquired or shut down.
- It isn't a startup: a fund launch, a listed company or a subsidiary.
- An excluded sector.
- The window has closed.
- The company has already been contacted.

Being in another accelerator is a **flag**, not a disqualifier, because Rohit decides.

**What v1 does not monitor, and why:** job postings, LinkedIn activity, web traffic, app rankings and product launches without a funding round. These need scraping or paid data, and the booklet's trigger is funding.

### 7.3 Triggers: what every run checks

| # | Trigger | How it is detected | What happens | v1 |
|---|---|---|---|---|
| **T1** | A new pre-seed or seed round is announced | Extraction returns `is_new_round` with a seed-stage label | New lead → research → score → draft if it is a Fit | Must |
| **T2** | More coverage of a known round | Dedupe matches a known company and round | Adds the source, raises confidence, fills missing facts (for example investors). No new draft | Must |
| **T3** | A missing fact is resolved | A new source supplies a stage, website or contact for a lead parked as unclear | The lead is re-evaluated: hard rules, then score | Must |
| **T4** | Window milestones | Date check on every run | From day 50, undecided Fits get a **Closing** chip and move to the top. At day 60 they move to Closed and leave Today | Must |
| **T5** | The thesis changed | Active thesis version is newer than the score's | In-window leads show **Older thesis** with Rescore. (**Rescore all** is v1.1) | Must (flag) |
| **T6** | Bad news on an open lead | A new article about a known company reports Series A, an acquisition, a shutdown or joining an accelerator | The lead is flagged **Re-check** and its draft is held | v1.1 |
| **T7** | Rohit decides | Approve, Skip (with reason) or Rescue | Approve creates the outreach record, so it is never drafted again. Skip reasons and rescues are counted on Runs to show where the thesis needs tuning | Must |

### 7.4 Priority: which one first
1. **Closing:** undecided Fits with ≤ `closing_days` left in the window, the fewest days first.
2. **Other Fits:** highest fit score first. Ties go to the warm path, then the higher confidence, then the newer announcement.
3. **Worth a look:** shown in Filtered out, not in Today.

The order is deterministic, computed in code, and the same every time for the same data.

---

## 8. Gemini contract

- **Model:** `GEMINI_MODEL` env var, default `gemini-3.8-flash` (the current Flash model on the Gemini API pricing page, Oct 2026). Every AI step uses Flash, as the booklet requires.
- **Config:** structured output (`responseMimeType: application/json` plus `responseSchema`), low thinking level, 30 s timeout, retry on 429/5xx with backoff (max 3), validation of every response, one retry with the validation error appended.
- **Extraction output** (every non-null field needs a quote in `quotes`):
  ```
  { rounds: [{ company, website|null, stage_text, amount_text|null, announced_date|null,
      is_new_round, is_first_institutional|null, investors[], lead_investor|null,
      founders: [{ name, role|null, background|null }], location|null, sector_words[],
      business_model: "B2B"|"B2C"|"B2B2C"|null, customer_type: "enterprise"|"SMB"|"consumer"|null,
      use_of_funds|null, traction: [{ text, kind: "customers"|"revenue"|"users"|"launch"|"partnership" }],
      accelerator_mention|null, negative_events: ["acquired"|"shutdown"|"debt_only"|"grant_only"|"not_a_startup"],
      quotes: { <field>: "<verbatim text>" } }],
    injection_suspected: bool }
  ```
- **Scoring output:** `{ criteria: [{ name, score_0_5, evidence_fact_ids[], evidence_quote }] }`. No free-text reasons are shown on screen. Code computes the total.
- **Draft output:** `{ subject, body, greeting_name|null, claims: [{ text, fact_id }] }`
- **Never sent to Gemini:** secrets, Rohit's Gmail data, or anything not needed for the step.
- **Data terms:** inputs are public news and public company pages. The free tier is acceptable for that. If the drafts or thesis become sensitive, switch the key to billing, because the paid tier doesn't use prompts to improve Google's products (Gemini API Additional Terms).

## 9. Cost (estimate, logged for real once running)
At $0.75 input and $3.75 output per 1M tokens (Flash, until 31 Dec 2026):
- about 40 candidate articles a day × ~1.5k in / 0.3k out ≈ **$0.09**
- about 8 survivors × 2 calls (score + draft) × ~3k in / 0.8k out ≈ **$0.08**

That totals **≈ $0.17 a day (≈ ₹14)**, or about ₹430 a month. The Runs page shows real cost per run and per drafted email.

---

## 10. Front end: premium, calm and simple

**Design intent:** Apple-website restraint. Large confident type, generous white space, one idea per screen, photography that sets a mood, and motion that is felt more than seen. It should look premium. This is inspiration only: no Apple logos, product imagery or copied layouts.

### 10.1 Design system
- **Type:** system stack `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", sans-serif`. This renders SF Pro on Apple devices and Inter elsewhere. Headlines are 48–80 px and semibold, with tight tracking. Body is 17 px with 1.5 line height.
- **Colour:**
  - Light: background `#FFFFFF` / `#F5F5F7`, text `#1D1D1F`, secondary `#6E6E73`, one accent `#0071E3`.
  - Dark: `#000000` / `#1C1C1E`.
  - Status colours are muted and used only on small chips.
- **Shape and depth:** 18–22 px card radius, hairline borders, very soft shadows. A translucent top bar (`backdrop-filter: blur`).
- **Spacing:** 8 px grid. Sections breathe, with 96–160 px vertical rhythm on hero sections.
- **Motion:** 200–450 ms ease-out. Fade-up on scroll reveal. Slow 20 s "Ken Burns" zoom on hero photos. Gentle parallax. Number counters on KPIs. All motion respects `prefers-reduced-motion`.
- **Accessibility:** WCAG AA contrast, visible focus rings, full keyboard use, alt text on every image.

### 10.2 Imagery (dynamic and elegant)
- **Source:** curated **Unsplash** photos. Free to use under the Unsplash License, including commercially, with no permission needed. They are **downloaded and served from `/public`** (optimised to AVIF/WebP through `next/image`), not hotlinked. Photographers are credited on a **Credits** page.
- **Image slots and mood:**
  1. **Sign-in hero:** sunrise over a city skyline, in morning light, with a slow zoom. The image carries the mood, so the page needs no tagline.
  2. **Today header:** soft dawn gradient or window light on a clean desk. Subtle parallax.
  3. **Empty state ("No new fits today"):** calm, minimal scene, such as still water or an open horizon.
  4. **Filtered out:** abstract architectural lines in light grey.
  5. **Thesis:** blueprint or architectural detail, meaning "the plan".
  6. **Runs:** long-exposure light trails, meaning "the pipeline in motion".
- **Rules:** never stock photos of people shaking hands. Never busy images behind text; use a gradient scrim for legibility. At most one hero image per screen. Total image weight per page under 400 KB.

### 10.3 Screens
1. **Sign-in:** full-bleed hero image, the product name and a password field. Nothing else.
2. **Today:** the page title, the date and "Last run 06:04 IST". A KPI strip: new rounds found, Fits, Closing, awaiting approval, drafted this week. Then the startup cards in priority order (§7.4).
3. **Review:** two columns, with the facts, signals and evidence on the left and the email on the right. A sticky action bar with Approve → Gmail draft, Skip and Regenerate.
4. **Filtered out:** "Worth a look" band first, then a reasons list with Rescue.
5. **Pipeline:** table and board views of every startup, by status, with window countdown bars.
6. **Thesis:** the current thesis as clean typography, version history and diff.
7. **Runs and health:** last run, per-source status, funnel, cost.
8. **Credits:** image credits and data sources.
9. **Help** (the `?` side sheet, on every screen): Take the tour, the status and chip guide, where things live (§10.5).

**Mobile:** Rohit can read and approve from his phone. One column, a bottom action bar, 44 px tap targets.

### 10.4 Content rules: professional, clean, relevant data only
AI-built products tend to fill screens with explanatory or promotional sentences. This product does not.
1. **Data and actions only.** No sentences about how the system works, the AI, Gemini, the course, the Nine Checks or the pipeline. No taglines, hero slogans, welcome messages, "AI-powered" badges or emojis. (The model name appears once, as a fact, on the Runs page.)
   - **Sanctioned exception (12 Oct, owner's decision):** the sign-in page shows "Welcome, Rohit" above the product name.
   - **One sanctioned exception: the first-run demo and Help (§10.5).** Their text is instructions for using the product, not a description of it. Each step is at most 15 words, written as what to do.
2. **Titles are nouns:** Today, Review, Filtered out, Pipeline, Thesis, Runs, Credits. Buttons are verbs: Approve, Skip, Rescue, Regenerate, Run now, Copy.
3. **Every number has a unit and a time** ("6 new rounds since 06:04 IST"). **Every fact links to its source.**
4. **"What they do" is in the company's own words:** their site's description or a quote from the article, in quotation marks with the source. It is never an AI summary.
5. **Fit evidence is shown as criterion · score · quote,** for example "Programme need · 4/5 · 'funds will be used to build the sales team in Bengaluru'". There is no AI-written explanation.
6. **The only long AI-written text is the draft email.** It is clearly labelled Draft and is editable.
7. **Empty states and errors are one factual line plus the next action.** "No new pre-seed or seed rounds since 06:04 IST." "Gmail not connected. Copy the draft or open it in Gmail."
8. **Sentence case, no exclamation marks.** No filler: seamless, powerful, effortless, unlock, supercharge, magic, revolutionary, cutting-edge.
9. **Show only what Rohit acts on.** Internal IDs, raw JSON, token counts and debug text stay off every screen except Runs. Even there they are summarised, not dumped.

### 10.5 First-run demo and Help
**Goal:** a first-time user (Rohit, or a grader) can review and approve a startup confidently within two minutes, without reading a manual.

**When it appears**
- Automatically after the **first sign-in**, as a small centred card titled **"Quick tour · 6 steps · about 1 minute"** with **Start** and **Skip** buttons. There is no welcome message.
- **Replay any time** from **Help** (the `?` button in the top bar) → **Take the tour**.
- Completion is stored in Supabase (`settings.tour_completed_at`) so it doesn't reappear on another device, with a browser-storage fallback.

**The tour** uses spotlight coach marks on the **real screens**. Each step dims the rest of the page, highlights one element, and shows a short instruction with Back, Next and step dots.

| Step | Highlights | Text (final copy, at most 15 words) |
|---|---|---|
| 1 | The Today list | "Startups that match your thesis. Most urgent first." |
| 2 | A startup card's chips | "Day count, fit score and source count at a glance." |
| 3 | The facts panel on Review | "Every fact links to its source. Check the quotes before approving." |
| 4 | The draft and the Approve button | "Edit the email, then Approve. It is saved to your Gmail Drafts." |
| 5 | Filtered out in the navigation | "Startups that did not qualify, with the reason. Rescue any you want." |
| 6 | Thesis in the navigation | "What qualifies. Edit it in Supabase; the next run follows it." |

Final card: **"Done. Nothing is ever sent without you."** with **Finish**.

**Sample startup for empty days**
- If there is no live Fit when the tour starts, steps 2–4 use one **Sample** startup. It is fictional, has a grey "Sample" badge on every element, and is loaded from `public/demo/sample.json`, not the database.
- It never appears in Today, the KPIs, the Pipeline or the outreach records.
- Approving it shows **"Sample only. A real approval saves to Gmail Drafts."** and nothing is created.
- When live Fits exist, the tour uses the top real startup in read-only mode: tour steps never trigger Approve or Skip.

**Help (the `?` button)** is a calm side sheet containing:
- **Take the tour**
- **Status and chip guide:** one line each for Closing, Worth a look, One source, Conflicting amounts, Older thesis, Find contact, Sample.
- **Where things live:** Thesis → Supabase table `thesis_versions`. Drafts → your Gmail Drafts folder.
- **Keyboard shortcuts** (v1.1).

Every chip in the app also has a tooltip with the same one line as the guide, so the help text is in context too.

**Quality bar for the demo**
- Keyboard-operable: arrow keys and Enter move through steps, Esc exits. Focus is trapped inside the step, and positions are read out to screen readers ("Step 2 of 6").
- On mobile the coach marks become a **bottom sheet** under the highlighted element.
- It respects `prefers-reduced-motion`, with a fade instead of slide.
- It never blocks real work: Esc or Skip always ends it, and it never re-opens on its own once dismissed.
- It uses a lightweight, accessible tour component (a small custom one, or a minimal MIT library such as driver.js), styled to the design system in §10.1.

### 10.6 Interaction details for a smooth experience
- **Review is a queue.** After Approve or Skip, the next startup opens automatically, with progress shown as "3 of 7". **Back to Today** is always one tap away.
- **Approve with Undo.** The Gmail draft is created at once. A toast reads **"Saved to Gmail Drafts · Open · Undo"**. Undo, within 10 seconds, deletes the draft (`drafts.delete`, allowed by `gmail.compose`) and removes the outreach record.
- **Skip in one tap**, with reason chips: Not our sector · Too early · Too late · Already in touch · Other (optional note). Reasons feed the thesis-tuning counts on Runs (T7).
- **The draft autosaves** while Rohit edits. Regenerate asks for confirmation if he has edited it.
- **Missing recipient:** an inline field with **Find contact** links (company website, LinkedIn search for the founder by name). Approve still works, and the draft is flagged in Gmail.
- **Run now** opens a compact progress panel with live counts per stage: Sources · Articles · Rounds · Checked · Scored · Drafted. When it finishes, it shows "4 new Fits · View".
- **Loading:** skeleton placeholders shaped like the content, never full-page spinners. Pages are server-rendered. Targets: first view under 1.5 s on 4G, interactions respond within 100 ms.
- **Errors:** one line saying what failed and what to do, plus a retry button. Nothing fails silently, and work is never lost.
- **Sessions** stay signed in for 30 days on a trusted device. Sign-out sits in the top bar menu.
- **Consistency:** the same chip means the same thing everywhere. Primary actions sit bottom-right on desktop and in the bottom bar on mobile.

---

## 11. Security, privacy and safety
- **Secrets** live only in `.env.local`, which is gitignored, and in Vercel environment variables. Nothing secret uses the `NEXT_PUBLIC_` prefix. Secrets are read in `server-only` modules.
- **Access:** the whole app sits behind Rohit's password, a signed HTTP-only cookie, **on by default**. Graders get the password in the submission note (see §16). `/api/cron` and `/api/run` require `CRON_SECRET` or a signed-in session.
- **Supabase:** row level security on, with no public policies. All access goes server-side with the service key.
- **Gmail:** Internal OAuth, `gmail.compose` only. The refresh token is stored as a Vercel environment variable. **A test fails the build if the code references `drafts.send`, `messages.send` or SMTP.**
- **Personal data (DPDP-minded):** store only what outreach needs (company, founder names as published, published contact, sources). No scraping of personal profiles. Retention: purge founder contact fields 180 days after a startup is skipped or its window closes.
- **Prompt injection:** source text is passed as data inside delimiters with an explicit instruction to ignore embedded instructions. `injection_suspected` sets a flag.
- **Polite crawling:** robots.txt is respected, an identifying user agent is sent, and there is at most one request per second per domain.

---

## 12. Evaluation

**Reference list for recall.** Entrackr's **weekly funding report** lists every Indian round of the week. Hand-label the pre-seed and seed rounds from the two most recent weeks as ground truth, about 20–30 companies. Recall is the share the system found. The target is ≥ 90%, against Rohit's 60–70% baseline.

**Golden test set** (`/eval/cases.json`, about 40 real items, labelled by Srish):
- **Clear cases:** new seed (India), new pre-seed (India), global seed press release.
- **Traps:**
  - Series A that mentions an earlier seed round
  - pre-Series A
  - bridge round
  - undisclosed stage
  - acquisition news
  - fund launch (not a startup)
  - weekly roundup with several startups
  - the same round covered by three outlets
  - ₹ vs $ amount conflict
  - a company already contacted
  - announcement older than 60 days
- **Fit:** clear fit, clear non-fit (excluded sector), borderline (should land in "Worth a look").
- **Signals:**
  - an article stating use of funds, which should be captured with its quote
  - a named customer
  - a first institutional round
  - a startup already in another accelerator, which should be flagged, not dropped
  - a debt-only round, which should be disqualified
  - a company with no evidence of progress, whose score should stay low and never be invented
- **Demo:** first sign-in shows the tour card. Skip and Esc end it, and it doesn't return after completion. Replay works from Help. With no live Fits, the Sample startup is used and nothing is saved or drafted. With live Fits, the tour never approves or skips anything.
- **Copy and lint:** a draft containing a banned phrase or an em dash must fail the lint and be regenerated. The no-AI-prose rule is checked by reviewing every screen against §10.4.
- **Safety:** an article containing an instruction ("ignore previous instructions and…"), a page with no contact, a page with only a personal-looking Gmail address.

**Metrics reported by `npm run eval`:**
- extraction precision and recall
- stage accuracy
- duplicate merges correct
- fit bucket accuracy
- **0 drafts with untraceable claims**
- **0 drafts for already-contacted companies**
- cost per run

**Unit tests** cover the deterministic parts: stage mapping, amount parsing, name normalisation and fuzzy match, window maths, threshold buckets, quote check, claim-to-fact check, dedupe, and the **no-send guard**.

**Held-out rule:** tune prompts on one half of the golden set and report on the other half. This avoids the in-sample 39/39 problem.

---

## 13. Edge cases
| Case | Behaviour |
|---|---|
| No new rounds today | Calm empty state, plus "Worth a look" and in-window items not yet decided |
| Same company raises again in the window (seed extension) | One startup record, new source added. No second draft if already contacted |
| Article in Hindi or another language | Extract if Gemini can, otherwise skip with a reason |
| Company website down | Draft from the news facts only. Flag **No website facts** |
| Two different companies with similar names | Website domain decides. If unknown, flag **Possible duplicate** and don't merge |
| Gemini down or rate-limited | The run pauses and resumes next call. Today shows "Last run incomplete" |
| A source goes silent | Runs page shows "No items in 48 h". Health check turns amber |
| Rohit edits the thesis mid-week | New runs use the new version. In-window items show Rescore |
| Gmail token revoked | Approve falls back to Copy and Open in Gmail. Health shows Gmail: no |

---

## 14. Data model (Supabase Postgres)
| Table | Key fields |
|---|---|
| `sources` | id, name, url, kind (rss/google_news/press), tier, country, enabled, last_ok_at, last_item_count |
| `articles` | id, source_id, url (unique), title, publisher, published_at, summary, fetched_at, text_hash |
| `rounds` | id, article_id, startup_id, stage_text, stage, amount_text, amount_usd_est, announced_at, investors[], founders[], quotes jsonb, is_new_round, flags[] |
| `startups` | id, name, name_norm, website_domain (unique when present), location, sector_words[], business_model, customer_type, first_announced_at, window_ends_at, status, priority, confidence, flags[] |
| `signals` | id, startup_id, round_id, group (A–G), name, value, quote, source_url, created_at |
| `triggers` | id, startup_id, type (T1–T7), detail, run_id, created_at |
| `research` | startup_id, url, title, description, text_excerpt, contacts jsonb (address, where_found_url, kind), fetched_at |
| `scores` | startup_id, thesis_version, criteria jsonb, total, bucket, hard_rule_failed, created_at |
| `drafts` | id, startup_id, subject, body, recipient, claims jsonb, status (draft/approved/skipped), gmail_draft_id, approved_at |
| `outreach` | startup_id (unique), status (drafted/sent/replied/skipped), by, at, note |
| `thesis_versions` | see §7 |
| `settings` | accelerator name, programme line, programme offers (for matching use of funds), application link, signature, booking link, timezone, `network_investors[]`, `tour_completed_at` |
| `runs` | id, started_at, finished_at, step, counts jsonb, errors jsonb, status |
| `llm_calls` | run_id, step, model, tokens_in, tokens_out, ms, cost_usd_est |
| `decisions` | startup_id, action, reason, actor, at |

---

## 15. Build plan (Claude Code)

Each milestone works end to end before the next starts. **Commit and push after each one.**

| # | Milestone | Done when |
|---|---|---|
| **M0** | Accounts and source check: repo, Vercel project, Supabase project, Gemini key. A tiny `/api/sources/check` deployed to Vercel fetches every candidate feed from Vercel itself | The Vercel URL shows which feeds respond from Vercel, and the `sources` table is seeded with the ones that work |
| **M1** | Schema, thesis v1, settings, password gate, health endpoint | `/api/health` is all green except Gmail. The thesis shows on the Thesis page |
| **M2** | Ingest, pre-filter, extraction (Gemini), quote check, stage and amount normalisation, dedupe, window | A Run now on live feeds fills `startups` with real, verified pre-seed and seed rounds. Unit tests pass |
| **M3** | Research, hard rules, scoring, buckets, drafting with claim check | Today shows real fits with sources and drafts. Filtered out shows reasons. The golden-set eval passes its targets |
| **M4** | Front end at full quality: design system, imagery, motion, all screens, mobile, **first-run demo and Help (§10.5)**, **interaction details (§10.6)** | Reviewed on a phone and a laptop, light and dark. Lighthouse accessibility ≥ 95. A fresh browser completes the tour in about 1 minute. Every visible string passes §10.4 |
| **M5** | Gmail Drafts (Internal OAuth), status sync, Copy and Open in Gmail fallback, no-send test | Approve puts a real draft in Gmail Drafts within seconds. The no-send test is in CI |
| **M6** | Vercel Cron, run log, cost log, eval report, README, components map, final checks on the **live URL** | Every item in §16 is ticked on the deployed site |

---

## 16. Submission checklist (checked on the live URL)
- [ ] **Public Vercel URL** opens on a clean sign-in page. Graders sign in with the password in the submission note.
- [ ] **Copy check (§10.4):** no explanatory, promotional or AI-sounding text anywhere on the site. Every number has a time and every fact a source.
- [ ] **Demo:** sign in on a fresh browser and complete the tour in about 1 minute. It works on a phone and with the keyboard. Help → Take the tour replays it. The submission note tells graders to start there.
- [ ] **Smooth flow:** Approve → toast → Undo works. Auto-advance to the next startup works. Skip reasons are saved.
- [ ] **Signals visible:** at least one live Fit shows use of funds, traction or a first-institutional-round signal, with its quote.
- [ ] **Live data:** Today shows real rounds from the last few days, with working source links.
- [ ] **Gemini Flash only:** the model is shown on the Runs page, and there is no Claude API anywhere.
- [ ] **No duplicates:** demonstrate a company that is never re-drafted after Approve.
- [ ] **Thesis in Supabase:** change it, run, and show the new version on the scores.
- [ ] **Never sends:** the no-send test passes, and Gmail shows drafts only.
- [ ] **GitHub repo:** clean history, README with setup, `docs/PRD.md`, `docs/components-map.png`, eval report.
- [ ] **Components Map** image.
- [ ] Health endpoint all green, cron listed in the Vercel dashboard, cost visible.

---

## 17. Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| A feed is blocked from Vercel or changes format | Medium | Several sources, the M0 check, the `sources` table, health alerts |
| Google News RSS changes (unofficial) | Medium | Direct publisher feeds are the backbone |
| The extractor mistakes an old round or a Series A for seed | Medium | `is_new_round`, stage mapping in code, quote check, trap cases in the golden set |
| Wrong "not a fit" | Medium | Filtered out with reasons, "Worth a look" band, Rescue, threshold tuning on held-out data |
| Workspace admin blocks the Gmail API for the MESA domain | Low–Medium | Test in M5 early. The Copy and Open in Gmail fallback keeps the flow working |
| Hobby cron fires late in the hour | Certain | Acceptable for a morning digest. Run now covers urgent cases |
| Front-end polish eats the schedule | Medium | The design system is fixed in M4 before screens. Imagery is chosen once |

## 18. Open questions
1. ~~Accelerator name~~ Default: "Your Accelerator" / "Rohit, Programme Lead", editable in `settings`.
2. ~~Grader access~~ Default: a public landing page plus a password in the submission note.
3. ~~Deadline~~ **13 Oct 2026.** See §0.
4. ~~When the Gmail draft is created~~ **Decided (12 Oct): on Approve.**
   - Each morning the drafts are ready in the app's Today queue.
   - Rohit's Approve puts the email into his Gmail Drafts folder, and he sends it from Gmail.
   - Rationale: one explicit decision point per startup, a clean audit trail, and nothing unreviewed in his mailbox.
   - For the write-up: "drafts are prepared every morning; the Drafts folder only ever holds emails Rohit has approved."

---

## Appendix A. First prompt for Claude Code

Paste this once `docs/PRD.md`, `docs/components-map.png` and `CLAUDE.md` are in the repo:

> Read `CLAUDE.md`, then `docs/PRD.md` end to end, and look at `docs/components-map.png`. We are building the Timed Funding Outreach Engine: Next.js on Vercel, Supabase, and Gemini Flash for every AI step (never the Claude API). The deadline is tomorrow, so build exactly the must-have scope in PRD §0, in the milestone order of §15.
>
> First give me a short plan and list anything in the PRD that is wrong or unclear. Then start: create the project, `.env.example`, `.gitignore` with `.env*`, the Supabase schema from §14 as a migration with the thesis and settings seeded from §7, and a deployed `/api/sources/check` that fetches every feed in §6.2 *from Vercel* and reports item counts.
>
> Ask me for each key when you need it, and tell me where to paste it (`.env.local` and the Vercel dashboard), never in chat. After each milestone: run the tests, deploy, check it on the live URL, and push to GitHub with a clear commit message. Then tell me what to check before you continue.

## Appendix B. Accounts and keys to set up tonight (about 45 minutes)

Paste values only into `.env.local` and the Vercel environment variables. Never into chat, code or screenshots.

1. **Git identity first.** Set `git config --global user.email` to the email on your GitHub and Vercel accounts. A mismatched commit author can block Vercel Hobby deploys, as seen in Founderbot.
2. **GitHub:** create an empty repo, for example `funding-radar`.
3. **Supabase:** create a new project in the Mumbai region. Copy the Project URL and the `service_role` key (server only).
4. **Gemini:** in Google AI Studio, create an API key. New keys start with `AQ.`. Model: `gemini-3.8-flash`.
5. **Vercel:** sign in with GitHub. Import the repo once Claude Code has pushed the first commit.
6. **Google OAuth for Gmail drafts** (can be done during session 2):
   - Use a Google Cloud project on your **MESA account**.
   - Set the consent screen to **Internal**.
   - Enable the **Gmail API**.
   - Create a Web OAuth client with the OAuth Playground redirect URI.
   - In the OAuth Playground, use your own credentials and select **only** `https://www.googleapis.com/auth/gmail.compose`. This is the same steps as the Case 4 pre-read, but with one narrower scope.
   - Save `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_REFRESH_TOKEN`.
7. **Generated secrets:** `CRON_SECRET`, `APP_PASSWORD` and `SESSION_SECRET`. Claude Code can generate these locally.

Environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GMAIL_SENDER`, `CRON_SECRET`, `APP_PASSWORD`, `SESSION_SECRET`.
