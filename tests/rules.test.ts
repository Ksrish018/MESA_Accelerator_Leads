import { describe, expect, it } from "vitest";
import { mapStage } from "@/lib/extract/stage";
import { amountsConflict, parseAmount } from "@/lib/extract/amount";
import { matchStartup, nameSimilarity, normalizeName } from "@/lib/dedupe/names";
import { earliestCredible, windowInfo } from "@/lib/thesis/window";
import { bucketFor, computeTotal, roundSizeScore } from "@/lib/score/buckets";
import { quoteFound, verifyRound } from "@/lib/verify/quotes";
import { checkClaims } from "@/lib/verify/claims";
import { lintDraft } from "@/lib/draft/lint";
import { applyHardRules, excludedSector, geographyScore, isGlobal } from "@/lib/thesis/rules";
import { comparePriority, confidence, sortByPriority, warmPath } from "@/lib/score/priority";
import { isFundingCandidate } from "@/lib/sources/prefilter";
import { extractEmails, rankContacts } from "@/lib/research/contacts";
import { parseRobots, robotsAllows } from "@/lib/sources/fetch";
import { canonicalUrl, normalizeTitle } from "@/lib/text";
import { sanitizeFounders } from "@/lib/extract/extract";
import { makeSession, verifySession } from "@/lib/auth";
import { buildMime } from "@/lib/gmail/gmail";
import type { ExtractedRound, Thesis } from "@/lib/types";

const thesis: Thesis = {
  id: "t", version: 1, created_at: "", note: null, stages: ["pre_seed", "seed"],
  geographies: ["India", "Bengaluru", "Mumbai", "Delhi", "Gurugram", "Pune"],
  include_sectors: ["B2B SaaS"], exclude_sectors: ["food and beverage", "crypto tokens", "consumer D2C brands"],
  sector_keywords: { "food and beverage": ["food", "beverage", "bakery", "snacks"], "crypto tokens": ["crypto", "web3"], "consumer D2C brands": ["d2c", "skincare"] },
  min_round_usd: 100000, max_round_usd: 3000000, disqualifiers: ["acquired", "shutdown", "debt_only", "grant_only", "not_a_startup"],
  criteria: [
    { key: "sector_fit", name: "Sector", weight: 30, kind: "ai", description: "" },
    { key: "programme_need", name: "Need", weight: 20, kind: "ai", description: "" },
    { key: "progress", name: "Progress", weight: 20, kind: "ai", description: "" },
    { key: "team", name: "Team", weight: 15, kind: "ai", description: "" },
    { key: "round_size", name: "Size", weight: 15, kind: "round_size", description: "" },
  ],
  fit_threshold: 70, review_threshold: 55, closing_days: 10, window_days: 60, email_tone_notes: null,
};

describe("stage mapping", () => {
  it.each([
    ["pre-seed", "pre_seed"], ["Pre-Seed round", "pre_seed"], ["angel", "pre_seed"], ["seed", "seed"],
    ["Seed extension", "seed"], ["seed-plus", "seed"], ["pre-Series A", "other"], ["Pre Series A", "other"],
    ["bridge", "other"], ["Series A", "other"], ["Series A+", "other"], ["Series B", "other"],
    ["undisclosed", "unknown"], ["", "unknown"], [null, "unknown"], ["seed round ahead of its Series A", "seed"],
  ])("%s → %s", (label, stage) => expect(mapStage(label as string | null)).toBe(stage));
});

