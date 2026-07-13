#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { normalizeMarkdown } from '../../../packages/normalization/src/markdown.mjs';
import { chunkDocument } from '../../../packages/chunking/src/chunk.mjs';
import { createSingleProjectWidgetRuntime } from '../../api/src/widget-runtime.mjs';
import { issueWidgetToken, MemoryFeedbackStore } from '../../../packages/widget-api/src/index.mjs';

const TOKEN_SECRET = 'docsage-local-demo-token-secret-32-characters';
const MAX_DEMO_BODY = 16 * 1024;

function escapeAttribute(value) {
  return String(value).replace(/[&"'<>]/g, (char) => ({
    '&': '&amp;', '"': '&quot;', "'": '&#39;', '<': '&lt;', '>': '&gt;'
  })[char]);
}

async function demoChunks() {
  const sources = [
    { file: 'basic.md', title: 'Basic API', url: 'https://example.test/docs/basic', runtime: 'all' },
    { file: 'auth.md', title: 'Authentication', url: 'https://example.test/docs/auth', runtime: 'all' },
    { file: 'cloudflare.md', title: 'Cloudflare Workers', url: 'https://example.test/docs/cloudflare', runtime: 'cloudflare' }
  ];
  const chunks = [];
  for (const source of sources) {
    const markdown = await readFile(new URL(`../../../test/fixtures/${source.file}`, import.meta.url), 'utf8');
    const document = normalizeMarkdown({
      projectId: 'widget_demo',
      sourceRevisionId: `demo_${source.file}`,
      canonicalUrl: source.url,
      markdown,
      title: source.title,
      runtime: source.runtime,
      version: 'current',
      authorityLevel: 1
    });
    chunks.push(...chunkDocument(document, { maxChars: 700 }));
  }
  return chunks;
}

async function bodyBytes(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > MAX_DEMO_BODY) throw new Error('Demo request body is too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function toWebRequest(request, origin) {
  const method = request.method ?? 'GET';
  const body = ['GET', 'HEAD'].includes(method) ? undefined : await bodyBytes(request);
  return new Request(new URL(request.url ?? '/', origin), {
    method,
    headers: new Headers(Object.entries(request.headers).flatMap(([key, value]) => {
      if (Array.isArray(value)) return value.map((item) => [key, item]);
      return value === undefined ? [] : [[key, String(value)]];
    })),
    body: body?.length ? body : undefined
  });
}

async function sendWebResponse(response, nodeResponse) {
  nodeResponse.statusCode = response.status;
  for (const [name, value] of response.headers) nodeResponse.setHeader(name, value);
  const bytes = new Uint8Array(await response.arrayBuffer());
  nodeResponse.end(bytes);
}

function html(origin, token) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>DocSage Widget Demo</title>
  <style>
    :root { color-scheme: light dark; font-family: Inter, system-ui, sans-serif; }
    body { max-width: 760px; margin: 0 auto; padding: 56px 24px; line-height: 1.6; }
    code { padding: 2px 6px; border-radius: 6px; background: color-mix(in srgb, CanvasText 10%, Canvas); }
    .card { padding: 24px; border: 1px solid color-mix(in srgb, CanvasText 20%, Canvas); border-radius: 16px; }
  </style>
</head>
<body>
  <main>
    <h1>DocSage Widget Demo</h1>
    <div class="card">
      <p>This page runs the Phase 2 widget and API locally with the deterministic mini documentation corpus.</p>
      <p>Try <code>How do I read a path parameter?</code>, <code>How do I configure authentication?</code>, or an account-specific question to see a useful refusal.</p>
    </div>
  </main>
  <script type="module" src="/assets/docsage-widget.mjs"></script>
  <docsage-widget endpoint="${escapeAttribute(origin)}" token="${escapeAttribute(token)}" theme="auto"></docsage-widget>
</body>
</html>`;
}

export async function createDemoServer() {
  const chunks = await demoChunks();
  const feedbackStore = new MemoryFeedbackStore();
  const project = {
    id: 'widget_demo',
    name: 'DocSage Demo Docs',
    active: true,
    widget: { title: 'Ask the demo docs', placeholder: 'Ask about the demo API…', theme: 'auto' }
  };
  const widgetApp = createSingleProjectWidgetRuntime({
    tokenSecret: TOKEN_SECRET,
    project,
    chunks,
    feedbackStore
  });

  const server = createServer(async (request, response) => {
    const host = request.headers.host ?? 'localhost';
    const origin = `http://${host}`;
    const pathname = new URL(request.url ?? '/', origin).pathname;
    try {
      if (pathname === '/') {
        const token = await issueWidgetToken({
          secret: TOKEN_SECRET,
          projectId: project.id,
          origins: [origin],
          expiresInSeconds: 3600,
          keyId: 'local-demo'
        });
        const document = html(origin, token);
        response.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
          'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'"
        });
        response.end(document);
        return;
      }
      if (pathname === '/assets/docsage-widget.mjs' || pathname === '/assets/contracts.mjs') {
        const file = pathname.endsWith('contracts.mjs') ? 'contracts.mjs' : 'docsage-widget.mjs';
        const source = await readFile(new URL(`../../../packages/widget/src/${file}`, import.meta.url));
        response.writeHead(200, {
          'content-type': 'text/javascript; charset=utf-8',
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff'
        });
        response.end(source);
        return;
      }
      if (pathname.startsWith('/v1/widget/')) {
        const webRequest = await toWebRequest(request, origin);
        const webResponse = await widgetApp(webRequest, { clientKey: request.socket.remoteAddress ?? 'local' });
        await sendWebResponse(webResponse, response);
        return;
      }
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    } catch (error) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Demo request failed');
      console.error(error);
    }
  });

  return { server, feedbackStore, project };
}

export async function startDemoServer(options = {}) {
  const { port = Number(process.env.PORT ?? 4173), host = '127.0.0.1' } = options;
  const demo = await createDemoServer();
  await new Promise((resolve, reject) => {
    demo.server.once('error', reject);
    demo.server.listen(port, host, resolve);
  });
  const address = demo.server.address();
  const url = `http://${host}:${address.port}`;
  console.log(`DocSage widget demo: ${url}`);
  return { ...demo, url };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startDemoServer().catch((error) => {
    console.error(error.stack ?? error);
    process.exitCode = 1;
  });
}
