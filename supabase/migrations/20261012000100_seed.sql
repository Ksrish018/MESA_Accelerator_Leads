-- Seed data: thesis v1 (PRD §7.1), settings (§0 decided defaults), stage map (§5.4),
-- sources (§6.2) and the publisher allowlist (§6.1). Everything here is editable in Supabase.

insert into thesis_versions (
  version, is_active, note, stages, geographies, include_sectors, exclude_sectors, sector_keywords,
  min_round_usd, max_round_usd, disqualifiers, criteria, fit_threshold, review_threshold, closing_days,
  window_days, email_tone_notes
) values (
  1, true, 'Starting thesis',
  array['pre_seed', 'seed'],
  array['India', 'Bengaluru', 'Bangalore', 'Mumbai', 'Delhi', 'New Delhi', 'Gurugram', 'Gurgaon', 'Noida',
        'Hyderabad', 'Chennai', 'Pune', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Kochi', 'Indore', 'Chandigarh',
        'Coimbatore', 'Thiruvananthapuram', 'Bhubaneswar', 'Lucknow', 'Surat', 'Goa'],
  array['B2B SaaS', 'applied AI and vertical AI', 'developer tools and AI infrastructure', 'fintech infrastructure (B2B)'],
  array['consumer D2C brands', 'food and beverage', 'real estate', 'crypto tokens', 'gambling', 'lending NBFCs'],
  '{
    "consumer D2C brands": ["d2c", "direct-to-consumer", "direct to consumer", "consumer brand", "apparel", "fashion brand", "beauty brand", "skincare", "cosmetics", "personal care brand", "jewellery brand", "footwear brand"],
    "food and beverage": ["food", "beverage", "f&b", "restaurant", "cafe", "bakery", "snack", "snacks", "cloud kitchen", "dessert", "coffee brand", "tea brand", "dairy", "packaged food"],
    "real estate": ["real estate", "property developer", "co-living", "coliving", "housing developer"],
    "crypto tokens": ["crypto", "cryptocurrency", "token", "web3", "blockchain", "nft", "defi"],
    "gambling": ["gambling", "betting", "casino", "real-money gaming", "real money gaming"],
    "lending NBFCs": ["nbfc", "non-banking financial", "microfinance", "lender", "lending platform", "loan disbursal"]
  }'::jsonb,
  100000, 3000000,
  array['acquired', 'shutdown', 'debt_only', 'grant_only', 'not_a_startup'],
  '[
    {"key": "sector_fit", "name": "Sector and business-model fit", "weight": 30, "kind": "ai",
     "description": "Builds B2B SaaS, applied or vertical AI, developer tools or AI infrastructure, or B2B fintech infrastructure. Businesses or developers pay."},
    {"key": "programme_need", "name": "Programme need", "weight": 20, "kind": "ai",
     "description": "Stated use of funds matches what the programme offers: hiring, go-to-market, product, expansion. First institutional round. Not already in another accelerator."},
    {"key": "progress", "name": "Evidence of progress", "weight": 20, "kind": "ai",
     "description": "A live product, named customers, pilots or partners, revenue or user numbers, a recent launch. Score 0 when the sources show none."},
    {"key": "team", "name": "Team, from work evidence", "weight": 15, "kind": "ai",
     "description": "Work-related evidence only: technical or engineering background, a prior startup, stated domain experience. Never college, age, gender, religion, caste, family or photos."},
    {"key": "round_size", "name": "Round size in range", "weight": 15, "kind": "round_size",
     "description": "Round between the thesis minimum and maximum in USD."}
  ]'::jsonb,
  70, 55, 10, 60,
  'Plain, specific and short. No flattery. Write like a programme lead who has read the announcement.'
) on conflict (version) do nothing;

