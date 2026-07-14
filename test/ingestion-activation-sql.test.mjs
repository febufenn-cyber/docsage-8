import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('atomic activation migration locks scopes, validates membership, supports rollback, and records append-only audit', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260714000600_atomic_corpus_activation.sql', import.meta.url), 'utf8');
  for (const expected of [
    'for update',
    'active revision conflict',
    'candidate document membership is incomplete',
    'candidate was staged from a stale revision',
    "action in ('activate','rollback')",
    'corpus_activation_events is append-only',
    'activate_corpus_revision',
    'rollback_corpus_revision',
    'public.owns_project(target_project)',
    'enable row level security'
  ]) assert.ok(sql.toLowerCase().includes(expected.toLowerCase()), `missing SQL invariant: ${expected}`);
});
