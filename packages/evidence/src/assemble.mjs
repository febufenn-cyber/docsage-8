function identifierFacts(text) {
  return [...new Set(String(text).match(/(?:[A-Za-z_$][\w$]*\.)+[A-Za-z_$][\w$]*|@[\w/-]+|--[\w-]+/g) ?? [])];
}

function explicitConflictGroups(items) {
  const byKey = new Map();
  for (const item of items) {
    for (const fact of item.conflictFacts ?? []) {
      if (!fact?.key || fact.value === undefined) continue;
      const current = byKey.get(fact.key) ?? new Set();
      current.add(String(fact.value));
      byKey.set(fact.key, current);
    }
  }
  return [...byKey.entries()]
    .filter(([, values]) => values.size > 1)
    .map(([topic, values]) => ({ topic, values: [...values] }));
}

export function assembleEvidence(results, options = {}) {
  const { maxItems = 5, maxChars = 12_000, minimumScore = 0.018 } = options;
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

  const versions = new Set(selected.map((item) => item.version).filter((value) => value && value !== 'all'));
  const runtimes = new Set(selected.map((item) => item.runtime).filter((value) => value && value !== 'all'));
  const conflicts = explicitConflictGroups(selected);

  let sufficiency = 'insufficient';
  if (selected.length) sufficiency = 'sufficient';
  if (selected.length === 1 && selected[0].displayText.length < 60) sufficiency = 'partial';
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
