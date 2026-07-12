import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'evals/datasets/hono-phase0.manifest.json');
const required = ['id','question','category','answerable','expected_state','risk','expected_sources','must_include','must_not_claim','version_scope','runtime_scope','annotation_status','split','notes'];

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const ids = new Set();
  let total = 0;
  for (const shard of manifest.shards) {
    const filePath = path.join(root, 'evals/datasets', shard.path);
    const bytes = await readFile(filePath);
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (digest !== shard.sha256) throw new Error(`${shard.path}: SHA-256 mismatch`);
    const lines = bytes.toString('utf8').split(/\r?\n/).filter(Boolean);
    if (lines.length !== shard.cases) throw new Error(`${shard.path}: expected ${shard.cases} cases, got ${lines.length}`);
    for (const [index, line] of lines.entries()) {
      const item = JSON.parse(line);
      for (const field of required) if (!(field in item)) throw new Error(`${shard.path}:${index + 1}: missing ${field}`);
      if (ids.has(item.id)) throw new Error(`Duplicate evaluation id: ${item.id}`);
      if (!Array.isArray(item.expected_sources) || !Array.isArray(item.must_include) || !Array.isArray(item.must_not_claim)) throw new Error(`${item.id}: array field invalid`);
      ids.add(item.id);
    }
    total += lines.length;
  }
  if (total !== manifest.case_count) throw new Error(`Manifest expected ${manifest.case_count}, got ${total}`);
  console.log(`Validated ${total} evaluation cases across ${manifest.shards.length} shards.`);
}

main().catch((error) => { console.error(error.stack); process.exitCode = 1; });
