import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeMarkdown } from '../packages/normalization/src/markdown.mjs';
import { chunkDocument } from '../packages/chunking/src/chunk.mjs';

const markdown = await readFile(new URL('./fixtures/basic.md', import.meta.url), 'utf8');

test('normalization preserves headings and code', () => {
  const document = normalizeMarkdown({ projectId: 'p1', sourceRevisionId: 'r1', canonicalUrl: 'https://example.test/basic', markdown, title: 'Basic' });
  assert.ok(document.blocks.some((block) => block.type === 'heading' && block.text === 'Path parameters'));
  assert.ok(document.blocks.some((block) => block.type === 'code' && block.text.includes('app.get')));
});

test('chunking retains source lineage and code attachments', () => {
  const document = normalizeMarkdown({ projectId: 'p1', sourceRevisionId: 'r1', canonicalUrl: 'https://example.test/basic', markdown, title: 'Basic' });
  const chunks = chunkDocument(document, { maxChars: 300 });
  assert.ok(chunks.length >= 2);
  assert.ok(chunks.every((chunk) => chunk.projectId === 'p1' && chunk.sourceRevisionId === 'r1'));
  assert.ok(chunks.some((chunk) => chunk.displayText.includes('c.json') && chunk.blockTypes.includes('code')));
});
