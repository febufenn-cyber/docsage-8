import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSourceManifest, MemoryCorpusRevisionStore } from '../packages/ingestion/src/manifest.mjs';
import { MemoryCorpusActivationStore, validateCorpusRevision } from '../packages/ingestion/src/activation.mjs';

const scope = { projectId: 'project_alpha', sourceId: 'source_docs', version: 'v4', runtime: 'cloudflare' };
const t0 = '2026-07-14T10:00:00.000Z';

function manifest(items, overrides = {}) {
  return buildSourceManifest({ ...scope, ...overrides, items });
}

function seedRevision(id, manifestValue) {
  return {
    id, ...scope, state: 'active', active: true, manifest: manifestValue,
    documents: manifestValue.items.map((item, index) => ({
      locator: item.locator,
      contentHash: item.contentHash,
      metadataHash: item.metadataHash,
      documentRevisionId: `${id}_doc_${index}`,
      chunkIds: item.quarantined ? [] : [`${id}_chunk_${index}`],
      reused: false
    })),
    tombstones: []
  };
}

function stagedPair() {
  const v1Manifest = manifest([
    { locator: 'docs/guide.md', text: '# Guide\nOld guide.' },
    { locator: 'docs/remove.md', text: '# Remove\nRetire me.' }
  ]);
  const stageStore = new MemoryCorpusRevisionStore();
  const v1 = stageStore.seedActive(seedRevision('corpus_v1', v1Manifest));
  const v2Manifest = manifest([
    { locator: 'docs/guide.md', text: '# Guide\nNew guide.' },
    { locator: 'docs/add.md', text: '# Add\nNew page.' }
  ]);
  const v2 = stageStore.stage({ ...scope, id: 'corpus_v2', manifest: v2Manifest }, {
    now: () => '2026-07-14T11:00:00.000Z',
    materialize(item) {
      return { documentRevisionId: `v2_${item.contentHash.slice(0, 8)}`, chunkIds: [`v2_chunk_${item.contentHash.slice(0, 8)}`] };
    }
  }).revision;
  return { v1, v2 };
}

test('failed commit guard leaves the previous active corpus exactly unchanged', () => {
  const { v1, v2 } = stagedPair();
  const store = new MemoryCorpusActivationStore();
  store.seedActive(v1, { at: t0 });
  store.register(v2);
  const beforeChunks = store.activeChunkIds(scope.projectId, scope.sourceId, scope.version, scope.runtime);
  assert.throws(() => store.activate(scope.projectId, v2.id, {
    actor: 'worker-a', expectedActiveRevisionId: v1.id,
    commitGuard() { throw new Error('simulated transaction failure'); }
  }), /simulated transaction failure/);
  assert.equal(store.active(scope.projectId, scope.sourceId, scope.version, scope.runtime).id, v1.id);
  assert.deepEqual(store.activeChunkIds(scope.projectId, scope.sourceId, scope.version, scope.runtime), beforeChunks);
  assert.equal(store.get(scope.projectId, v2.id).state, 'staged');
  assert.equal(store.history(scope.projectId).length, 1);
});

test('atomic activation retires the previous corpus and applies staged deletions', () => {
  const { v1, v2 } = stagedPair();
  const store = new MemoryCorpusActivationStore();
  store.seedActive(v1, { at: t0 });
  store.register(v2);
  const result = store.activate(scope.projectId, v2.id, {
    actor: 'worker-a', expectedActiveRevisionId: v1.id,
    sourceId: scope.sourceId, version: scope.version, runtime: scope.runtime,
    at: '2026-07-14T11:01:00.000Z'
  });
  assert.equal(result.previous.state, 'retired');
  assert.equal(result.active.id, v2.id);
  assert.equal(store.active(scope.projectId, scope.sourceId, scope.version, scope.runtime).id, v2.id);
  assert.deepEqual(store.activeDocuments(scope.projectId, scope.sourceId, scope.version, scope.runtime).map((document) => document.locator).sort(),
    ['docs/add.md', 'docs/guide.md']);
  assert.equal(store.activeDocuments(scope.projectId, scope.sourceId, scope.version, scope.runtime).some((document) => document.locator === 'docs/remove.md'), false);
  assert.equal(result.event.action, 'activate');
  assert.equal(result.event.fromRevisionId, v1.id);
});

test('stale activation and duplicate activation are blocked', () => {
  const { v1, v2 } = stagedPair();
  const store = new MemoryCorpusActivationStore();
  store.seedActive(v1, { at: t0 });
  store.register(v2);
  assert.throws(() => store.activate(scope.projectId, v2.id, {
    expectedActiveRevisionId: 'another_revision', actor: 'worker-a'
  }), (error) => error.code === 'INGEST_ACTIVATION_CONFLICT');
  store.activate(scope.projectId, v2.id, { expectedActiveRevisionId: v1.id, actor: 'worker-a' });
  assert.throws(() => store.activate(scope.projectId, v2.id, { actor: 'worker-a' }),
    (error) => error.code === 'INGEST_ACTIVATION_STALE');
});

