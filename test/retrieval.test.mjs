import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeMarkdown } from '../packages/normalization/src/markdown.mjs';
import { chunkDocument } from '../packages/chunking/src/chunk.mjs';
import { hybridRetrieve } from '../packages/retrieval/src/hybrid.mjs';

async function chunks(file, url, projectId = 'p1', runtime = 'all') {
  const markdown = await readFile(new URL(`./fixtures/${file}`, import.meta.url), 'utf8');
  return chunkDocument(normalizeMarkdown({ projectId, sourceRevisionId: `rev_${file}`, canonicalUrl: url, markdown, title: file, runtime }), { maxChars: 500 });
}

test('hybrid retrieval finds exact API identifiers', async () => {
  const corpus = [...await chunks('basic.md', 'https://example.test/basic'), ...await chunks('auth.md', 'https://example.test/auth')];
  const results = hybridRetrieve({ query: 'How do I use `c.req.param`?', chunks: corpus, projectId: 'p1' });
  assert.equal(results[0].canonicalUrl, 'https://example.test/basic');
  assert.ok(results[0].exactMatches > 0);
});

test('retrieval enforces project scope', async () => {
  const corpus = [...await chunks('basic.md', 'https://example.test/basic', 'p1'), ...await chunks('auth.md', 'https://example.test/auth', 'p2')];
  const results = hybridRetrieve({ query: 'bearer authentication', chunks: corpus, projectId: 'p1' });
  assert.ok(results.every((item) => item.projectId === 'p1'));
  assert.ok(!results.some((item) => item.canonicalUrl.includes('auth')));
});

test('runtime filter excludes Cloudflare-only evidence for Node', async () => {
  const corpus = await chunks('cloudflare.md', 'https://example.test/cloudflare', 'p1', 'cloudflare');
  const results = hybridRetrieve({ query: 'Where are bindings?', chunks: corpus, projectId: 'p1', runtime: 'node' });
  assert.equal(results.length, 0);
});
