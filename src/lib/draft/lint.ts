/** Draft lint (PRD §5.7). Pure. A failed draft is regenerated once with these errors. */

export const BANNED_PHRASES = [
  "i hope this email finds you well",
  "i came across",
  "i wanted to reach out",
  "exciting",
  "excited",
  "thrilled",
  "game-changer",
  "game changer",
  "revolutionise",
  "revolutionize",
  "revolutionary",
  "cutting-edge",
  "cutting edge",
  "leverage",
  "synergy",
  "delve",
  "innovative solution",
  "in today's fast-paced",
  "unlock",
  "empower",
  "seamless",
];

const EMOJI = /\p{Extended_Pictographic}/u;

export const WORDS_MIN = 90;
export const WORDS_MAX = 140;
export const SUBJECT_MAX = 60;

export function wordCount(s: string): number {
  return s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export function lintDraft(subject: string, body: string): string[] {
  const errors: string[] = [];
  const text = `${subject}\n${body}`;
  const lower = text.toLowerCase().replace(/[‘’]/g, "'");
  for (const p of BANNED_PHRASES) {
    const re = new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+")}`, "i");
    if (re.test(lower)) errors.push(`Banned phrase: "${p}"`);
  }
  if (text.includes("—")) errors.push("Contains an em dash");
  if (EMOJI.test(text)) errors.push("Contains an emoji");
  if (text.includes("!")) errors.push('Contains "!"');
  if (subject.length >= SUBJECT_MAX) errors.push(`Subject is ${subject.length} characters (under ${SUBJECT_MAX})`);
  if (!subject.trim()) errors.push("Subject is empty");
  const n = wordCount(body);
  if (n < WORDS_MIN || n > WORDS_MAX) errors.push(`Body is ${n} words (${WORDS_MIN} to ${WORDS_MAX})`);
  return errors;
}
