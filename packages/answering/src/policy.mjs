const ACCOUNT_PATTERNS = [
  /\bmy (?:account|bill|invoice|deployment|transaction|logs?|worker|project)\b/i,
  /\bwhat happened (?:to|in) my\b/i,
  /\bat \d{1,2}:\d{2}\b/i
];
const UNSAFE_PATTERNS = [
  /reveal (?:the )?(?:system prompt|hidden instructions|secret|credentials?)/i,
  /ignore (?:all )?(?:previous|system) instructions/i,
  /another (?:customer|tenant)'?s/i,
  /(?:127\.0\.0\.1|169\.254\.169\.254|localhost)/i,
  /delete (?:the )?repository/i,
  /invent (?:a )?citation/i
];
const OUT_OF_SCOPE_PATTERNS = [
  /\bguarantee\b.*\bsecure\b/i,
  /\bobjectively best\b/i,
  /\broadmap\b|next major version/i
];

export function classifyQuestion(query) {
  if (UNSAFE_PATTERNS.some((pattern) => pattern.test(query))) return { state: 'unsafe_or_untrusted', reason: 'unsafe-boundary' };
  if (ACCOUNT_PATTERNS.some((pattern) => pattern.test(query))) return { state: 'account_specific', reason: 'private-state-required' };
  if (OUT_OF_SCOPE_PATTERNS.some((pattern) => pattern.test(query))) return { state: 'out_of_scope', reason: 'outside-documentation-contract' };
  const version = query.match(/\b(?:v|version\s*)(\d+(?:\.\d+)*)\b/i)?.[1] ?? null;
  const runtime = query.match(/\b(cloudflare(?: workers)?|node(?:\.js)?|bun|deno)\b/i)?.[1]?.toLowerCase() ?? null;
  return { state: null, version, runtime };
}
