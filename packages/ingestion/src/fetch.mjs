import { assertPublicUrl } from './safe-url.mjs';

const DEFAULT_TYPES = ['text/html', 'text/plain', 'text/markdown', 'application/json'];

export async function safeFetchText(input, options = {}) {
  const {
    fetchImpl = globalThis.fetch,
    lookup,
    maxRedirects = 4,
    maxBytes = 2_000_000,
    timeoutMs = 10_000,
    allowedContentTypes = DEFAULT_TYPES,
    headers = {}
  } = options;
  if (typeof fetchImpl !== 'function') throw new Error('fetch is unavailable');

  let current = await assertPublicUrl(input, { lookup, allowHttp: options.allowHttp });
  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(current, { redirect: 'manual', headers, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location || redirects === maxRedirects) throw Object.assign(new Error('Unsafe or excessive redirect'), { code: 'INGEST_FETCH_FAIL' });
      current = await assertPublicUrl(new URL(location, current).toString(), { lookup, allowHttp: options.allowHttp });
      continue;
    }
    if (!response.ok) throw Object.assign(new Error(`Fetch failed: ${response.status}`), { code: 'INGEST_FETCH_FAIL' });

    const contentType = (response.headers.get('content-type') ?? 'text/plain').split(';')[0].trim().toLowerCase();
    if (!allowedContentTypes.includes(contentType)) {
      throw Object.assign(new Error(`Unsupported content type: ${contentType}`), { code: 'INGEST_FETCH_FAIL' });
    }

    const reader = response.body?.getReader();
    if (!reader) return { url: current.toString(), contentType, text: await response.text() };
    const chunks = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw Object.assign(new Error('Response exceeds byte limit'), { code: 'INGEST_FETCH_FAIL' });
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return { url: current.toString(), contentType, text: new TextDecoder().decode(bytes) };
  }
  throw Object.assign(new Error('Redirect loop'), { code: 'INGEST_FETCH_FAIL' });
}