insert into settings (
  id, accelerator_name, programme_line, programme_offers, application_link, signer_name, signer_title,
  signature, booking_link, timezone, network_investors, usd_inr_rate
) values (
  1, 'Your Accelerator',
  'a 12-week programme for pre-seed and seed B2B and AI founders in India',
  array['hiring support', 'go-to-market and first enterprise customers', 'product mentorship',
        'investor introductions for the next round', 'cloud and AI credits'],
  'https://example.com/apply',
  'Rohit', 'Programme Lead',
  E'Rohit\nProgramme Lead, Your Accelerator',
  'https://example.com/20-min-call',
  'Asia/Kolkata',
  array['Antler', 'Blume Ventures', 'Kalaari Capital', '100X.VC', 'Better Capital', 'Accel', 'Elevation Capital',
        'Lightspeed', 'Peak XV', 'Stellaris Venture Partners', 'Chiratae Ventures', 'Inflection Point Ventures',
        'Venture Catalysts', 'Java Capital', 'Titan Capital', 'Speciale Invest', 'Arkam Ventures', 'Prime Venture Partners'],
  88
) on conflict (id) do nothing;

insert into stage_map (label, stage) values
  ('pre-seed', 'pre_seed'), ('pre seed', 'pre_seed'), ('preseed', 'pre_seed'), ('angel', 'pre_seed'),
  ('angel round', 'pre_seed'), ('pre-seed round', 'pre_seed'), ('friends and family', 'pre_seed'),
  ('seed', 'seed'), ('seed round', 'seed'), ('seed funding', 'seed'), ('seed extension', 'seed'),
  ('seed-plus', 'seed'), ('seed plus', 'seed'), ('seed+', 'seed'), ('pre-series a', 'other'),
  ('pre series a', 'other'), ('bridge', 'other'), ('bridge round', 'other'), ('series a', 'other'),
  ('series a+', 'other'), ('series b', 'other'), ('series c', 'other'), ('series d', 'other'),
  ('growth', 'other'), ('ipo', 'other'), ('debt', 'other'), ('venture debt', 'other'),
  ('undisclosed', 'unknown'), ('unknown', 'unknown')
on conflict (label) do nothing;

insert into sources (name, url, kind, tier, country, enabled) values
  ('Entrackr', 'https://entrackr.com/rss', 'rss', 2, 'IN', true),
  ('PR Newswire · Venture capital', 'https://www.prnewswire.com/rss/financial-services-latest-news/venture-capital-list.rss', 'press', 1, 'US', true),
  ('TechCrunch · Venture', 'https://techcrunch.com/category/venture/feed/', 'rss', 2, 'US', true),
  ('YourStory', 'https://yourstory.com/feed', 'rss', 2, 'IN', true),
  ('Inc42', 'https://inc42.com/feed/', 'rss', 2, 'IN', true),
  ('Google News · pre-seed or seed', 'https://news.google.com/rss/search?q=%22pre-seed%22+OR+%22seed+round%22+when:1d&hl=en-IN&gl=IN&ceid=IN:en', 'google_news', 3, 'IN', true),
  ('Google News · startup raises seed India', 'https://news.google.com/rss/search?q=startup+raises+seed+funding+India+when:1d&hl=en-IN&gl=IN&ceid=IN:en', 'google_news', 3, 'IN', true),
  ('ET Tech', 'https://economictimes.indiatimes.com/tech/rssfeeds/13357270.cms', 'rss', 2, 'IN', true),
  ('VCCircle', 'https://www.vccircle.com/rss', 'rss', 2, 'IN', true),
  ('Moneycontrol · Startups', 'https://www.moneycontrol.com/rss/business.xml', 'rss', 2, 'IN', true)
on conflict (name) do nothing;

insert into publishers (domain, name, tier) values
  ('prnewswire.com', 'PR Newswire', 1), ('businesswire.com', 'Business Wire', 1),
  ('globenewswire.com', 'GlobeNewswire', 1), ('pib.gov.in', 'PIB', 1),
  ('entrackr.com', 'Entrackr', 2), ('inc42.com', 'Inc42', 2), ('yourstory.com', 'YourStory', 2),
  ('economictimes.indiatimes.com', 'Economic Times', 2), ('economictimes.com', 'Economic Times', 2),
  ('livemint.com', 'Mint', 2), ('business-standard.com', 'Business Standard', 2),
  ('moneycontrol.com', 'Moneycontrol', 2), ('techcrunch.com', 'TechCrunch', 2),
  ('vccircle.com', 'VCCircle', 2), ('thehindubusinessline.com', 'BusinessLine', 2),
  ('financialexpress.com', 'Financial Express', 2), ('the-ken.com', 'The Ken', 2),
  ('linkedin.com', 'LinkedIn', 0)
on conflict (domain) do nothing;
