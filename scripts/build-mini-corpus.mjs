import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { normalizeMarkdown } from '../packages/normalization/src/markdown.mjs';
import { chunkDocument } from '../packages/chunking/src/chunk.mjs';

const root = path.resolve(import.meta.dirname, '..');
const fixtureDirectory = path.join(root, 'test/fixtures');
const sources = [
  { file: 'basic.md', url: 'https://example.test/docs/basic', title: 'Basic API', authorityLevel: 1, version: 'current', runtime: 'all' },
  { file: 'auth.md', url: 'https://example.test/docs/auth', title: 'Authentication', authorityLevel: 1, version: 'current', runtime: 'all' },
  { file: 'cloudflare.md', url: 'https://example.test/docs/cloudflare', title: 'Cloudflare Workers', authorityLevel: 2, version: 'current', runtime: 'cloudflare' }
];
const chunks = [];
for (const source of sources) {
  const markdown = await readFile(path.join(fixtureDirectory, source.file), 'utf8');
  const document = normalizeMarkdown({ projectId: 'mini', sourceRevisionId: 'rev_fixture', canonicalUrl: source.url, markdown, ...source });
  chunks.push(...chunkDocument(document, { maxChars: 700 }));
}
await mkdir(path.join(root, '.tmp'), { recursive: true });
await writeFile(path.join(root, '.tmp/mini-chunks.json'), JSON.stringify(chunks, null, 2));
console.log(`Wrote ${chunks.length} chunks to .tmp/mini-chunks.json`);
