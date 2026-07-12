import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const candidateManifestPath = path.join(root, 'evals/datasets/hono-phase0.manifest.json');
const corpusManifestPath = path.join(root, 'evals/corpora/hono/corpus-manifest.json');
const reviewPath = path.join(root, 'evals/reviews/hono-phase1-review.json');
const rawRoot = path.join(root, '.tmp/hono-corpus/raw');
const outputRoot = path.join(root, '.tmp/hono-benchmark');

const normalize = (value) => String(value ?? '')
  .normalize('NFKC')
  .toLowerCase()
  .replace(/[`*_~<>()[\]{}'"/:;,.!?|\\-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

function containsTerm(text, term) {
  const raw = String(text).toLowerCase();
  const expected = String(term).toLowerCase();
  return raw.includes(expected) || normalize(text).includes(normalize(term));
}

function localPath(document) {
  return path.join(rawRoot, document.repository.replace('/', '__'), document.path);
}

async function loadCandidates() {
  const manifest = JSON.parse(await readFile(candidateManifestPath, 'utf8'));
  const records = [];
  for (const shard of manifest.shards) {
    const text = await readFile(path.join(root, 'evals/datasets', shard.path), 'utf8');
    records.push(...text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)));
  }
  return records;
}

const [candidates, corpus, review] = await Promise.all([
  loadCandidates(),
  readFile(corpusManifestPath, 'utf8').then(JSON.parse),
  readFile(reviewPath, 'utf8').then(JSON.parse)
]);

if (review.corpus_id !== corpus.corpus_id) throw new Error('Review ledger and corpus manifest disagree.');
const documentByUrl = new Map(corpus.documents.map((document) => [document.canonical_url, document]));
const contentByUrl = new Map();
for (const document of corpus.documents) {
  contentByUrl.set(document.canonical_url, await readFile(localPath(document), 'utf8'));
}

const policyIds = new Set(review.policy_case_ids);
const verified = [];
const rejected = [];

for (const original of candidates) {
  const correction = review.corrections[original.id] ?? {};
  const evidenceTerms = correction.evidence_terms ?? correction.must_include ?? original.must_include;
  const item = {
    ...original,
    ...Object.fromEntries(Object.entries(correction).filter(([key]) => key !== 'evidence_terms'))
  };
  const basis = policyIds.has(item.id) ? 'phase0-policy' : 'pinned-source';
  if (basis === 'phase0-policy') item.expected_sources = [];
  let failures = [];

  if (basis === 'pinned-source') {
    if (!item.answerable) failures.push('non-policy unanswerable case');
    const missingSources = item.expected_sources.filter((url) => !documentByUrl.has(url));
    if (missingSources.length) failures.push(`unmapped sources: ${missingSources.join(', ')}`);
    const evidence = item.expected_sources.map((url) => contentByUrl.get(url) ?? '').join('\n\n');
    const missingTerms = evidenceTerms.filter((term) => !containsTerm(evidence, term));
    if (missingTerms.length) failures.push(`missing evidence terms: ${missingTerms.join(', ')}`);
  }

  if (basis === 'phase0-policy' && !policyIds.has(item.id)) failures.push('policy case is not listed in review ledger');

  if (failures.length) {
    rejected.push({ id: item.id, failures });
    continue;
  }

  verified.push({
    ...item,
    annotation_status: 'verified',
    notes: `${item.notes ?? ''} Primary review ${review.review_id}; basis=${basis}; corpus=${corpus.corpus_id}.`.trim()
  });
}

const verifiedIds = new Set(verified.map((item) => item.id));
const unverifiedHighRisk = candidates
  .map((item) => ({ ...item, ...(review.corrections[item.id] ?? {}) }))
  .filter((item) => item.answerable && item.risk === 'high' && !verifiedIds.has(item.id))
  .map((item) => item.id);

if (verified.length < 60) throw new Error(`Only ${verified.length} cases verified; at least 60 are required. Rejected: ${JSON.stringify(rejected)}`);
if (unverifiedHighRisk.length) throw new Error(`High-risk answerable cases lack verified evidence: ${unverifiedHighRisk.join(', ')}`);

await mkdir(outputRoot, { recursive: true });
await writeFile(path.join(outputRoot, 'verified.jsonl'), `${verified.map((item) => JSON.stringify(item)).join('\n')}\n`);
const report = {
  review_id: review.review_id,
  corpus_id: corpus.corpus_id,
  candidate_count: candidates.length,
  verified_count: verified.length,
  rejected_count: rejected.length,
  policy_verified_count: verified.filter((item) => policyIds.has(item.id)).length,
  source_verified_count: verified.filter((item) => !policyIds.has(item.id)).length,
  independent_human_review: review.independent_human_review,
  secondary_channel_case_count: review.secondary_channel_case_ids.length,
  rejected
};
await writeFile(path.join(outputRoot, 'review-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
