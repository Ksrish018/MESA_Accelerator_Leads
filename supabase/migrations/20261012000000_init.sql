-- Funding Radar schema (PRD §14). RLS on everywhere, no public policies:
-- every read and write goes through server code with the service-role key.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- sources
create table if not exists sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  url text not null,
  kind text not null check (kind in ('rss', 'google_news', 'press')),
  tier int not null check (tier in (1, 2, 3)),
  country text,
  enabled boolean not null default true,
  last_ok_at timestamptz,
  last_checked_at timestamptz,
  last_item_count int,
  last_error text,
  created_at timestamptz not null default now()
);

-- Publisher allowlist. Google News items count only when their original
-- publisher is listed here (PRD §6.1). tier 0 = blocked.
create table if not exists publishers (
  domain text primary key,
  name text not null,
  tier int not null check (tier in (0, 1, 2))
);

-- ---------------------------------------------------------------- articles
create table if not exists articles (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references sources(id) on delete set null,
  url text not null unique,
  title text not null,
  title_norm text not null,
  publisher text,
  publisher_domain text,
  publisher_tier int,
  published_at timestamptz,
  summary text,
  body_text text,
  fetched_at timestamptz not null default now(),
  text_hash text,
  is_candidate boolean not null default false,
  extract_status text not null default 'pending'
    check (extract_status in ('pending', 'claimed', 'done', 'skipped', 'failed')),
  claimed_at timestamptz,
  claimed_by uuid,
  attempts int not null default 0,
  extract_error text,
  injection_suspected boolean not null default false
);
create index if not exists articles_title_norm_idx on articles (title_norm);
create index if not exists articles_status_idx on articles (extract_status) where is_candidate;

-- ---------------------------------------------------------------- startups
create table if not exists startups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_norm text not null,
  website_url text,
  website_domain text,
  location text,
  sector_words text[] not null default '{}',
  business_model text,
  customer_type text,
  first_announced_at timestamptz,
  window_ends_at timestamptz,
  status text not null default 'new'
    check (status in ('new', 'unclear', 'fit', 'filtered', 'drafted', 'sent', 'replied', 'skipped', 'closed')),
  bucket text check (bucket in ('fit', 'worth_a_look', 'not_a_fit')),
  filter_reason text,
  confidence text,
  source_count int not null default 0,
  has_tier1 boolean not null default false,
  flags text[] not null default '{}',
  needs_eval boolean not null default true,
  eval_claimed_at timestamptz,
  eval_attempts int not null default 0,
  rescued boolean not null default false,
  sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists startups_domain_uidx on startups (website_domain) where website_domain is not null;
create index if not exists startups_name_norm_idx on startups (name_norm);
create index if not exists startups_status_idx on startups (status);

-- ---------------------------------------------------------------- rounds
create table if not exists rounds (
  id uuid primary key default gen_random_uuid(),
  article_id uuid references articles(id) on delete cascade,
  startup_id uuid references startups(id) on delete cascade,
  source_url text not null,
  publisher text,
  publisher_tier int,
  published_at timestamptz,
  stage_text text,
  stage text check (stage in ('pre_seed', 'seed', 'other', 'unknown')),
  amount_text text,
  amount_usd_est numeric,
  announced_at timestamptz,
  investors text[] not null default '{}',
  lead_investor text,
  founders jsonb not null default '[]',
  website text,
  location text,
  sector_words text[] not null default '{}',
  business_model text,
  customer_type text,
  use_of_funds text,
  traction jsonb not null default '[]',
  accelerator_mention text,
  negative_events text[] not null default '{}',
  is_new_round boolean not null default true,
  is_first_institutional boolean,
  quotes jsonb not null default '{}',
  dropped_fields text[] not null default '{}',
  flags text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (article_id, startup_id)
);
create index if not exists rounds_startup_idx on rounds (startup_id);

-- ---------------------------------------------------------------- signals
create table if not exists signals (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references startups(id) on delete cascade,
  round_id uuid references rounds(id) on delete cascade,
  grp text not null check (grp in ('A', 'B', 'C', 'D', 'E', 'F', 'G')),
  name text not null,
  value text,
  quote text,
  source_url text,
  created_at timestamptz not null default now()
);
create index if not exists signals_startup_idx on signals (startup_id);

