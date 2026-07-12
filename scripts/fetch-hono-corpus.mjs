import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizeMarkdown } from '../packages/normalization/src/markdown.mjs';
import { chunkDocument } from '../packages/chunking/src/chunk.mjs';

const root = path.resolve(import.meta.dirname, '..');
const manifestPath = path.join(root, 'evals/corpora/hono/corpus-manifest.json');
const outputRoot = path.join(root, '.tmp/hono-corpus');
const rawRoot = path.join(outputRoot, 'raw');

function gitBlobSha(bytes) {
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

function rawUrl(document) {
  return `https://raw.githubusercontent.com/${document.repository}/${document.commit}/${document.path}`;
}

function localPath(document) {
  return path.join(rawRoot, document.repository.replace('/', '__'), document.path);
}

async function fetchPinned(document) {
  const response = await fetch(rawUrl(document), {
    headers: { 'user-agent': 'docsage-phase1-corpus/1.0' },
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`${document.path}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const actualBlobSha = gitBlobSha(bytes);
  if (actualBlobSha !== document.blob_sha) {
    throw new Error(`${document.path}: pinned blob mismatch; expected ${document.blob_sha}, got ${actualBlobSha}`);
  }
  const target = localPath(document);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
  return { bytes, target, actualBlobSha };
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const chunks = [];
const lockDocuments = [];

for (const document of manifest.documents) {
  const { bytes, target, actualBlobSha } = await fetchPinned(document);
  const markdown = bytes.toString('utf8');
  const sourceRevisionId = `rev_${document.repository.replace('/', '_')}_${document.commit.slice(0, 12)}`;
  const normalized = normalizeMarkdown({
    projectId: manifest.project_id,
    sourceRevisionId,
    canonicalUrl: document.canonical_url,
    markdown,
    title: document.title,
    version: document.version,
    runtime: document.runtime,
    authorityLevel: document.authority_level
  });
  const documentChunks = chunkDocument(normalized, { maxChars: 1800, overlapBlocks: 1, chunkerVersion: 'phase1-hono-v1' })
    .map((chunk) => ({
      ...chunk,
      repository: document.repository,
      commit: document.commit,
      sourcePath: document.path,
      blobSha: actualBlobSha
    }));
  chunks.push(...documentChunks);
  lockDocuments.push({
    repository: document.repository,
    commit: document.commit,
    path: document.path,
    blob_sha: actualBlobSha,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    canonical_url: document.canonical_url,
    chunk_count: documentChunks.length,
    local_path: path.relative(root, target)
  });
}

await mkdir(outputRoot, { recursive: true });
await writeFile(path.join(outputRoot, 'chunks.json'), JSON.stringify(chunks, null, 2));
const lock = {
  corpus_id: manifest.corpus_id,
  project_id: manifest.project_id,
  created_at: new Date().toISOString(),
  manifest_sha256: createHash('sha256').update(await readFile(manifestPath)).digest('hex'),
  document_count: lockDocuments.length,
  chunk_count: chunks.length,
  documents: lockDocuments
};
await writeFile(path.join(outputRoot, 'corpus-lock.json'), JSON.stringify(lock, null, 2));
console.log(`Pinned ${lock.document_count} documents and wrote ${lock.chunk_count} chunks.`);
