import "server-only";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

export const env = {
  supabaseUrl: () => req("SUPABASE_URL"),
  supabaseKey: () => req("SUPABASE_SERVICE_ROLE_KEY"),
  geminiKey: () => req("GEMINI_API_KEY"),
  geminiModel: () => process.env.GEMINI_MODEL || "gemini-3.8-flash",
  cronSecret: () => req("CRON_SECRET"),
  appPassword: () => req("APP_PASSWORD"),
  sessionSecret: () => req("SESSION_SECRET"),
  google: () => ({
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN ?? "",
    sender: process.env.GMAIL_SENDER ?? "",
  }),
  has: (name: string) => !!process.env[name],
};

export const USER_AGENT = "FundingRadar/1.0 (accelerator outreach research; respects robots.txt)";
