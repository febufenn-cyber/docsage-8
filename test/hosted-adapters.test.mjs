import test from 'node:test';
import assert from 'node:assert/strict';
import { CloudflareEmbeddingProvider } from '../packages/embeddings/src/cloudflare.mjs';
import { CloudflareReranker } from '../packages/reranking/src/cloudflare.mjs';

test('Cloudflare embedding adapter parses vectors without real credentials', async () => {
  const provider = new CloudflareEmbeddingProvider({
    accountId: 'test', apiToken: 'test',
    fetch: async () => new Response(JSON.stringify({ result: { data: [[1, 0], [0, 1]] } }), { status: 200 })
  });
  assert.deepEqual(await provider.embed(['a', 'b']), [[1, 0], [0, 1]]);
});

test('Cloudflare reranker preserves chunk identity and score order', async () => {
  const provider = new CloudflareReranker({
    accountId: 'test', apiToken: 'test',
    fetch: async () => new Response(JSON.stringify({ result: { response: [{ index: 1, score: 0.9 }, { index: 0, score: 0.2 }] } }), { status: 200 })
  });
  const result = await provider.rerank('q', [{ id: 'a', searchText: 'a' }, { id: 'b', searchText: 'b' }]);
  assert.deepEqual(result.map((item) => item.id), ['b', 'a']);
});
