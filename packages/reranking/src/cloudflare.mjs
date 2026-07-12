const MODEL = '@cf/baai/bge-reranker-base';

function extractRanking(payload, count) {
  const response = payload?.result?.response ?? payload?.result ?? payload?.response ?? payload;
  if (!Array.isArray(response)) throw new Error('Cloudflare reranker response did not contain a ranking array');
  return response.map((item, position) => ({
    index: Number(item.index ?? item.id ?? position),
    score: Number(item.score ?? item.relevance_score ?? item.relevanceScore ?? 0)
  })).filter((item) => Number.isInteger(item.index) && item.index >= 0 && item.index < count)
    .sort((a, b) => b.score - a.score);
}

export class CloudflareReranker {
  name = MODEL;

  constructor(options = {}) {
    this.accountId = options.accountId ?? process.env.CLOUDFLARE_ACCOUNT_ID;
    this.apiToken = options.apiToken ?? process.env.CLOUDFLARE_API_TOKEN ?? process.env.CLOUDFLARE_AUTH_TOKEN;
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  async rerank(query, chunks, options = {}) {
    if (!this.accountId) throw new Error('CLOUDFLARE_ACCOUNT_ID is required');
    if (!this.apiToken) throw new Error('CLOUDFLARE_API_TOKEN is required');
    if (!chunks.length) return [];
    const response = await this.fetch(`https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${MODEL}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiToken}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        query,
        contexts: chunks.map((chunk) => ({ text: chunk.searchText })),
        top_k: Math.min(options.limit ?? chunks.length, chunks.length)
      }),
      signal: AbortSignal.timeout(30_000)
    });
    if (!response.ok) throw new Error(`Cloudflare reranking failed: HTTP ${response.status} ${await response.text()}`);
    const ranking = extractRanking(await response.json(), chunks.length);
    return ranking.map((item) => ({ ...chunks[item.index], rerankScore: item.score }));
  }
}
