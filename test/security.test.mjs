import test from 'node:test';
import assert from 'node:assert/strict';
import { assertPublicUrl, isBlockedAddress } from '../packages/ingestion/src/safe-url.mjs';

const lookup = async (hostname) => hostname === 'public.example' ? [{ address: '93.184.216.34' }] : [{ address: '127.0.0.1' }];

test('blocks loopback and metadata networks', () => {
  assert.equal(isBlockedAddress('127.0.0.1'), true);
  assert.equal(isBlockedAddress('169.254.169.254'), true);
  assert.equal(isBlockedAddress('10.1.2.3'), true);
  assert.equal(isBlockedAddress('93.184.216.34'), false);
});

test('safe URL validation rejects a redirect destination resolving privately', async () => {
  await assert.rejects(() => assertPublicUrl('https://private.example/docs', { lookup }), { code: 'SAFE_SSRF' });
  const url = await assertPublicUrl('https://public.example/docs', { lookup });
  assert.equal(url.hostname, 'public.example');
});
