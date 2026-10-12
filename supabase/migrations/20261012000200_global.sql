-- Global startup network (owner decision, 12 Oct 2026): global sources, global
-- publisher allowlist and thesis v2 (geography Global, India as a small boost).
-- Data only; no schema change. Applied through the service-role API.

insert into sources (name, url, kind, tier, country, enabled) values
  ('Crunchbase News', 'https://news.crunchbase.com/feed/', 'rss', 2, 'US', true),
  ('TechCrunch · Startups', 'https://techcrunch.com/category/startups/feed/', 'rss', 2, 'US', true),
  ('Tech.eu', 'https://tech.eu/feed/', 'rss', 2, 'EU', true),
  ('Sifted', 'https://sifted.eu/feed', 'rss', 2, 'EU', true),
  ('EU-Startups', 'https://www.eu-startups.com/feed/', 'rss', 2, 'EU', true),
  ('e27', 'https://e27.co/feed/', 'rss', 2, 'SEA', true),
  ('Tech in Asia', 'https://www.techinasia.com/feed', 'rss', 2, 'SEA', true),
  ('FinSMEs', 'https://www.finsmes.com/feed', 'rss', 2, 'GLOBAL', true),
  ('TechCabal', 'https://techcabal.com/feed/', 'rss', 2, 'AFRICA', true),
  ('Disrupt Africa', 'https://disruptafrica.com/feed/', 'rss', 2, 'AFRICA', true),
  ('Contxto', 'https://contxto.com/en/feed/', 'rss', 2, 'LATAM', true),
  ('Silicon Canals', 'https://siliconcanals.com/feed/', 'rss', 2, 'EU', true),
  ('GlobeNewswire · Venture capital', 'https://www.globenewswire.com/RssFeed/industry/9576-Venture%20Capital/feedTitle/GlobeNewswire%20-%20Venture%20Capital', 'press', 1, 'GLOBAL', true),
  ('Google News · global seed', 'https://news.google.com/rss/search?q=%22seed+round%22+OR+%22pre-seed%22+startup+raises+when:1d&hl=en-US&gl=US&ceid=US:en', 'google_news', 3, 'GLOBAL', true),
  ('Google News · Europe seed', 'https://news.google.com/rss/search?q=startup+%22seed+round%22+when:1d&hl=en-GB&gl=GB&ceid=GB:en', 'google_news', 3, 'EU', true),
  ('Google News · Asia seed', 'https://news.google.com/rss/search?q=startup+%22seed+funding%22+when:1d&hl=en-SG&gl=SG&ceid=SG:en', 'google_news', 3, 'SEA', true)
on conflict (name) do nothing;

insert into publishers (domain, name, tier) values
  ('news.crunchbase.com', 'Crunchbase News', 2), ('tech.eu', 'Tech.eu', 2), ('sifted.eu', 'Sifted', 2),
  ('eu-startups.com', 'EU-Startups', 2), ('e27.co', 'e27', 2), ('techinasia.com', 'Tech in Asia', 2),
  ('finsmes.com', 'FinSMEs', 2), ('techcabal.com', 'TechCabal', 2), ('disruptafrica.com', 'Disrupt Africa', 2),
  ('contxto.com', 'Contxto', 2), ('siliconcanals.com', 'Silicon Canals', 2), ('venturebeat.com', 'VentureBeat', 2),
  ('geekwire.com', 'GeekWire', 2), ('axios.com', 'Axios', 2), ('reuters.com', 'Reuters', 2), ('fortune.com', 'Fortune', 2),
  ('siliconrepublic.com', 'Silicon Republic', 2), ('techfundingnews.com', 'Tech Funding News', 2), ('uktech.news', 'UKTN', 2),
  ('wamda.com', 'Wamda', 2), ('dealstreetasia.com', 'DealStreetAsia', 2), ('startupdaily.net', 'Startup Daily', 2),
  ('techcrunch.com', 'TechCrunch', 2), ('businesswire.com', 'Business Wire', 1), ('globenewswire.com', 'GlobeNewswire', 1),
  ('prnewswire.co.uk', 'PR Newswire', 1), ('einpresswire.com', 'EIN Presswire', 0)
on conflict (domain) do nothing;

update settings set programme_line = 'a 12-week programme for pre-seed and seed B2B and AI founders, run from India with a global network' where id = 1;

update thesis_versions set is_active = false where is_active;
insert into thesis_versions (
  version, is_active, note, stages, geographies, include_sectors, exclude_sectors, sector_keywords,
  min_round_usd, max_round_usd, disqualifiers, criteria, fit_threshold, review_threshold, closing_days, window_days, email_tone_notes
)
select 2, true, 'Global startup network: any geography, India as a small boost',
  stages, array['Global'], include_sectors, exclude_sectors, sector_keywords, min_round_usd, max_round_usd, disqualifiers,
  criteria || '[{"key": "home_market", "name": "Home market: India", "weight": 10, "kind": "geography",
    "match": ["India", "Bengaluru", "Bangalore", "Mumbai", "Delhi", "New Delhi", "Gurugram", "Gurgaon", "Noida", "Hyderabad", "Chennai", "Pune", "Kolkata", "Ahmedabad", "Jaipur", "Kochi", "Indore", "Chandigarh", "Coimbatore", "Thiruvananthapuram", "Bhubaneswar", "Lucknow", "Surat", "Goa"],
    "description": "Based in India. A small boost; companies elsewhere still qualify."}]'::jsonb,
  fit_threshold, review_threshold, closing_days, window_days, email_tone_notes
from thesis_versions where version = 1
on conflict (version) do nothing;
