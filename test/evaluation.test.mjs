import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeMarkdown } from '../packages/normalization/src/markdown.mjs';
import { chunkDocument } from '../packages/chunking/src/chunk.mjs';
import { readJsonl, runEvaluation } from '../packages/evaluation/src/runner.mjs';

async function corpus() {
  const definitions = [
    ['basic.md', 'https://example.test/docs/basic', 'all'],
    ['auth.md', 'https://example.test/docs/auth', 'all'],
    ['cloudflare.md', 'https://example.test/docs/cloudflare', 'cloudflare']
  ];
  const output = [];
  for (const [file, url, runtime] of definitions) {
    const markdown = await readFile(new URL(`./fixtures/${file}`, import.meta.url), 'utf8');
    output.push(...chunkDocument(normalizeMarkdown({ projectId: 'mini', sourceRevisionId: `rev_${file}`, canonicalUrl: url, markdown, title: file, runtime }), { maxChars: 700 }));
  }
  return output;
}

test('evaluation runner scores verified cases', async () => {
  const cases = await readJsonl(new URL('./fixtures/mini-evals.jsonl', import.meta.url));
  const result = await runEvaluation({ cases, chunks: await corpus(), projectId: 'mini' });
  assert.equal(result.metrics.caseCount, 4);
  assert.equal(result.metrics.abstentionAccuracy, 1);
  assert.ok(result.metrics.retrievalRecallAt8 >= 0.5);
});
