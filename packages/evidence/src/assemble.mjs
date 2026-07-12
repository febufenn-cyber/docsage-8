function numericFacts(text) {
  return [...String(text).matchAll(/\b\d+(?:\.\d+)?\s*(?:kb|mb|gb|ms|s|seconds?|minutes?|requests?|attempts?|%)?\b/gi)].map((match) => match[0].toLowerCase());
}

function identifierFacts(text) {
  return [...new Set(String(text).match(/(?:[A-Za-z_$][\w$]*\.)+[A-Za-z_$][\w$]*|@[\w/-]+|--[\w-]+/g) ?? [])];
}

export function assembleEvidence(results, options = {}) {
  const { maxItems = 5, maxChars = 8_000, minimumScore = 0.025 } = options;
  const selected = [];
  const seen = new Set();
  let chars = 0;
  for (const result of results) {
    const key = `${result.documentRevisionId}:${result.headingPath.join('>')}:${result.displayText.slice(0, 160)}`;
    if (seen.has(key) || result.score < minimumScore) continue;
    if (selected.length >= maxItems || chars + result.displayText.length > maxChars) break;
    seen.add(key);
    selected.push(result);
    chars += result.displayText.length;
  }

  const versions = new Set(selected.map((item) => item.version).filter(Boolean));
  const runtimes = new Set(selected.map((item) => item.runtime).filter((value) => value && value !== 'all'));
  const numericByHeading = new Map();
  for (const item of selected) {
    const key = item.headingPath.at(-1)?.toLowerCase() ?? item.title.toLowerCase();
    const facts = numericFacts(item.displayText);
    if (facts.length) {
      const current = numericByHeading.get(key) ?? new Set();
      for (const fact of facts) current.add(fact);
      numericByHeading.set(key, current);
    }
  }
  const conflicts = [...numericByHeading.entries()]
    .filter(([, facts]) => facts.size > 1)
    .map(([topic, facts]) => ({ topic, values: [...facts] }));

  let sufficiency = 'insufficient';
  if (selected.length && selected[0].score >= minimumScore) sufficiency = 'sufficient';
  if (selected.length === 1 && selected[0].displayText.length < 80) sufficiency = 'partial';
  if (versions.size > 1) sufficiency = 'version_ambiguous';
  if (runtimes.size > 1) sufficiency = 'runtime_ambiguous';
  if (conflicts.length) sufficiency = 'conflicting';

  return {
    sufficiency,
    evidence: selected,
    conflicts,
    identifiers: [...new Set(selected.flatMap((item) => identifierFacts(item.displayText)))],
    totalChars: chars
  };
}
