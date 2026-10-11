export type Stage = "pre_seed" | "seed" | "other" | "unknown";
export type Bucket = "fit" | "worth_a_look" | "not_a_fit";
export type StartupStatus =
  | "new" | "unclear" | "fit" | "filtered" | "drafted" | "sent" | "replied" | "skipped" | "closed";

export type NegativeEvent = "acquired" | "shutdown" | "debt_only" | "grant_only" | "not_a_startup";
export type TractionKind = "customers" | "revenue" | "users" | "launch" | "partnership";

export interface Founder { name: string; role: string | null; background: string | null }
export interface Traction { text: string; kind: TractionKind }

/** One round as Gemini returns it (PRD §8). Every non-null field needs a quote. */
export interface ExtractedRound {
  company: string;
  website: string | null;
  stage_text: string;
  amount_text: string | null;
  announced_date: string | null;
  is_new_round: boolean;
  is_first_institutional: boolean | null;
  investors: string[];
  lead_investor: string | null;
  founders: Founder[];
  location: string | null;
  sector_words: string[];
  business_model: "B2B" | "B2C" | "B2B2C" | null;
  customer_type: "enterprise" | "SMB" | "consumer" | null;
  use_of_funds: string | null;
  traction: Traction[];
  accelerator_mention: string | null;
  negative_events: NegativeEvent[];
  quotes: Record<string, string>;
}

export interface Extraction { rounds: ExtractedRound[]; injection_suspected: boolean }

export interface Criterion {
  key: string;
  name: string;
  weight: number;
  kind: "ai" | "round_size";
  description: string;
}

export interface Thesis {
  id: string;
  version: number;
  is_active?: boolean;
  created_at: string;
  note: string | null;
  stages: string[];
  geographies: string[];
  include_sectors: string[];
  exclude_sectors: string[];
  sector_keywords: Record<string, string[]>;
  min_round_usd: number | null;
  max_round_usd: number | null;
  disqualifiers: string[];
  criteria: Criterion[];
  fit_threshold: number;
  review_threshold: number;
  closing_days: number;
  window_days: number;
  email_tone_notes: string | null;
}

export interface Settings {
  accelerator_name: string;
  programme_line: string | null;
  programme_offers: string[];
  application_link: string | null;
  signer_name: string | null;
  signer_title: string | null;
  signature: string | null;
  booking_link: string | null;
  timezone: string;
  network_investors: string[];
  usd_inr_rate: number;
  tour_completed_at: string | null;
}

export interface CriterionScore {
  key: string;
  name: string;
  score_0_5: number;
  weight: number;
  evidence_quote: string | null;
  evidence_fact_ids: string[];
  source_url?: string | null;
}

export interface Fact { id: string; text: string; source_url: string | null; quote: string | null }

export interface Contact { address: string; where_found_url: string; kind: "founder" | "general" | "press" | "other" }
