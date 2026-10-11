/**
 * Code pre-filter before any AI call (PRD §5.2): keep items whose title or
 * summary mentions funding terms. Cheap, generous on recall.
 */
const FUNDING =
  /\b(raises?|raised|raising|funding|funded|round|seed|pre-seed|preseed|angel|backed|led by|investment|invests?|secures?|secured|bags?|nets?|closes?)\b|₹|\$\s?\d|\b\d+(\.\d+)?\s?(cr|crore|mn|million|lakh|bn|m|k)\b/i;

const NOISE = /\b(ipo|listing|shares? (rose|fell|jump)|quarterly results|q[1-4] results|stock price|sensex|nifty)\b/i;

export function isFundingCandidate(title: string, summary: string): boolean {
  const t = `${title} ${summary}`;
  if (!FUNDING.test(t)) return false;
  if (NOISE.test(title)) return false;
  return true;
}
