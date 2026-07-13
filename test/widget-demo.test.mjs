import test from 'node:test';
import assert from 'node:assert/strict';
import { startDemoServer } from '../apps/widget/demo/server.mjs';

function auth(token, origin) {
  return { authorization: `Bearer ${token}`, origin };
}

test('local widget demo exercises config, answer, refusal, citations, and feedback', async (context) => {
  const demo = await startDemoServer({ port: 0 });
  context.after(() => new Promise((resolve) => demo.server.close(resolve)));

  const page = await fetch(demo.url);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /<docsage-widget/);
  const token = html.match(/token="([^"]+)"/)?.[1];
  assert.ok(token, 'demo page did not contain a widget token');

  const moduleResponse = await fetch(`${demo.url}/assets/docsage-widget.mjs`);
  assert.equal(moduleResponse.status, 200);
  assert.match(moduleResponse.headers.get('content-type'), /javascript/);

  const config = await fetch(`${demo.url}/v1/widget/config`, { headers: auth(token, demo.url) });
  assert.equal(config.status, 200);
  assert.equal((await config.json()).project.id, 'widget_demo');

  const answer = await fetch(`${demo.url}/v1/widget/answer`, {
    method: 'POST',
    headers: { ...auth(token, demo.url), 'content-type': 'application/json' },
    body: JSON.stringify({ question: 'How do I read a path parameter?', pageUrl: `${demo.url}/` })
  });
  assert.equal(answer.status, 200);
  const answerBody = await answer.json();
  assert.ok(['supported', 'partially_supported'].includes(answerBody.state));
  assert.match(answerBody.answer, /c\.req\.param/);
  assert.ok(answerBody.citations.length >= 1);

  const refusal = await fetch(`${demo.url}/v1/widget/answer`, {
    method: 'POST',
    headers: { ...auth(token, demo.url), 'content-type': 'application/json' },
    body: JSON.stringify({ question: 'Why did my private deployment fail at 3:17 PM?' })
  });
  assert.equal(refusal.status, 200);
  assert.equal((await refusal.json()).state, 'account_specific');

  const feedbackPayload = {
    eventId: '44444444-4444-4444-8444-444444444444',
    traceId: answerBody.traceId,
    rating: 'useful',
    reason: 'clear_answer'
  };
  const feedback = await fetch(`${demo.url}/v1/widget/feedback`, {
    method: 'POST',
    headers: { ...auth(token, demo.url), 'content-type': 'application/json' },
    body: JSON.stringify(feedbackPayload)
  });
  assert.equal(feedback.status, 202);
  assert.deepEqual(await feedback.json(), { accepted: true, duplicate: false });

  const duplicate = await fetch(`${demo.url}/v1/widget/feedback`, {
    method: 'POST',
    headers: { ...auth(token, demo.url), 'content-type': 'application/json' },
    body: JSON.stringify(feedbackPayload)
  });
  assert.equal(duplicate.status, 200);
  assert.deepEqual(await duplicate.json(), { accepted: true, duplicate: true });
  assert.equal((await demo.feedbackStore.list()).length, 1);
});
