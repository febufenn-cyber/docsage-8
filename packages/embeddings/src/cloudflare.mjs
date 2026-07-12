const MODEL = '@cf/qwen/qwen3-embedding-0.6b';

function requireValue(value, name) {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function extractVectors(payload) {
  const result = payload?.result ?? payload;
  const vectors = result?.data ?? result?.embeddings ?? result?.response ?? result;
  if (!Array.isArray(vectors)) throw new Error('Cloudflare embedding response did not contain an array');
  if (vectors.length && Array.isArray(vectors[0])) return vectors;
  if (vectors.length && Array.isArray(vectors[0]?.embedding)) return vectors.map((item) => item.embedding);
  throw new Error('Cloudflare embedding response shape was not recognized');
}

export class CloudflareEmbeddingProvider {
  name = MODEL;

  constructor(options = {}) {
    this.accountId = options.accountId ?? process.env.CLOUDFLARE_ACCOUNT_ID;
    this.apiToken = options.apiToken ?? process.env.CLOUDFLARE_API_TOKEN ?? process.env.CLOUDFLARE_AUTH_TOKEN;
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  async embed(texts) {
    requireValue(this.accountId, 'CLOUDFLARE_ACCOUNT_ID');
    requireValue(this.apiToken, 'CLOUDFLARE_API_TOKEN');
    if (!Array.isArray(texts) || texts.length === 0) return [];
    const response = await this.fetch(`https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${MODEL}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiToken}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ text: texts }),
      signal: AbortSignal.timeout(30_000)
    });
    if (!response.ok) throw new Error(`Cloudflare embeddings failed: HTTP ${response.status} ${await response.text()}`);
    return extractVectors(await response.json());
  }
}