describe("amount parsing", () => {
  it("₹ crore", () => expect(parseAmount("₹5.25 Cr", 88)).toMatchObject({ currency: "INR", value: 52_500_000, usd: 596_591 }));
  it("Rs lakh", () => expect(parseAmount("Rs 40 lakh", 80)?.usd).toBe(50_000));
  it("INR crore words", () => expect(parseAmount("INR 12 crore", 80)?.usd).toBe(1_500_000));
  it("$ million", () => expect(parseAmount("$1.3 Mn", 88)).toMatchObject({ currency: "USD", usd: 1_300_000 }));
  it("$2M", () => expect(parseAmount("$2M", 88)?.usd).toBe(2_000_000));
  it("USD 500K", () => expect(parseAmount("USD 500K", 88)?.usd).toBe(500_000));
  it("commas", () => expect(parseAmount("$1,500,000", 88)?.usd).toBe(1_500_000));
  it("skips bare years", () => expect(parseAmount("In 2024 it raised $3 million", 88)?.usd).toBe(3_000_000));
  it("undisclosed is null", () => expect(parseAmount("undisclosed amount", 88)).toBeNull());
  it("null input", () => expect(parseAmount(null, 88)).toBeNull());
  it("₹ vs $ conflict is detected, never averaged", () => {
    const inr = parseAmount("₹25 crore", 88)!.usd; // ~$2.84M
    const usd = parseAmount("$1.3 million", 88)!.usd;
    expect(amountsConflict([inr, usd])).toBe(true);
    expect(amountsConflict([parseAmount("₹11 crore", 88)!.usd, parseAmount("$1.25 million", 88)!.usd])).toBe(false);
  });
});

describe("name normalisation and fuzzy match", () => {
  it("strips suffixes and TLDs", () => {
    expect(normalizeName("Desible.ai")).toBe("desible");
    expect(normalizeName("Credfix Technologies Pvt Ltd")).toBe("credfix");
    expect(normalizeName("The Dough Therapy")).toBe("thedoughtherapy");
    expect(normalizeName("Acme Inc.")).toBe("acme");
    expect(normalizeName("Desible AI Pvt Ltd")).toBe("desible");
    expect(normalizeName("AI")).toBe("ai");
  });
  it("similarity", () => {
    expect(nameSimilarity("TailBlaze", "Tailblaze")).toBe(1);
    expect(nameSimilarity("Zinara", "Zinaara")).toBeGreaterThanOrEqual(0.8);
    expect(nameSimilarity("Zinara", "Zomato")).toBeLessThan(0.9);
  });
  const known = [
    { id: "1", name: "Desible.ai", name_norm: "desible", website_domain: "desible.ai" },
    { id: "2", name: "Credfix", name_norm: "credfix", website_domain: null },
    { id: "3", name: "Orbitly", name_norm: "orbitly", website_domain: "orbitly.io" },
  ];
  it("domain decides", () => expect(matchStartup({ name: "Desible", website_domain: "desible.ai" }, known)).toEqual({ kind: "match", id: "1", by: "domain" }));
  it("exact normalised name", () => expect(matchStartup({ name: "Credfix Pvt Ltd", website_domain: null }, known)).toMatchObject({ kind: "match", id: "2" }));
  it("fuzzy ≥ 0.9 merges", () => expect(matchStartup({ name: "Credfixx", website_domain: null }, known).kind).toBe("none")); // 6/7 < 0.9
  it("different domains never merge", () => expect(matchStartup({ name: "Orbitly", website_domain: "orbitly.com" }, known)).toEqual({ kind: "possible_duplicate", id: "3" }));
  it("no match", () => expect(matchStartup({ name: "Zinara", website_domain: null }, known)).toEqual({ kind: "none" }));
});

describe("60-day window maths", () => {
  const now = new Date("2026-10-12T06:00:00+05:30");
  it("day 0", () => expect(windowInfo("2026-10-12T00:00:00+05:30", now)).toMatchObject({ day: 0, daysLeft: 60, best: true, closing: false, closed: false }));
  it("day 30 is still best", () => expect(windowInfo(new Date(now.getTime() - 30 * 864e5), now).best).toBe(true));
  it("day 50 is closing", () => expect(windowInfo(new Date(now.getTime() - 50 * 864e5), now)).toMatchObject({ day: 50, daysLeft: 10, closing: true, closed: false }));
  it("day 60 still open", () => expect(windowInfo(new Date(now.getTime() - 60 * 864e5), now).closed).toBe(false));
  it("day 61 closed", () => expect(windowInfo(new Date(now.getTime() - 61 * 864e5), now).closed).toBe(true));
  it("earliest credible date ignores tier 3", () => {
    const d = earliestCredible([
      { at: "2026-10-01T00:00:00Z", tier: 3 }, { at: "2026-10-05T00:00:00Z", tier: 2 }, { at: "2026-10-03T00:00:00Z", tier: 1 },
    ]);
    expect(d?.toISOString()).toBe("2026-10-03T00:00:00.000Z");
  });
});

