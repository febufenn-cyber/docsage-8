import { assertProjectScope } from '../../contracts/src/index.mjs';
import { stableId } from '../../core/src/hash.mjs';

export class MemorySourceRegistry {
  #projects = new Map();
  #sources = new Map();
  #revisions = new Map();
  #chunks = [];

  addProject(project) {
    if (!project?.id) throw new TypeError('project.id is required');
    this.#projects.set(project.id, { currentVersion: 'current', ...project });
    return this.#projects.get(project.id);
  }

  addSource(projectId, source) {
    if (!this.#projects.has(projectId)) throw new Error(`Unknown project: ${projectId}`);
    const id = source.id ?? stableId('src', projectId, source.canonicalUrl);
    const record = { authorityLevel: 2, active: true, ...source, id, projectId };
    this.#sources.set(id, record);
    return record;
  }

  addRevision(projectId, sourceId, revision) {
    const source = assertProjectScope(this.#sources.get(sourceId), projectId);
    const id = revision.id ?? stableId('rev', sourceId, revision.externalRevision ?? revision.contentHash);
    for (const existing of this.#revisions.values()) {
      if (existing.sourceId === sourceId && existing.active) existing.active = false;
    }
    const record = { ...revision, id, sourceId, projectId, active: true, authorityLevel: source.authorityLevel };
    this.#revisions.set(id, record);
    return record;
  }

  replaceChunks(projectId, revisionId, chunks) {
    assertProjectScope(this.#revisions.get(revisionId), projectId);
    this.#chunks = this.#chunks.filter((chunk) => !(chunk.projectId === projectId && chunk.sourceRevisionId === revisionId));
    this.#chunks.push(...chunks.map((chunk) => ({ ...chunk, projectId, sourceRevisionId: revisionId, active: true })));
  }

  activeChunks(projectId) {
    if (!this.#projects.has(projectId)) throw new Error(`Unknown project: ${projectId}`);
    return this.#chunks.filter((chunk) => chunk.projectId === projectId && chunk.active !== false);
  }

  getProject(projectId) {
    return this.#projects.get(projectId) ?? null;
  }
}