test('staged revision based on an old active corpus cannot overwrite a newer corpus', () => {
  const { v1, v2 } = stagedPair();
  const store = new MemoryCorpusActivationStore();
  store.seedActive(v1, { at: t0 });
  store.register(v2);
  const v3Manifest = manifest([{ locator: 'docs/third.md', text: 'third' }]);
  const v3 = { ...seedRevision('corpus_v3', v3Manifest), state: 'staged', active: false, previousRevisionId: v1.id };
  store.register(v3);
  store.activate(scope.projectId, v2.id, { expectedActiveRevisionId: v1.id, actor: 'worker-a' });
  assert.throws(() => store.activate(scope.projectId, v3.id, { actor: 'worker-b' }),
    (error) => error.code === 'INGEST_ACTIVATION_CONFLICT');
  assert.equal(store.active(scope.projectId, scope.sourceId, scope.version, scope.runtime).id, v2.id);
});

test('rollback restores the exact prior documents and chunk identities', () => {
  const { v1, v2 } = stagedPair();
  const store = new MemoryCorpusActivationStore();
  store.seedActive(v1, { at: t0 });
  const originalChunks = store.activeChunkIds(scope.projectId, scope.sourceId, scope.version, scope.runtime);
  store.register(v2);
  store.activate(scope.projectId, v2.id, { expectedActiveRevisionId: v1.id, actor: 'worker-a' });
  const rollback = store.rollback(scope.projectId, v1.id, {
    expectedActiveRevisionId: v2.id, actor: 'operator', at: '2026-07-14T12:00:00.000Z'
  });
  assert.equal(rollback.active.id, v1.id);
  assert.equal(rollback.previous.state, 'rolled_back');
  assert.deepEqual(store.activeChunkIds(scope.projectId, scope.sourceId, scope.version, scope.runtime), originalChunks);
  assert.equal(rollback.event.action, 'rollback');
});

test('version and runtime scopes remain independently active with zero contamination', () => {
  const { v1 } = stagedPair();
  const store = new MemoryCorpusActivationStore();
  store.seedActive(v1, { at: t0 });
  const v5Manifest = manifest([{ locator: 'docs/v5.md', text: 'v5 only' }], { version: 'v5', runtime: 'node' });
  const v5 = { ...seedRevision('corpus_v5', v5Manifest), version: 'v5', runtime: 'node', projectId: scope.projectId, sourceId: scope.sourceId };
  store.seedActive(v5, { at: t0 });
  assert.equal(store.active(scope.projectId, scope.sourceId, 'v4', 'cloudflare').id, v1.id);
  assert.equal(store.active(scope.projectId, scope.sourceId, 'v5', 'node').id, v5.id);
  assert.deepEqual(store.activeChunkIds(scope.projectId, scope.sourceId, 'v4', 'cloudflare'), ['corpus_v1_chunk_0', 'corpus_v1_chunk_1']);
  assert.deepEqual(store.activeChunkIds(scope.projectId, scope.sourceId, 'v5', 'node'), ['corpus_v5_chunk_0']);
});

test('quarantined content with chunks and incomplete membership are rejected before mutation', () => {
  const quarantinedManifest = manifest([{ locator: 'docs/secret.md', text: 'secret', quarantined: true }]);
  const safeQuarantine = seedRevision('corpus_bad', quarantinedManifest);
  const bad = {
    ...safeQuarantine,
    documents: safeQuarantine.documents.map((document) => ({ ...document, chunkIds: ['unsafe_quarantined_chunk'] }))
  };
  assert.throws(() => validateCorpusRevision(bad), (error) => error.code === 'INGEST_ACTIVATION_QUARANTINED');
  const incomplete = { ...bad, documents: [] };
  assert.throws(() => validateCorpusRevision(incomplete), (error) => error.code === 'INGEST_ACTIVATION_INCOMPLETE');
});

test('cross-project and incompatible rollback targets are blocked', () => {
  const { v1, v2 } = stagedPair();
  const store = new MemoryCorpusActivationStore();
  store.seedActive(v1, { at: t0 });
  store.register(v2);
  store.activate(scope.projectId, v2.id, { expectedActiveRevisionId: v1.id, actor: 'worker-a' });
  assert.throws(() => store.get('project_beta', v2.id), (error) => error.code === 'SAFE_TENANT_LEAK');
  const otherManifest = buildSourceManifest({ projectId: scope.projectId, sourceId: 'source_other', version: 'v4', runtime: 'cloudflare', items: [{ locator: 'docs/other.md', text: 'other' }] });
  const other = { ...seedRevision('corpus_other', otherManifest), sourceId: 'source_other' };
  store.seedActive(other, { at: t0 });
  assert.throws(() => store.rollback(scope.projectId, other.id, { expectedActiveRevisionId: v2.id, actor: 'operator' }),
    (error) => ['INGEST_ROLLBACK_STALE', 'INGEST_ROLLBACK_CONFLICT'].includes(error.code));
});
