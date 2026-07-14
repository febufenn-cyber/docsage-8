import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSourceManifest,
  canonicalSourceLocator,
  diffSourceManifests,
  MemoryCorpusRevisionStore
} from '../packages/ingestion/src/manifest.mjs';

const scope = { projectId: 'project_alpha', sourceId: 'source_docs', version: 'v4', runtime: 'cloudflare' };
const itemsV1 = [
  { locator: 'https://Docs.Example.com/guide/?tracking=1#top', title: 'Guide', text: '# Guide\nStable guide.' },
  { locator: 'docs/api.md', title: 'API', text: '# API\nOld API.' },
  { locator: 'docs/remove.md', title: 'Remove', text: '# Remove\nRetire me.' }
];

function manifest(items) { return buildSourceManifest({ ...scope, items }); }
function seededRevision(manifestValue) {
  return {
    id: 'corpus_v1', ...scope, manifest: manifestValue,
    documents: manifestValue.items.map((item, index) => ({
      locator: item.locator,
      contentHash: item.contentHash,
      metadataHash: item.metadataHash,
      documentRevisionId: `docrev_${index}`,
      chunkIds: [`chunk_${index}_a`, `chunk_${index}_b`],
      reused: false
    }))
  };
}

test('canonical locators remove tracking identity and traversal', () => {
  assert.equal(canonicalSourceLocator('https://Docs.Example.com:443/a//b/?x=1#frag'), 'https://docs.example.com/a/b');
  assert.equal(canonicalSourceLocator('./docs\\api.md'), 'docs/api.md');
  assert.throws(() => canonicalSourceLocator('../secret.md'), /traversal-free/);
});

test('manifest hash is independent of discovery order and exact duplicates', () => {
  const first = manifest(itemsV1);
  const second = manifest([itemsV1[2], itemsV1[0], itemsV1[1], itemsV1[0]]);
  assert.equal(first.manifestHash, second.manifestHash);
  assert.equal(first.itemCount, 3);
  assert.deepEqual(first.items.map((item) => item.locator), [...first.items].map((item) => item.locator).sort());
});

test('conflicting duplicate locators fail discovery', () => {
  assert.throws(() => manifest([
    { locator: 'docs/api.md', text: 'one' },
    { locator: 'docs/api.md', text: 'two' }
  ]), (error) => error.code === 'INGEST_MANIFEST_CONFLICT');
});

test('diff classifies added changed unchanged and deleted exactly', () => {
  const previous = manifest(itemsV1);
  const next = manifest([
    itemsV1[0],
    { locator: 'docs/api.md', title: 'API', text: '# API\nNew API.' },
    { locator: 'docs/new.md', title: 'New', text: '# New\nAdded.' }
  ]);
  const diff = diffSourceManifests(previous, next);
  assert.deepEqual(diff.counts, { added: 1, changed: 1, unchanged: 1, deleted: 1 });
  assert.deepEqual(diff.added, ['docs/new.md']);
  assert.deepEqual(diff.changed, ['docs/api.md']);
  assert.deepEqual(diff.deleted, ['docs/remove.md']);
  assert.equal(diff.empty, false);
});

test('unchanged complete refresh returns the existing revision with zero creation', () => {
  const firstManifest = manifest(itemsV1);
  const store = new MemoryCorpusRevisionStore();
  const active = store.seedActive(seededRevision(firstManifest));
  const staged = store.stage({ ...scope, manifest: manifest([...itemsV1].reverse()) });
  assert.equal(staged.created, false);
  assert.equal(staged.duplicate, true);
  assert.equal(staged.revision.id, active.id);
  assert.equal(store.activeRevisionId(scope.projectId, scope.sourceId, scope.version, scope.runtime), 'corpus_v1');
});

test('partial refresh reuses unchanged identities and stages deletion tombstones', () => {
  const firstManifest = manifest(itemsV1);
  const store = new MemoryCorpusRevisionStore();
  store.seedActive(seededRevision(firstManifest));
  const next = manifest([
    itemsV1[0],
    { locator: 'docs/api.md', title: 'API', text: '# API\nNew API.' },
    { locator: 'docs/new.md', title: 'New', text: '# New\nAdded.' }
  ]);
  const materialized = [];
  const result = store.stage({ ...scope, manifest: next }, {
    now: () => '2026-07-14T11:00:00.000Z',
    materialize(item, revisionId) {
      materialized.push(item.locator);
      return { documentRevisionId: `new_${item.contentHash.slice(0, 8)}`, chunkIds: [`${revisionId}_${item.contentHash.slice(0, 8)}`] };
    }
  });
  assert.equal(result.created, true);
  assert.equal(result.revision.state, 'staged');
  assert.deepEqual(materialized.sort(), ['docs/api.md', 'docs/new.md']);
  assert.deepEqual(result.revision.stats, {
    added: 1, changed: 1, unchanged: 1, deleted: 1,
    createdDocumentRevisions: 2, reusedDocumentRevisions: 1,
    createdChunks: 2, reusedChunks: 2
  });
  assert.equal(result.revision.documents.find((document) => document.locator === 'https://docs.example.com/guide').documentRevisionId, 'docrev_2');
  assert.deepEqual(result.revision.tombstones, [{ locator: 'docs/remove.md', priorDocumentRevisionId: 'docrev_1' }]);
  assert.equal(store.activeRevisionId(scope.projectId, scope.sourceId, scope.version, scope.runtime), 'corpus_v1');
});

test('manifest and previous revision scopes cannot cross projects or sources', () => {
  const firstManifest = manifest(itemsV1);
  assert.throws(() => diffSourceManifests(firstManifest, buildSourceManifest({ ...scope, projectId: 'project_beta', items: itemsV1 })),
    (error) => error.code === 'SAFE_TENANT_LEAK');
  const store = new MemoryCorpusRevisionStore();
  store.seedActive(seededRevision(firstManifest));
  assert.throws(() => store.get('project_beta', 'corpus_v1'), (error) => error.code === 'SAFE_TENANT_LEAK');
});

test('migration preserves reusable memberships, tombstones, RLS, and one active revision per scope', async () => {
  const { readFile } = await import('node:fs/promises');
  const sql = await readFile(new URL('../supabase/migrations/20260714000400_incremental_corpus_revisions.sql', import.meta.url), 'utf8');
  for (const expected of [
    'corpus_revision_documents', 'corpus_revision_tombstones', 'reused boolean',
    "where state = 'active'", 'enable row level security', 'public.owns_project(project_id)'
  ]) assert.ok(sql.includes(expected), `missing SQL invariant: ${expected}`);
});
