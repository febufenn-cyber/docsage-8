import { stableId, sha256, stableJson } from '../../core/src/hash.mjs';
import { assertProjectScope } from '../../contracts/src/index.mjs';

function boundedString(value, name, max, { optional = false } = {}) {
  if ((value === undefined || value === null || value === '') && optional) return null;
  if (typeof value !== 'string') throw new TypeError(`${name} must be a string`);
  const normalized = value.normalize('NFKC').trim();
  if (!normalized || Array.from(normalized).length > max) throw new RangeError(`${name} is invalid`);
  return normalized;
}

export function canonicalSourceLocator(value) {
  const raw = boundedString(value, 'locator', 2_000);
  try {
    const url = new URL(raw);
    url.hash = '';
    url.search = '';
    url.hostname = url.hostname.toLowerCase();
    if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = '';
    url.pathname = url.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
    return url.toString();
  } catch {
    const path = raw.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/{2,}/g, '/');
    if (path.startsWith('/') || path.split('/').includes('..')) throw new TypeError('locator path must be relative and traversal-free');
    return path;
  }
}

function normalizeItem(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('source item must be an object');
  const locator = canonicalSourceLocator(input.locator ?? input.canonicalUrl ?? input.path);
  const text = input.text;
  const contentHash = input.contentHash
    ? boundedString(input.contentHash, 'contentHash', 64)
    : typeof text === 'string' ? sha256(text) : null;
  if (!contentHash || !/^[0-9a-f]{64}$/i.test(contentHash)) throw new TypeError('source item requires text or a SHA-256 contentHash');
  const metadata = input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata) ? input.metadata : {};
  const metadataHash = sha256(stableJson(metadata));
  return Object.freeze({
    locator,
    contentHash: contentHash.toLowerCase(),
    metadataHash,
    title: boundedString(input.title ?? locator.split('/').at(-1) ?? locator, 'title', 300),
    quarantined: input.quarantined === true,
    byteLength: Number.isSafeInteger(input.byteLength) && input.byteLength >= 0
      ? input.byteLength
      : typeof text === 'string' ? Buffer.byteLength(text) : null
  });
}

export function buildSourceManifest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('manifest input must be an object');
  const projectId = boundedString(input.projectId, 'projectId', 128);
  const sourceId = boundedString(input.sourceId, 'sourceId', 128);
  const version = boundedString(input.version ?? 'current', 'version', 100);
  const runtime = boundedString(input.runtime ?? 'all', 'runtime', 100);
  if (!Array.isArray(input.items)) throw new TypeError('items must be an array');

  const byLocator = new Map();
  for (const raw of input.items) {
    const item = normalizeItem(raw);
    const previous = byLocator.get(item.locator);
    if (previous && stableJson(previous) !== stableJson(item)) {
      throw Object.assign(new Error(`Conflicting duplicate locator: ${item.locator}`), { code: 'INGEST_MANIFEST_CONFLICT' });
    }
    byLocator.set(item.locator, item);
  }
  const items = [...byLocator.values()].sort((a, b) => a.locator.localeCompare(b.locator));
  const identity = { projectId, sourceId, version, runtime, items };
  const manifestHash = sha256(stableJson(identity));
  return Object.freeze({
    schemaVersion: 1,
    projectId,
    sourceId,
    version,
    runtime,
    manifestHash,
    itemCount: items.length,
    totalBytes: items.reduce((sum, item) => sum + (item.byteLength ?? 0), 0),
    items: Object.freeze(items)
  });
}

function itemMap(manifest) {
  return new Map((manifest?.items ?? []).map((item) => [item.locator, item]));
}

export function diffSourceManifests(previous, next) {
  if (!next?.manifestHash) throw new TypeError('next manifest is required');
  if (previous && (previous.projectId !== next.projectId || previous.sourceId !== next.sourceId)) {
    throw Object.assign(new Error('Manifest scope mismatch'), { code: 'SAFE_TENANT_LEAK' });
  }
  const before = itemMap(previous);
  const after = itemMap(next);
  const result = { added: [], changed: [], unchanged: [], deleted: [] };
  for (const item of next.items) {
    const old = before.get(item.locator);
    if (!old) result.added.push(item.locator);
    else if (old.contentHash === item.contentHash && old.metadataHash === item.metadataHash && old.quarantined === item.quarantined) result.unchanged.push(item.locator);
    else result.changed.push(item.locator);
  }
  for (const item of previous?.items ?? []) if (!after.has(item.locator)) result.deleted.push(item.locator);
  for (const values of Object.values(result)) values.sort();
  return Object.freeze({
    ...result,
    counts: Object.freeze(Object.fromEntries(Object.entries(result).map(([key, values]) => [key, values.length]))),
    empty: result.added.length + result.changed.length + result.deleted.length === 0
  });
}