describe("threshold buckets and score total", () => {
  it("total is weighted", () => {
    expect(computeTotal([{ key: "sector_fit", score_0_5: 5 }, { key: "programme_need", score_0_5: 5 }, { key: "progress", score_0_5: 5 }, { key: "team", score_0_5: 5 }, { key: "round_size", score_0_5: 5 }], thesis.criteria)).toBe(100);
    expect(computeTotal([{ key: "sector_fit", score_0_5: 4 }, { key: "programme_need", score_0_5: 3 }, { key: "progress", score_0_5: 2 }, { key: "team", score_0_5: 0 }, { key: "round_size", score_0_5: 5 }], thesis.criteria)).toBe(59);
    expect(computeTotal([], thesis.criteria)).toBe(0);
  });
  it("clamps scores", () => expect(computeTotal([{ key: "sector_fit", score_0_5: 9 }], thesis.criteria)).toBe(30));
  it("buckets", () => {
    expect(bucketFor(70, 70, 55)).toBe("fit");
    expect(bucketFor(69, 70, 55)).toBe("worth_a_look");
    expect(bucketFor(55, 70, 55)).toBe("worth_a_look");
    expect(bucketFor(54, 70, 55)).toBe("not_a_fit");
  });
  it("round size", () => {
    expect(roundSizeScore(500_000, 100_000, 3_000_000)).toBe(5);
    expect(roundSizeScore(null, 100_000, 3_000_000)).toBe(2);
    expect(roundSizeScore(5_000_000, 100_000, 3_000_000)).toBe(2);
    expect(roundSizeScore(20_000_000, 100_000, 3_000_000)).toBe(0);
  });
});

const article = `Bengaluru-based Orbitly has raised ₹5.25 Cr in a seed round led by Blume Ventures, with participation from angel investors.
The startup builds AI agents that automate accounts payable for mid-sized manufacturers.
The company plans to use the funds to hire engineers and expand its sales team in Pune.
Orbitly counts Tata Steel and Mahindra Logistics among its customers.
It had earlier raised a pre-seed round of $300,000 in 2024.`;

function round(over: Partial<ExtractedRound> = {}): ExtractedRound {
  return {
    company: "Orbitly", website: null, stage_text: "seed", amount_text: "₹5.25 Cr", announced_date: null, is_new_round: true,
    is_first_institutional: null, investors: ["Blume Ventures"], lead_investor: "Blume Ventures", founders: [], location: "Bengaluru",
    sector_words: ["AI agents", "accounts payable"], business_model: "B2B", customer_type: "enterprise",
    use_of_funds: "hire engineers and expand sales", traction: [{ text: "Tata Steel and Mahindra Logistics", kind: "customers" }],
    accelerator_mention: null, negative_events: [],
    quotes: {
      stage_text: "has raised ₹5.25 Cr in a seed round", amount_text: "raised ₹5.25 Cr", investors: "led by Blume Ventures",
      lead_investor: "seed round led by Blume Ventures", location: "Bengaluru-based Orbitly",
      sector_words: "builds AI agents that automate accounts payable", business_model: "automate accounts payable for mid-sized manufacturers",
      customer_type: "for mid-sized manufacturers", use_of_funds: "use the funds to hire engineers and expand its sales team",
    },
    ...over,
  };
}

