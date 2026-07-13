import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import {
  buildAnswerRequest,
  normalizeAnswerPayload,
  normalizeEndpoint,
  normalizeWidgetConfig,
  safeExternalUrl
} from '../packages/widget/src/contracts.mjs';

test('normalizes widget endpoints and rejects unsafe schemes or credentials', () => {
  assert.equal(normalizeEndpoint('https://api.example.com/'), 'https://api.example.com');
  assert.equal(normalizeEndpoint('/docsage', 'http://localhost:8787/page'), 'http://localhost:8787/docsage');
  assert.throws(() => normalizeEndpoint('javascript:alert(1)'), /HTTP or HTTPS/);
  assert.throws(() => normalizeEndpoint('https://user:pass@example.com'), /without credentials/);
});

test('normalizes public config with bounded safe defaults', () => {
  const config = normalizeWidgetConfig({
    project: { id: 'p1', name: 'Example' },
    widget: { title: 'Ask Example', placeholder: 'Question', theme: 'dark' },
    limits: { questionCharacters: 900 }
  });
  assert.deepEqual(config, {
    project: { id: 'p1', name: 'Example' },
    title: 'Ask Example',
    placeholder: 'Question',
    theme: 'dark',
    questionCharacters: 900
  });
  assert.equal(normalizeWidgetConfig({ widget: { theme: 'unknown' } }).theme, 'auto');
});

test('normalizes answers and removes non-http citations', () => {
  const answer = normalizeAnswerPayload({
    requestId: 'req_1',
    traceId: 'run_1',
    state: 'supported',
    answer: 'Use the documented API.',
    citations: [
      { label: 'Usage', url: 'https://docs.example.com/usage' },
      { label: 'Bad', url: 'javascript:alert(1)' }
    ]
  });
  assert.equal(answer.stateLabel, 'Supported by the documentation');
  assert.deepEqual(answer.citations, [{ label: 'Usage', url: 'https://docs.example.com/usage' }]);
  assert.throws(() => normalizeAnswerPayload({ state: 'invented' }), /invalid/);
});

test('builds bounded answer requests without sending arbitrary page data', () => {
  assert.deepEqual(buildAnswerRequest('  How do I start?  ', 'https://docs.example.com/start', 100), {
    question: 'How do I start?',
    pageUrl: 'https://docs.example.com/start'
  });
  assert.deepEqual(buildAnswerRequest('Hello', 'javascript:alert(1)'), { question: 'Hello' });
  assert.throws(() => buildAnswerRequest('x'.repeat(11), null, 10), /between 1 and 10/);
  assert.equal(safeExternalUrl('data:text/plain,test'), null);
});

test('widget source uses safe DOM APIs and remains within the Phase 2 size budget', async () => {
  const source = await readFile(new URL('../packages/widget/src/docsage-widget.mjs', import.meta.url), 'utf8');
  assert.match(source, /attachShadow\(\{ mode: 'open' \}\)/);
  assert.match(source, /textContent/);
  assert.match(source, /role: 'dialog'/);
  assert.match(source, /aria-live/);
  assert.doesNotMatch(source, /\.innerHTML\s*=/);
  assert.doesNotMatch(source, /\beval\s*\(/);
  assert.doesNotMatch(source, /new\s+Function\b/);
  assert.doesNotMatch(source, /on(?:click|load|error)\s*=/i);
  assert.ok(gzipSync(source).byteLength <= 40 * 1024, `widget gzip size exceeded: ${gzipSync(source).byteLength}`);
});