-- ---------------------------------------------------------------- triggers
create table if not exists triggers (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid references startups(id) on delete cascade,
  type text not null check (type in ('T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7')),
  detail text,
  run_id uuid,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- research
create table if not exists research (
  startup_id uuid primary key references startups(id) on delete cascade,
  url text,
  title text,
  description text,
  text_excerpt text,
  contacts jsonb not null default '[]',
  pages jsonb not null default '[]',
  ok boolean not null default false,
  error text,
  fetched_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- thesis
create table if not exists thesis_versions (
  id uuid primary key default gen_random_uuid(),
  version int not null unique,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  note text,
  stages text[] not null,
  geographies text[] not null,
  include_sectors text[] not null default '{}',
  exclude_sectors text[] not null default '{}',
  sector_keywords jsonb not null default '{}',
  min_round_usd numeric,
  max_round_usd numeric,
  disqualifiers text[] not null default '{}',
  criteria jsonb not null,
  fit_threshold int not null default 70,
  review_threshold int not null default 55,
  closing_days int not null default 10,
  window_days int not null default 60,
  email_tone_notes text
);
create unique index if not exists thesis_one_active on thesis_versions (is_active) where is_active;

-- Stage label mapping (PRD §5.4: "the mapping table lives in Supabase").
create table if not exists stage_map (
  label text primary key,
  stage text not null check (stage in ('pre_seed', 'seed', 'other', 'unknown'))
);

-- ---------------------------------------------------------------- scores
create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references startups(id) on delete cascade,
  thesis_version int not null,
  criteria jsonb not null default '[]',
  total int,
  bucket text,
  hard_rule_failed text,
  created_at timestamptz not null default now()
);
create index if not exists scores_startup_idx on scores (startup_id, created_at desc);

-- ---------------------------------------------------------------- drafts
create table if not exists drafts (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references startups(id) on delete cascade,
  subject text not null,
  body text not null,
  recipient text,
  greeting_name text,
  claims jsonb not null default '[]',
  facts jsonb not null default '[]',
  lint_errors text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'approved', 'skipped')),
  edited boolean not null default false,
  gmail_draft_id text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists drafts_startup_idx on drafts (startup_id, created_at desc);

-- ---------------------------------------------------------------- outreach
create table if not exists outreach (
  startup_id uuid primary key references startups(id) on delete cascade,
  status text not null check (status in ('drafted', 'sent', 'replied', 'skipped')),
  by text not null default 'rohit',
  at timestamptz not null default now(),
  note text,
  gmail_draft_id text
);

-- ---------------------------------------------------------------- settings
create table if not exists settings (
  id int primary key default 1 check (id = 1),
  accelerator_name text not null,
  programme_line text,
  programme_offers text[] not null default '{}',
  application_link text,
  signer_name text,
  signer_title text,
  signature text,
  booking_link text,
  timezone text not null default 'Asia/Kolkata',
  network_investors text[] not null default '{}',
  usd_inr_rate numeric not null default 88,
  tour_completed_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- runs
create table if not exists runs (
  id uuid primary key default gen_random_uuid(),
  trigger text not null default 'manual' check (trigger in ('cron', 'manual')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  step text not null default 'ingest',
  since timestamptz,
  counts jsonb not null default '{}',
  errors jsonb not null default '[]',
  lock_until timestamptz
);

create table if not exists llm_calls (
  id uuid primary key default gen_random_uuid(),
  run_id uuid,
  step text not null,
  model text not null,
  tokens_in int,
  tokens_out int,
  ms int,
  cost_usd_est numeric,
  ok boolean not null default true,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists llm_calls_run_idx on llm_calls (run_id);

create table if not exists decisions (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid references startups(id) on delete cascade,
  action text not null,
  reason text,
  actor text not null check (actor in ('system', 'rohit')),
  at timestamptz not null default now()
);
create index if not exists decisions_startup_idx on decisions (startup_id);

-- ---------------------------------------------------------------- RLS
do $$
declare t text;
begin
  foreach t in array array['sources','publishers','articles','startups','rounds','signals','triggers',
    'research','thesis_versions','stage_map','scores','drafts','outreach','settings','runs','llm_calls','decisions']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon, authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- claim functions
-- Lock-and-claim so overlapping calls never process the same item twice.
create or replace function claim_articles(p_run uuid, p_limit int)
returns setof articles language sql as $$
  update articles a set extract_status = 'claimed', claimed_at = now(), claimed_by = p_run, attempts = a.attempts + 1
  where a.id in (
    select id from articles
    where is_candidate
      and (extract_status = 'pending' or (extract_status = 'claimed' and claimed_at < now() - interval '3 minutes'))
      and attempts < 3
    order by published_at desc nulls last
    limit p_limit
    for update skip locked)
  returning a.*;
$$;

create or replace function claim_startups(p_limit int)
returns setof startups language sql as $$
  update startups s set eval_claimed_at = now(), eval_attempts = s.eval_attempts + 1
  where s.id in (
    select id from startups
    where needs_eval and not sample
      and (eval_claimed_at is null or eval_claimed_at < now() - interval '3 minutes')
      and eval_attempts < 3
    order by first_announced_at desc nulls last
    limit p_limit
    for update skip locked)
  returning s.*;
$$;

create or replace function claim_run(p_run uuid, p_seconds int)
returns setof runs language sql as $$
  update runs set lock_until = now() + make_interval(secs => p_seconds)
  where id = p_run and status = 'running' and (lock_until is null or lock_until < now())
  returning *;
$$;

revoke all on function claim_articles(uuid, int) from public, anon, authenticated;
revoke all on function claim_startups(int) from public, anon, authenticated;
revoke all on function claim_run(uuid, int) from public, anon, authenticated;