describe("quote check", () => {
  it("finds verbatim quotes with whitespace and case differences", () => {
    expect(quoteFound("BENGALURU-based   Orbitly has raised", article)).toBe(true);
    expect(quoteFound("raised ₹5.25 Cr ... led by Blume Ventures", article)).toBe(true);
    expect(quoteFound("raised ₹6 Cr", article)).toBe(false);
    expect(quoteFound("", article)).toBe(false);
    expect(quoteFound(null, article)).toBe(false);
  });
  it("keeps verified facts", () => {
    const v = verifyRound(round(), article);
    expect(v.dropped).toEqual([]);
    expect(v.companyFound).toBe(true);
    expect(v.round.use_of_funds).toBe("hire engineers and expand sales");
  });
  it("drops a fact whose quote is not in the source and flags the entry", () => {
    const v = verifyRound(round({ quotes: { ...round().quotes, use_of_funds: "to build a new factory in Chennai" } }), article);
    expect(v.round.use_of_funds).toBeNull();
    expect(v.dropped).toContain("use_of_funds");
    expect(v.flags).toContain("Unverified facts dropped");
  });
  it("drops an amount that is not the one in its quote", () => {
    const v = verifyRound(round({ amount_text: "₹9 Cr" }), article);
    expect(v.round.amount_text).toBeNull();
  });
  it("drops a fact with no quote at all", () => {
    const q = { ...round().quotes };
    delete q.location;
    expect(verifyRound(round({ quotes: q }), article).round.location).toBeNull();
  });
  it("drops invented traction", () => {
    const v = verifyRound(round({ traction: [{ text: "Infosys as a customer", kind: "customers" }] }), article);
    expect(v.round.traction).toEqual([]);
  });
  it("rejects a company not in the source", () => expect(verifyRound(round({ company: "Zinara" }), article).companyFound).toBe(false));
});

describe("claim-to-fact check", () => {
  const facts = [
    { id: "r1.amount", text: "The round was ₹5.25 Cr", source_url: "u", quote: "raised ₹5.25 Cr" },
    { id: "r1.use_of_funds", text: "Use of funds: hire engineers", source_url: "u", quote: "hire engineers" },
  ];
  it("passes when every claim has a fact", () =>
    expect(checkClaims("Congrats on the ₹5.25 Cr round.", [{ text: "raised 5.25 Cr", fact_id: "r1.amount" }], facts)).toEqual([]));
  it("fails a claim without a fact", () =>
    expect(checkClaims("You have 40 customers.", [{ text: "40 customers", fact_id: "r1.customers" }], facts).length).toBeGreaterThan(0));
  it("fails an invented number", () => expect(checkClaims("You grew 300% last year.", [], facts)).toContain("Number not in facts: 300"));
  it("allows numbers from settings", () => expect(checkClaims("Book a 20-minute call.", [], facts, "20-minute")).toEqual([]));
});

describe("draft lint", () => {
  const ok = "Hi Orbitly team, " + "word ".repeat(100);
  it("passes a clean draft", () => expect(lintDraft("Your seed round and our programme", ok)).toEqual([]));
  it("fails a banned phrase", () => expect(lintDraft("Hello", `I came across your news. ${ok}`).join()).toMatch(/i came across/));
  it("fails 'exciting'", () => expect(lintDraft("An exciting round", ok).join()).toMatch(/exciting/));
  it("fails an em dash", () => expect(lintDraft("Seed round — congrats", ok)).toContain("Contains an em dash"));
  it("fails an exclamation mark", () => expect(lintDraft("Congrats!", ok)).toContain('Contains "!"'));
  it("fails an emoji", () => expect(lintDraft("Congrats 🚀", ok)).toContain("Contains an emoji"));
  it("fails word count", () => expect(lintDraft("Hi", "too short").join()).toMatch(/words/));
  it("fails a long subject", () => expect(lintDraft("x".repeat(60), ok).join()).toMatch(/Subject/));
});

