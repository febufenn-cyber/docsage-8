#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { startDemoServer } from '../apps/widget/demo/server.mjs';

const root = path.resolve(import.meta.dirname, '..');
const outputDirectory = path.join(root, '.tmp/widget-gate');

function markdown(gate) {
  const yes = (value) => value ? 'pass' : 'fail';
  return `# Phase 2 widget gate\n\n- Decision: **${gate.decision}**\n- Engineering passed: **${gate.engineeringPassed}**\n- Created: ${gate.createdAt}\n\n| Check | Result |\n|---|---:|\n| Widget gzip ≤ 40 KiB | ${yes(gate.checks.assetSize)} (${gate.metrics.gzipBytes} bytes) |\n| No unsafe code patterns | ${yes(gate.checks.safeSource)} |\n| Accessibility markers | ${yes(gate.checks.accessibility)} |\n| Demo page and module | ${yes(gate.checks.demoAssets)} |\n| Config contract | ${yes(gate.checks.config)} |\n| Answer and citation | ${yes(gate.checks.answer)} |\n| Useful refusal | ${yes(gate.checks.refusal)} |\n| Origin enforcement | ${yes(gate.checks.originEnforcement)} |\n| Feedback accepted | ${yes(gate.checks.feedback)} |\n| Feedback idempotency | ${yes(gate.checks.feedbackIdempotency)} |\n\n## Blockers\n\n${gate.blockers.map((item) => `- ${item}`).join('\n') || '- None'}\n`;
}

async function json(response) {
  try { return await response.json(); } catch { return null; }
}

async function run() {
  const source = await readFile(path.join(root, 'packages/widget/src/docsage-widget.mjs'), 'utf8');
  const gzipBytes = gzipSync(source).byteLength;
  const forbidden = [
    { name: 'innerHTML', pattern: /\.innerHTML\s*=/ },
    { name: 'eval', pattern: /\beval\s*\(/ },
    { name: 'new Function', pattern: /new\s+Function\b/ },
    { name: 'inline handler', pattern: /on(?:click|load|error)\s*=/i }
  ].filter((item) => item.pattern.test(source)).map((item) => item.name);
  const accessibilityMarkers = [
    /role: 'dialog'/,
    /aria-live/,
    /aria-expanded/,
    /event\.key === 'Escape'/,
    /this\._launcher\.focus\(\)/,
    /prefers-reduced-motion/
  ];

  const demo = await startDemoServer({ port: 0 });
  try {
    const pageResponse = await fetch(demo.url);
    const pageHtml = await pageResponse.text();
    const widgetToken = pageHtml.match(/token="([^"]+)"/)?.[1] ?? '';
    const moduleResponse = await fetch(`${demo.url}/assets/docsage-widget.mjs`);
    const moduleText = await moduleResponse.text();
    const headers = { authorization: `Bearer ${widgetToken}`, origin: demo.url };

    const configResponse = await fetch(`${demo.url}/v1/widget/config`, { headers });
    const configBody = await json(configResponse);
    const answerResponse = await fetch(`${demo.url}/v1/widget/answer`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ question: 'How do I read a path parameter?', pageUrl: `${demo.url}/` })
    });
    const answerBody = await json(answerResponse);
    const refusalResponse = await fetch(`${demo.url}/v1/widget/answer`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ question: 'Why did my private deployment fail at 3:17 PM?' })
    });
    const refusalBody = await json(refusalResponse);
    const deniedResponse = await fetch(`${demo.url}/v1/widget/config`, {
      headers: { authorization: `Bearer ${widgetToken}`, origin: 'https://not-allowed.example' }
    });
    const deniedBody = await json(deniedResponse);
    const feedbackPayload = {
      eventId: '55555555-5555-4555-8555-555555555555',
      traceId: answerBody?.traceId,
      rating: 'useful',
      reason: 'clear_answer'
    };
    const feedbackResponse = await fetch(`${demo.url}/v1/widget/feedback`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify(feedbackPayload)
    });
    const feedbackBody = await json(feedbackResponse);
    const duplicateResponse = await fetch(`${demo.url}/v1/widget/feedback`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify(feedbackPayload)
    });
    const duplicateBody = await json(duplicateResponse);

    const checks = {
      assetSize: gzipBytes <= 40 * 1024,
      safeSource: forbidden.length === 0,
      accessibility: accessibilityMarkers.every((pattern) => pattern.test(source)),
      demoAssets: pageResponse.status === 200 && moduleResponse.status === 200 && moduleText.includes('customElements.define') && Boolean(widgetToken),
      config: configResponse.status === 200 && configBody?.project?.id === 'widget_demo' && configBody?.limits?.questionCharacters === 1000,
      answer: answerResponse.status === 200 && ['supported', 'partially_supported'].includes(answerBody?.state) && /c\.req\.param/.test(answerBody?.answer ?? '') && (answerBody?.citations?.length ?? 0) >= 1,
      refusal: refusalResponse.status === 200 && refusalBody?.state === 'account_specific',
      originEnforcement: deniedResponse.status === 403 && deniedBody?.error?.code === 'ORIGIN_NOT_ALLOWED',
      feedback: feedbackResponse.status === 202 && feedbackBody?.accepted === true && feedbackBody?.duplicate === false,
      feedbackIdempotency: duplicateResponse.status === 200 && duplicateBody?.accepted === true && duplicateBody?.duplicate === true && (await demo.feedbackStore.list()).length === 1
    };
    const engineeringPassed = Object.values(checks).every(Boolean);
    const gate = {
      createdAt: new Date().toISOString(),
      decision: engineeringPassed ? 'CONDITIONAL_GO' : 'REPEAT_PHASE_2',
      engineeringPassed,
      pilotDeploymentCompleted: false,
      checks,
      metrics: {
        rawBytes: Buffer.byteLength(source),
        gzipBytes,
        forbiddenPatterns: forbidden,
        answerState: answerBody?.state ?? null,
        citationCount: answerBody?.citations?.length ?? 0,
        refusalState: refusalBody?.state ?? null,
        feedbackEntries: (await demo.feedbackStore.list()).length
      },
      blockers: [
        'No public documentation-site pilot deployment has been completed.',
        'The Phase 1 independent human review and credentialed hosted-model benchmark remain incomplete.'
      ]
    };

    await mkdir(outputDirectory, { recursive: true });
    await writeFile(path.join(outputDirectory, 'gate.json'), JSON.stringify(gate, null, 2));
    await writeFile(path.join(outputDirectory, 'report.md'), markdown(gate));
    console.log(JSON.stringify(gate, null, 2));
    if (!engineeringPassed) process.exitCode = 1;
  } finally {
    await new Promise((resolve) => demo.server.close(resolve));
  }
}

run().catch((error) => {
  console.error(error.stack ?? error);
  process.exitCode = 1;
});