function defaultMaterialize(item, revisionId) {
  const documentRevisionId = stableId('docrev', item.locator, item.contentHash);
  return Object.freeze({
    documentRevisionId,
    chunkIds: Object.freeze([stableId('chunk', documentRevisionId, item.contentHash)]),
    sourceRevisionId: revisionId
  });
}

export class MemoryCorpusRevisionStore {
  #revisions = new Map();
  #byManifest = new Map();
  #active = new Map();

  seedActive(revision) {
    if (!revision?.id || !revision.projectId || !revision.sourceId || !revision.manifest) throw new TypeError('complete revision is required');
    const frozen = Object.freeze({ ...revision, state: 'active', active: true });
    this.#revisions.set(frozen.id, frozen);
    this.#byManifest.set(`${frozen.projectId}\u241f${frozen.sourceId}\u241f${frozen.manifest.manifestHash}`, frozen.id);
    this.#active.set(`${frozen.projectId}\u241f${frozen.sourceId}\u241f${frozen.manifest.version}\u241f${frozen.manifest.runtime}`, frozen.id);
    return frozen;
  }

  stage(input, options = {}) {
    const { projectId, sourceId, manifest } = input ?? {};
    if (!manifest || manifest.projectId !== projectId || manifest.sourceId !== sourceId) {
      throw Object.assign(new Error('Staged manifest scope mismatch'), { code: 'SAFE_TENANT_LEAK' });
    }
    const manifestKey = `${projectId}\u241f${sourceId}\u241f${manifest.manifestHash}`;
    const duplicateId = this.#byManifest.get(manifestKey);
    if (duplicateId) return { created: false, duplicate: true, revision: this.#revisions.get(duplicateId), diff: diffSourceManifests(this.#revisions.get(duplicateId).manifest, manifest) };

    const active = this.active(projectId, sourceId, manifest.version, manifest.runtime);
    const previous = input.previousRevisionId
      ? assertProjectScope(this.#revisions.get(input.previousRevisionId), projectId)
      : active;
    if (previous && previous.sourceId !== sourceId) throw Object.assign(new Error('Previous revision source mismatch'), { code: 'SAFE_TENANT_LEAK' });
    const diff = diffSourceManifests(previous?.manifest ?? null, manifest);
    const priorDocuments = new Map((previous?.documents ?? []).map((document) => [document.locator, document]));
    const materialize = options.materialize ?? defaultMaterialize;
    const revisionId = input.id ?? stableId('corpusrev', projectId, sourceId, manifest.manifestHash);
    const documents = manifest.items.map((item) => {
      const prior = priorDocuments.get(item.locator);
      const reusable = prior && diff.unchanged.includes(item.locator);
      if (reusable) return Object.freeze({ ...prior, reused: true });
      const created = materialize(item, revisionId);
      if (!created?.documentRevisionId || !Array.isArray(created.chunkIds)) throw new TypeError('materialize must return documentRevisionId and chunkIds');
      return Object.freeze({
        locator: item.locator,
        contentHash: item.contentHash,
        metadataHash: item.metadataHash,
        documentRevisionId: created.documentRevisionId,
        chunkIds: Object.freeze([...created.chunkIds]),
        reused: false
      });
    });
    const tombstones = Object.freeze(diff.deleted.map((locator) => Object.freeze({
      locator,
      priorDocumentRevisionId: priorDocuments.get(locator)?.documentRevisionId ?? null
    })));
    const revision = Object.freeze({
      id: revisionId,
      projectId,
      sourceId,
      version: manifest.version,
      runtime: manifest.runtime,
      state: 'staged',
      active: false,
      manifest,
      previousRevisionId: previous?.id ?? null,
      documents: Object.freeze(documents),
      tombstones,
      stats: Object.freeze({
        ...diff.counts,
        createdDocumentRevisions: documents.filter((document) => !document.reused).length,
        reusedDocumentRevisions: documents.filter((document) => document.reused).length,
        createdChunks: documents.filter((document) => !document.reused).reduce((sum, document) => sum + document.chunkIds.length, 0),
        reusedChunks: documents.filter((document) => document.reused).reduce((sum, document) => sum + document.chunkIds.length, 0)
      }),
      stagedAt: new Date(options.now?.() ?? Date.now()).toISOString()
    });
    this.#revisions.set(revision.id, revision);
    this.#byManifest.set(manifestKey, revision.id);
    return { created: true, duplicate: false, revision, diff };
  }

  get(projectId, revisionId) {
    const revision = this.#revisions.get(revisionId);
    return revision ? assertProjectScope(revision, projectId) : null;
  }

  active(projectId, sourceId, version = 'current', runtime = 'all') {
    const id = this.#active.get(`${projectId}\u241f${sourceId}\u241f${version}\u241f${runtime}`);
    return id ? assertProjectScope(this.#revisions.get(id), projectId) : null;
  }

  activeRevisionId(projectId, sourceId, version = 'current', runtime = 'all') {
    return this.active(projectId, sourceId, version, runtime)?.id ?? null;
  }
}
