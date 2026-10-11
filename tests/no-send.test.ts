import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * The no-send guard (CLAUDE.md non-negotiable 5, PRD §11). The app may only
 * create, read and delete Gmail drafts. Any delivery path fails the build.
 */
const FORBIDDEN = [
  "drafts.send",
  "drafts/send",
  "messages.send",
  "messages/send",
  "/send\"",
  "smtp",
  "nodemailer",
  "resend",
  "sendgrid",
  "mailgun",
  "postmark",
  "sendmail",
  "gmail.send",
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("no-send guard", () => {
  const files = walk(path.resolve(__dirname, "../src")).filter((f) => /\.(ts|tsx|js|mjs|json)$/.test(f));

  it("scans the source tree", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  for (const term of FORBIDDEN) {
    it(`never references "${term}" in src/`, () => {
      const hits = files.filter((f) => readFileSync(f, "utf8").toLowerCase().includes(term));
      expect(hits).toEqual([]);
    });
  }

  it("requests only the gmail.compose scope", () => {
    const scopes = files.flatMap((f) => readFileSync(f, "utf8").match(/googleapis\.com\/auth\/[a-z.]+/g) ?? []);
    for (const s of scopes) expect(s).toBe("googleapis.com/auth/gmail.compose");
  });

  it("package.json has no mail-delivery dependency", () => {
    const pkg = readFileSync(path.resolve(__dirname, "../package.json"), "utf8").toLowerCase();
    for (const dep of ["nodemailer", "resend", "sendgrid", "mailgun", "postmark"]) expect(pkg.includes(`"${dep}`)).toBe(false);
  });

  it("never calls the Claude API or any non-Gemini LLM", () => {
    const hits = files.filter((f) => /api\.anthropic\.com|@anthropic-ai|api\.openai\.com|openai"/i.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });
});