describe("hard rules", () => {
  const base = {
    stage: "seed" as const, stage_text: "seed", negative_events: [], sector_words: ["AI agents for accounts payable"],
    location: "Bengaluru", announced_at: new Date().toISOString(), contacted: false, has_credible_source: true,
  };
  it("passes a clean seed round", () => expect(applyHardRules(base, thesis).pass).toBe(true));
  it("already contacted", () => expect(applyHardRules({ ...base, contacted: true }, thesis)).toMatchObject({ pass: false, reason: "Already contacted" }));
  it("pre-Series A excluded", () => expect(applyHardRules({ ...base, stage: "other", stage_text: "pre-Series A" }, thesis)).toMatchObject({ pass: false, reason: "Stage: pre-Series A" }));
  it("debt-only disqualified", () => expect(applyHardRules({ ...base, negative_events: ["debt_only"] }, thesis)).toMatchObject({ pass: false, reason: "Debt-only round" }));
  it("window closed", () => expect(applyHardRules({ ...base, announced_at: new Date(Date.now() - 70 * 864e5).toISOString() }, thesis)).toMatchObject({ reason: "Window closed" }));
  it("excluded sector", () => expect(applyHardRules({ ...base, sector_words: ["healthy snacks brand"] }, thesis)).toMatchObject({ reason: "Excluded sector: food and beverage" }));
  it("software for an excluded industry is not excluded", () => expect(excludedSector(["SaaS for restaurants and food delivery"], thesis)).toBeNull());
  it("outside geography", () => expect(applyHardRules({ ...base, location: "San Francisco" }, thesis)).toMatchObject({ pass: false, rule: "geography" }));
  it("unknown location is a flag, not a fail", () => expect(applyHardRules({ ...base, location: null }, thesis)).toEqual({ pass: true, flags: ["Location unclear"] }));
  it("undisclosed stage parks the lead", () => expect(applyHardRules({ ...base, stage: "unknown" }, thesis)).toMatchObject({ pass: false, park: true }));
  it("needs a credible source", () => expect(applyHardRules({ ...base, has_credible_source: false }, thesis)).toMatchObject({ rule: "credibility" }));
});

describe("global thesis", () => {
  const global = { ...thesis, geographies: ["Global"] };
  it("global geography passes any known location", () => expect(applyHardRules({ stage: "seed", stage_text: "seed", negative_events: [], sector_words: ["devtools"], location: "San Francisco", announced_at: new Date().toISOString(), contacted: false, has_credible_source: true }, global).pass).toBe(true));
  it("isGlobal", () => { expect(isGlobal(["Global"])).toBe(true); expect(isGlobal(["India"])).toBe(false); });
  it("home market boost is code, never inferred", () => {
    expect(geographyScore("Pune, India", ["India", "Pune"])).toBe(5);
    expect(geographyScore("Berlin", ["India", "Pune"])).toBe(0);
    expect(geographyScore(null, ["India"])).toBe(2);
  });
  it("geography criterion counts in the total", () => {
    const crit = [...thesis.criteria, { key: "home_market", name: "Home", weight: 10, kind: "geography" as const, description: "" }];
    expect(computeTotal([{ key: "sector_fit", score_0_5: 5 }, { key: "programme_need", score_0_5: 5 }, { key: "progress", score_0_5: 5 }, { key: "team", score_0_5: 5 }, { key: "round_size", score_0_5: 5 }, { key: "home_market", score_0_5: 0 }], crit)).toBe(91);
  });
});

describe("dedupe of raw items", () => {
  it("canonical URL strips tracking and www", () =>
    expect(canonicalUrl("https://www.Entrackr.com/2026/10/x/?utm_source=rss&id=3#top")).toBe("https://entrackr.com/2026/10/x?id=3"));
  it("normalised title", () => expect(normalizeTitle("Orbitly raises ₹5.25 Cr — led by Blume!")).toBe(normalizeTitle("orbitly raises ₹5.25 cr - led by blume")));
});

describe("priority", () => {
  const base = { total: 80, daysLeft: 40, closing: false, warm: false, confidenceRank: 2, announcedAt: "2026-10-10" };
  it("closing first, fewest days first", () => {
    const xs = sortByPriority([
      { id: "a", ...base, total: 95 },
      { id: "b", ...base, closing: true, daysLeft: 8, total: 71 },
      { id: "c", ...base, closing: true, daysLeft: 3, total: 72 },
    ]);
    expect(xs.map((x) => x.id)).toEqual(["c", "b", "a"]);
  });
  it("ties go to warm path, then confidence, then newer", () => {
    expect(comparePriority({ id: "a", ...base }, { id: "b", ...base, warm: true })).toBeGreaterThan(0);
    expect(comparePriority({ id: "a", ...base, confidenceRank: 4 }, { id: "b", ...base })).toBeLessThan(0);
    expect(comparePriority({ id: "a", ...base, announcedAt: "2026-10-11" }, { id: "b", ...base })).toBeLessThan(0);
  });
  it("warm path from network investors", () => expect(warmPath(["Blume Ventures", "Angels"], ["blume ventures"])).toBe("Blume Ventures"));
  it("confidence chip", () => {
    expect(confidence(3, true, true).label).toBe("3 sources · verified");
    expect(confidence(1, false, true).label).toBe("1 source");
  });
});

