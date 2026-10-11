/** One line per chip. Used for tooltips and the Help guide so they always match (PRD §10.5). */
export const CHIP_HELP: Record<string, { tone: string; help: string }> = {
  Closing: { tone: "amber", help: "Ten days or fewer left in the 60-day window." },
  "Worth a look": { tone: "blue", help: "Scored between the review and fit thresholds." },
  "One source": { tone: "grey", help: "Only one outlet has reported this round so far." },
  "Conflicting amounts": { tone: "red", help: "Sources disagree on the amount. Both are shown." },
  "Conflicting stage": { tone: "red", help: "Sources disagree on the stage." },
  "Older thesis": { tone: "violet", help: "Scored on an earlier thesis version." },
  "Find contact": { tone: "amber", help: "No published address. Add the recipient in Gmail." },
  Sample: { tone: "grey", help: "Example for the tour. Never saved or drafted." },
  verified: { tone: "green", help: "Every quote was found in its source." },
  "First institutional round": { tone: "green", help: "The source says this is the first money from a fund." },
  "Named customers": { tone: "green", help: "The source names customers, pilots or partners." },
  "Use of funds": { tone: "green", help: "The source states what the money is for." },
  "Warm path": { tone: "blue", help: "An investor in this round is on your network list." },
  "Location unclear": { tone: "grey", help: "No source states where the company is based." },
  "No website found": { tone: "grey", help: "No source names a website. Add one to research it." },
  "No website facts": { tone: "grey", help: "The website could not be read. Draft uses news facts only." },
  "Possible duplicate": { tone: "amber", help: "A similar name exists with a different website." },
  "Injection suspected": { tone: "red", help: "A source contained instructions aimed at software. Ignored." },
  "In another accelerator": { tone: "amber", help: "A source says the company is already in an accelerator." },
  "Unverified facts dropped": { tone: "grey", help: "Facts without a matching quote were removed." },
  "Already contacted": { tone: "grey", help: "An outreach record exists. Never drafted again." },
};

export const HELP_ORDER = ["Closing", "Worth a look", "One source", "Conflicting amounts", "Older thesis", "Find contact", "Sample"];

export function chipMeta(label: string): { tone: string; help: string | null } {
  if (label.startsWith("Warm path")) return { tone: CHIP_HELP["Warm path"].tone, help: CHIP_HELP["Warm path"].help };
  if (/sources? · verified$/.test(label)) return { tone: "green", help: "Number of outlets. Every quote was found in its source." };
  if (/^\d+ sources?$/.test(label)) return { tone: "grey", help: "Number of outlets reporting this round." };
  const m = CHIP_HELP[label];
  return m ? { tone: m.tone, help: m.help } : { tone: "grey", help: null };
}
