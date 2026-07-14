import { assertProjectScope } from '../../contracts/src/index.mjs';
import { stableId } from '../../core/src/hash.mjs';

function timestamp(value, name) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError(`${name} must be a valid timestamp`);
  return date.toISOString();
}

function scopeKey(revision) {
  return `${revision.projectId}\u241f${revision.sourceId}\u241f${revision.version}\u241f${revision.runtime}`;
}

function boundedActor(value) {
  if (typeof value !== 'string') throw new TypeError('actor is required');
  const actor = value.normalize('NFKC').trim();
  if (!actor || actor.length > 160) throw new RangeError('actor is invalid');
  return actor;
}

function validateRevision(revision) {
  if (!revision?.id || !revision.projectId || !revision.sourceId || !revision.manifest) {
    throw Object.assign(new Error('Corpus revision is incomplete'), { code: 'INGEST_ACTIVATION_INVALID' });
  }
  if (revision.manifest.projectId !== revision.projectId || revision.manifest.sourceId !== revision.sourceId
      || revision.manifest.version !== revision.version || revision.manifest.runtime !== revision.runtime) {
    throw Object.assign(new Error('Corpus revision scope does not match its manifest'), { code: 'INGEST_ACTIVATION_SCOPE' });
  }
  if (!Array.isArray(revision.documents) || revision.documents.length !== revision.manifest.itemCount) {
    throw Object.assign(new Error('Corpus revision document membership is incomplete'), { code: 'INGEST_ACTIVATION_INCOMPLETE' });
  }
  const manifest = new Map(revision.manifest.items.map((item) => [item.locator, item]));
  const locators = new Set();
  const chunks = new Set();
  for (const document of revision.documents) {
    const item = manifest.get(document.locator);
    if (!item || item.contentHash !== document.contentHash || item.metadataHash !== document.metadataHash) {
      throw Object.assign(new Error(`Corpus document does not match manifest: ${document.locator}`), { code: 'INGEST_ACTIVATION_INCOMPLETE' });
    }
    if (locators.has(document.locator)) throw Object.assign(new Error('Duplicate corpus locator'), { code: 'INGEST_ACTIVATION_INVALID' });
    locators.add(document.locator);
    if (!Array.isArray(document.chunkIds)) throw Object.assign(new Error('Corpus document chunks are missing'), { code: 'INGEST_ACTIVATION_INCOMPLETE' });
    if (item.quarantined && document.chunkIds.length > 0) {
      throw Object.assign(new Error('Quarantined content cannot have active chunks'), { code: 'INGEST_ACTIVATION_QUARANTINED' });
    }
    for (const chunkId of document.chunkIds) {
      if (typeof chunkId !== 'string' || !chunkId) throw Object.assign(new Error('Invalid chunk identity'), { code: 'INGEST_ACTIVATION_INVALID' });
      if (chunks.has(chunkId)) throw Object.assign(new Error('Duplicate active chunk identity'), { code: 'INGEST_ACTIVATION_INVALID' });
      chunks.add(chunkId);
    }
  }
  return Object.freeze({ locatorCount: locators.size, chunkCount: chunks.size });
}

function immutableRevision(revision, overrides = {}) {
  return Object.freeze({
    ...revision,
    ...overrides,
    documents: Object.freeze((revision.documents ?? []).map((document) => Object.freeze({
      ...document,
      chunkIds: Object.freeze([...(document.chunkIds ?? [])])
    }))),
    tombstones: Object.freeze([...(revision.tombstones ?? [])])
  });
}

export class MemoryCorpusActivationStore {
  #revisions = new Map();
  #active = new Map();
  #history = [];

