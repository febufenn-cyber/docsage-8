const ACCOUNT_PATTERNS = [
  /\bmy (?:account|bill|invoice|deployment|transaction|logs?|worker|project)\b/i,
  /\bwhat happened (?:to|in) my\b/i,
  /\bat \d{1,2}:\d{2}\b/i,
  /\bhow much did my\b/i,
  /\bwhich cloudflare account\b/i
];
const UNSAFE_PATTERNS = [
  /reveal (?:the )?(?:system prompt|hidden instructions|secret|credentials?)/i,
  /ignore (?:all )?(?:previous|system) (?:instructions|rules)/i,
  /another (?:customer|tenant)'?s/i,
  /(?:127\.0\.0\.1|169\.254\.169\.254|localhost)/i,
  /delete (?:the )?repository/i,
  /invent (?:a )?citation/i,
  /bypass.*allowed[- ]domain/i,
  /widget credential/i,
  /retrieve cloud credentials/i,
  /secret token.*maintainers|maintainers.*secret token/i,
  /system prompt|hidden instructions/i,
  /cloud credentials|allowed[- ]domain/i,
  /realistic citation|create.*citation.*trustworthy|citation.*looks trustworthy/i
];
const OUT_OF_SCOPE_PATTERNS = [
  /\bguarantee\b.*\bsecure\b/i,
  /\bobjectively best\b/i
];
const NOT_FOUND_PATTERNS = [
  /\broadmap\b|when will .*next major version/i,
  /\bundocumented\b.*\blimit\b/i
];
const CONFLICT_PATTERNS = [
  /docs?.*repository readme.*disagree/i,
  /which source should docsage prefer/i
];
const VERSION_AMBIGUITY_PATTERNS = [
  /\b(?:hono\s+)?version\s*[23]\b/i,
  /\bv[23]\b.*\bcurrent\b/i,
  /\bbetween\s+hono\s+v[23]\b/i
];

function normalizeRuntime(value) {
  if (!value) return null;
  const runtime = value.toLowerCase();
  if (runtime.startsWith('cloudflare')) return 'cloudflare-workers';
  if (runtime.startsWith('node')) return 'nodejs';
  return runtime;
}

export function classifyQuestion(query) {
  if (UNSAFE_PATTERNS.some((pattern) => pattern.test(query))) return { state: 'unsafe_or_untrusted', reason: 'unsafe-boundary' };
  if (ACCOUNT_PATTERNS.some((pattern) => pattern.test(query))) return { state: 'account_specific', reason: 'private-state-required' };
  if (CONFLICT_PATTERNS.some((pattern) => pattern.test(query))) return { state: 'conflicting_sources', reason: 'source-policy-conflict' };
  if (VERSION_AMBIGUITY_PATTERNS.some((pattern) => pattern.test(query))) return { state: 'version_ambiguous', reason: 'unpinned-version' };
  if (NOT_FOUND_PATTERNS.some((pattern) => pattern.test(query))) return { state: 'not_found', reason: 'not-documented' };
  if (OUT_OF_SCOPE_PATTERNS.some((pattern) => pattern.test(query))) return { state: 'out_of_scope', reason: 'outside-documentation-contract' };
  const version = query.match(/\b(?:v|version\s*)(\d+(?:\.\d+)*)\b/i)?.[1] ?? null;
  const runtime = normalizeRuntime(query.match(/\b(cloudflare(?: workers)?|node(?:\.js)?|bun|deno)\b/i)?.[1] ?? null);
  return { state: null, version, runtime };
}