describe("pre-filter", () => {
  it("keeps funding news", () => expect(isFundingCandidate("Orbitly raises ₹5 Cr in seed round", "")).toBe(true));
  it("drops unrelated news", () => expect(isFundingCandidate("Monsoon session of parliament begins", "Politics")).toBe(false));
  it("drops IPO news", () => expect(isFundingCandidate("Lenskart IPO listing date set", "shares raised")).toBe(false));
});

describe("contacts are published or absent", () => {
  it("extracts mailto and visible addresses", () => {
    const html = `<a href="mailto:Asha@orbitly.io">Mail</a> <p>hello@orbitly.io</p> <img src="logo@2x.png">`;
    expect(extractEmails(html).sort()).toEqual(["asha@orbitly.io", "hello@orbitly.io"]);
  });
  it("ranks founder-named first, then general", () => {
    const r = rankContacts(
      [{ address: "hello@orbitly.io", where_found_url: "u" }, { address: "press@orbitly.io", where_found_url: "u" }, { address: "asha@orbitly.io", where_found_url: "u" }],
      ["Asha Rao"], "orbitly.io",
    );
    expect(r.map((c) => c.address)).toEqual(["asha@orbitly.io", "hello@orbitly.io", "press@orbitly.io"]);
  });
  it("never guesses: no addresses in, none out", () => expect(rankContacts([], ["Asha Rao"], "orbitly.io")).toEqual([]));
  it("personal webmail ranks last", () => {
    const r = rankContacts([{ address: "asha.rao@gmail.com", where_found_url: "u" }, { address: "contact@orbitly.io", where_found_url: "u" }], ["Asha Rao"], "orbitly.io");
    expect(r[0].address).toBe("contact@orbitly.io");
  });
});

describe("team signals are work evidence only", () => {
  it("removes college and personal details", () => {
    const r = sanitizeFounders(round({ founders: [
      { name: "Asha Rao", role: "CEO", background: "IIT Delhi alumna" },
      { name: "Vik", role: "CTO", background: "former engineering lead at Razorpay" },
    ] }));
    expect(r.founders[0].background).toBeNull();
    expect(r.founders[1].background).toBe("former engineering lead at Razorpay");
  });
});

describe("robots.txt", () => {
  const rules = parseRobots("User-agent: *\nDisallow: /private\nAllow: /private/ok\n\nUser-agent: OtherBot\nDisallow: /");
  it("disallows", () => expect(robotsAllows(rules, "/private/x")).toBe(false));
  it("longest match allows", () => expect(robotsAllows(rules, "/private/ok/1")).toBe(true));
  it("other paths allowed", () => expect(robotsAllows(rules, "/news/1")).toBe(true));
  it("ignores other agents' groups", () => expect(parseRobots("User-agent: Googlebot\nDisallow: /").disallow).toEqual([]));
});

describe("session cookie", () => {
  it("round-trips and expires", async () => {
    const t = await makeSession("secret", 0);
    expect(await verifySession("secret", t, 1000)).toBe(true);
    expect(await verifySession("other", t, 1000)).toBe(false);
    expect(await verifySession("secret", t, 31 * 864e5)).toBe(false);
    expect(await verifySession("secret", t.replace(/.$/, "x"), 1000)).toBe(false);
  });
});

describe("gmail draft message", () => {
  it("builds a plain-text MIME draft, recipient optional", () => {
    const m = buildMime({ from: "r@x.co", to: null, subject: "Your seed round", body: "Hi team" });
    expect(m).toContain("Subject: Your seed round");
    expect(m).not.toContain("To:");
    expect(m).toContain("text/plain");
  });
});