  register(revision) {
    validateRevision(revision);
    const existing = this.#revisions.get(revision.id);
    if (existing) {
      if (existing.manifest.manifestHash !== revision.manifest.manifestHash || scopeKey(existing) !== scopeKey(revision)) {
        throw Object.assign(new Error('Revision identity conflict'), { code: 'INGEST_REVISION_CONFLICT' });
      }
      return { created: false, revision: existing };
    }
    const registered = immutableRevision(revision, { state: revision.state ?? 'staged', active: revision.active === true });
    this.#revisions.set(registered.id, registered);
    if (registered.active || registered.state === 'active') {
      const key = scopeKey(registered);
      if (this.#active.has(key)) throw Object.assign(new Error('Active corpus already exists for scope'), { code: 'INGEST_ACTIVE_CONFLICT' });
      const active = immutableRevision(registered, { state: 'active', active: true });
      this.#revisions.set(active.id, active);
      this.#active.set(key, active.id);
      return { created: true, revision: active };
    }
    return { created: true, revision: registered };
  }

  seedActive(revision, options = {}) {
    const result = this.register({ ...revision, state: 'active', active: true });
    if (result.created) this.#history.push(Object.freeze({
      id: stableId('activation', revision.projectId, revision.id, 'seed'),
      projectId: revision.projectId,
      sourceId: revision.sourceId,
      version: revision.version,
      runtime: revision.runtime,
      action: 'seed',
      fromRevisionId: null,
      toRevisionId: revision.id,
      actor: options.actor ?? 'system',
      occurredAt: timestamp(options.at ?? Date.now(), 'at')
    }));
    return result.revision;
  }

  get(projectId, revisionId) {
    const revision = this.#revisions.get(revisionId);
    return revision ? assertProjectScope(revision, projectId) : null;
  }

  active(projectId, sourceId, version = 'current', runtime = 'all') {
    const id = this.#active.get(`${projectId}\u241f${sourceId}\u241f${version}\u241f${runtime}`);
    return id ? assertProjectScope(this.#revisions.get(id), projectId) : null;
  }

  activate(projectId, revisionId, options = {}) {
    const candidate = assertProjectScope(this.#revisions.get(revisionId), projectId);
    if (candidate.state !== 'staged' || candidate.active) {
      throw Object.assign(new Error('Only a staged inactive corpus may activate'), { code: 'INGEST_ACTIVATION_STALE' });
    }
    if (options.sourceId && options.sourceId !== candidate.sourceId) throw Object.assign(new Error('Source mismatch'), { code: 'INGEST_ACTIVATION_SCOPE' });
    if (options.version && options.version !== candidate.version) throw Object.assign(new Error('Version mismatch'), { code: 'INGEST_ACTIVATION_SCOPE' });
    if (options.runtime && options.runtime !== candidate.runtime) throw Object.assign(new Error('Runtime mismatch'), { code: 'INGEST_ACTIVATION_SCOPE' });
    const validation = validateRevision(candidate);
    const key = scopeKey(candidate);
    const currentId = this.#active.get(key) ?? null;
    if (options.expectedActiveRevisionId !== undefined && options.expectedActiveRevisionId !== currentId) {
      throw Object.assign(new Error('Active corpus changed before activation'), { code: 'INGEST_ACTIVATION_CONFLICT' });
    }
    if (candidate.previousRevisionId && currentId && candidate.previousRevisionId !== currentId) {
      throw Object.assign(new Error('Staged corpus was based on a stale active revision'), { code: 'INGEST_ACTIVATION_CONFLICT' });
    }
    const actor = boundedActor(options.actor ?? 'system');
    const at = timestamp(options.at ?? Date.now(), 'at');
    if (typeof options.commitGuard === 'function') options.commitGuard({ candidate, current: currentId ? this.#revisions.get(currentId) : null, validation });

    const current = currentId ? this.#revisions.get(currentId) : null;
    const nextCurrent = current ? immutableRevision(current, { state: 'retired', active: false, retiredAt: at }) : null;
    const nextCandidate = immutableRevision(candidate, { state: 'active', active: true, activatedAt: at, retiredAt: null });

    if (nextCurrent) this.#revisions.set(nextCurrent.id, nextCurrent);
    this.#revisions.set(nextCandidate.id, nextCandidate);
    this.#active.set(key, nextCandidate.id);
    const event = Object.freeze({
      id: stableId('activation', projectId, nextCandidate.id, at),
      projectId,
      sourceId: nextCandidate.sourceId,
      version: nextCandidate.version,
      runtime: nextCandidate.runtime,
      action: 'activate',
      fromRevisionId: currentId,
      toRevisionId: nextCandidate.id,
      actor,
      occurredAt: at,
      locatorCount: validation.locatorCount,
      chunkCount: validation.chunkCount
    });
    this.#history.push(event);
    return Object.freeze({ previous: nextCurrent, active: nextCandidate, event });
  }

  rollback(projectId, targetRevisionId, options = {}) {
    const target = assertProjectScope(this.#revisions.get(targetRevisionId), projectId);
    const key = scopeKey(target);
    const currentId = this.#active.get(key) ?? null;
    if (!currentId) throw Object.assign(new Error('No active corpus exists for rollback scope'), { code: 'INGEST_ROLLBACK_CONFLICT' });
    if (currentId === targetRevisionId) throw Object.assign(new Error('Target revision is already active'), { code: 'INGEST_ROLLBACK_STALE' });
    const current = assertProjectScope(this.#revisions.get(currentId), projectId);
    if (current.sourceId !== target.sourceId || current.version !== target.version || current.runtime !== target.runtime) {
      throw Object.assign(new Error('Rollback target is incompatible with active corpus'), { code: 'INGEST_ROLLBACK_SCOPE' });
    }
    if (!['retired', 'rolled_back'].includes(target.state)) {
      throw Object.assign(new Error('Rollback target must be a previously active corpus'), { code: 'INGEST_ROLLBACK_STALE' });
    }
    if (options.expectedActiveRevisionId !== undefined && options.expectedActiveRevisionId !== currentId) {
      throw Object.assign(new Error('Active corpus changed before rollback'), { code: 'INGEST_ROLLBACK_CONFLICT' });
    }
    const validation = validateRevision(target);
    const actor = boundedActor(options.actor ?? 'system');
    const at = timestamp(options.at ?? Date.now(), 'at');
    if (typeof options.commitGuard === 'function') options.commitGuard({ target, current, validation });

    const nextCurrent = immutableRevision(current, { state: 'rolled_back', active: false, retiredAt: at });
    const nextTarget = immutableRevision(target, { state: 'active', active: true, activatedAt: at, retiredAt: null });
    this.#revisions.set(nextCurrent.id, nextCurrent);
    this.#revisions.set(nextTarget.id, nextTarget);
    this.#active.set(key, nextTarget.id);
    const event = Object.freeze({
      id: stableId('activation', projectId, targetRevisionId, 'rollback', at),
      projectId,
      sourceId: target.sourceId,
      version: target.version,
      runtime: target.runtime,
      action: 'rollback',
      fromRevisionId: currentId,
      toRevisionId: targetRevisionId,
      actor,
      occurredAt: at,
      locatorCount: validation.locatorCount,
      chunkCount: validation.chunkCount
    });
    this.#history.push(event);
    return Object.freeze({ previous: nextCurrent, active: nextTarget, event });
  }

  activeDocuments(projectId, sourceId, version = 'current', runtime = 'all') {
    const active = this.active(projectId, sourceId, version, runtime);
    return active ? active.documents.filter((document) => {
      const item = active.manifest.items.find((candidate) => candidate.locator === document.locator);
      return item && !item.quarantined;
    }) : [];
  }

  activeChunkIds(projectId, sourceId, version = 'current', runtime = 'all') {
    return this.activeDocuments(projectId, sourceId, version, runtime).flatMap((document) => document.chunkIds);
  }

  history(projectId, options = {}) {
    return this.#history.filter((event) => event.projectId === projectId
      && (!options.sourceId || event.sourceId === options.sourceId)
      && (!options.version || event.version === options.version)
      && (!options.runtime || event.runtime === options.runtime));
  }
}

export { validateRevision as validateCorpusRevision };
