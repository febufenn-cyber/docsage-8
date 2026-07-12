import { tokenize, exactIdentifiers } from '../../retrieval/src/tokenize.mjs';

function overlapRatio(claim, evidence) {
  const claimTokens = [...new Set(tokenize(claim))];
  const evidenceTokens = new Set(tokenize(evidence));
  if (!claimTokens.length) return 1;
  return claimTokens.filter((token) => evidenceTokens.has(token)).length / claimTokens.length;
}

function numericValues(text) {
  return String(text).match(/\b\d+(?:\.\d+)?\b/g) ?? [];
}

export function validateClaims({ claims, evidence, projectId, minimumOverlap = 0.35 }) {
  const byId = new Map(evidence.map((item) => [item.id, item]));
  const results = claims.map((claim) => {
    const cited = (claim.evidenceIds ?? []).map((id) => byId.get(id)).filter(Boolean);
    const foreign = cited.some((item) => item.projectId !== projectId);
    const combined = cited.map((item) => item.searchText ?? `${item.title ?? ''}\n${(item.headingPath ?? []).join(' > ')}\n${item.displayText}`).join('\n');
    const identifiers = exactIdentifiers(claim.text);
    const numbers = numericValues(claim.text);
    const identifierSupport = identifiers.every((value) => combined.toLowerCase().includes(value));
    const numericSupport = numbers.every((value) => combined.includes(value));
    const overlap = overlapRatio(claim.text, combined);
    const supported = cited.length > 0 && !foreign && identifierSupport && numericSupport && overlap >= minimumOverlap;
    return {
      claim: claim.text,
      evidenceIds: claim.evidenceIds ?? [],
      supported,
      overlap,
      failureCode: foreign ? 'SAFE_TENANT_LEAK' : cited.length === 0 ? 'CITE_MISSING' : supported ? null : 'CITE_CLAIM_MISMATCH'
    };
  });
  return {
    valid: results.every((result) => result.supported),
    supportRate: results.length ? results.filter((result) => result.supported).length / results.length : 1,
    results
  };
}
