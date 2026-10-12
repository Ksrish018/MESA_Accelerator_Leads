// Applies supabase/migrations/20261012000200_global.sql through the service-role REST API
// (data only: sources, publishers, settings line, thesis v2). Idempotent.
const U = `${process.env.SUPABASE_URL}/rest/v1`;
const H = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
const req = async (method, path, body, prefer = "return=minimal") => {
  const r = await fetch(`${U}/${path}`, { method, headers: { ...H, Prefer: prefer }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${t}`);
  return t ? JSON.parse(t) : null;
};
const india = ["India","Bengaluru","Bangalore","Mumbai","Delhi","New Delhi","Gurugram","Gurgaon","Noida","Hyderabad","Chennai","Pune","Kolkata","Ahmedabad","Jaipur","Kochi","Indore","Chandigarh","Coimbatore","Thiruvananthapuram","Bhubaneswar","Lucknow","Surat","Goa"];
const sources = [
  ["Crunchbase News","https://news.crunchbase.com/feed/","rss",2,"US"],["TechCrunch · Startups","https://techcrunch.com/category/startups/feed/","rss",2,"US"],
  ["Tech.eu","https://tech.eu/feed/","rss",2,"EU"],["Sifted","https://sifted.eu/feed","rss",2,"EU"],["EU-Startups","https://www.eu-startups.com/feed/","rss",2,"EU"],
  ["e27","https://e27.co/feed/","rss",2,"SEA"],["Tech in Asia","https://www.techinasia.com/feed","rss",2,"SEA"],["FinSMEs","https://www.finsmes.com/feed","rss",2,"GLOBAL"],
  ["TechCabal","https://techcabal.com/feed/","rss",2,"AFRICA"],["Disrupt Africa","https://disruptafrica.com/feed/","rss",2,"AFRICA"],["Contxto","https://contxto.com/en/feed/","rss",2,"LATAM"],
  ["Silicon Canals","https://siliconcanals.com/feed/","rss",2,"EU"],
  ["GlobeNewswire · Venture capital","https://www.globenewswire.com/RssFeed/industry/9576-Venture%20Capital/feedTitle/GlobeNewswire%20-%20Venture%20Capital","press",1,"GLOBAL"],
  ["Google News · global seed","https://news.google.com/rss/search?q=%22seed+round%22+OR+%22pre-seed%22+startup+raises+when:1d&hl=en-US&gl=US&ceid=US:en","google_news",3,"GLOBAL"],
  ["Google News · Europe seed","https://news.google.com/rss/search?q=startup+%22seed+round%22+when:1d&hl=en-GB&gl=GB&ceid=GB:en","google_news",3,"EU"],
  ["Google News · Asia seed","https://news.google.com/rss/search?q=startup+%22seed+funding%22+when:1d&hl=en-SG&gl=SG&ceid=SG:en","google_news",3,"SEA"],
].map(([name,url,kind,tier,country]) => ({ name, url, kind, tier, country, enabled: true }));
const publishers = [
  ["news.crunchbase.com","Crunchbase News",2],["tech.eu","Tech.eu",2],["sifted.eu","Sifted",2],["eu-startups.com","EU-Startups",2],["e27.co","e27",2],
  ["techinasia.com","Tech in Asia",2],["finsmes.com","FinSMEs",2],["techcabal.com","TechCabal",2],["disruptafrica.com","Disrupt Africa",2],["contxto.com","Contxto",2],
  ["siliconcanals.com","Silicon Canals",2],["venturebeat.com","VentureBeat",2],["geekwire.com","GeekWire",2],["axios.com","Axios",2],["reuters.com","Reuters",2],
  ["fortune.com","Fortune",2],["siliconrepublic.com","Silicon Republic",2],["techfundingnews.com","Tech Funding News",2],["uktech.news","UKTN",2],["wamda.com","Wamda",2],
  ["dealstreetasia.com","DealStreetAsia",2],["startupdaily.net","Startup Daily",2],["prnewswire.co.uk","PR Newswire",1],["einpresswire.com","EIN Presswire",0],
].map(([domain,name,tier]) => ({ domain, name, tier }));

await req("POST", "sources?on_conflict=name", sources, "resolution=ignore-duplicates,return=minimal");
await req("POST", "publishers?on_conflict=domain", publishers, "resolution=ignore-duplicates,return=minimal");
await req("PATCH", "settings?id=eq.1", { programme_line: "a 12-week programme for pre-seed and seed B2B and AI founders, run from India with a global network" });
const v = await req("GET", "thesis_versions?select=*&order=version.desc", null, "");
if (!v.some((t) => t.version === 2)) {
  const v1 = v.find((t) => t.version === 1);
  const { id, created_at, ...base } = v1;
  await req("PATCH", "thesis_versions?is_active=eq.true", { is_active: false });
  await req("POST", "thesis_versions", {
    ...base, version: 2, is_active: true, note: "Global startup network: any geography, India as a small boost", geographies: ["Global"],
    criteria: [...v1.criteria, { key: "home_market", name: "Home market: India", weight: 10, kind: "geography", match: india, description: "Based in India. A small boost; companies elsewhere still qualify." }],
  });
}
const after = await req("GET", "thesis_versions?select=version,is_active,geographies&order=version", null, "");
const n = await req("GET", "sources?select=name&enabled=eq.true", null, "");
console.log("thesis:", JSON.stringify(after), "| enabled sources:", n.length);
