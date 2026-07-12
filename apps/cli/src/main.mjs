#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { answerQuestion } from '../../../packages/answering/src/engine.mjs';
import { ClaudeProvider } from '../../../packages/answering/src/claude-provider.mjs';
import { readJsonl, runEvaluation } from '../../../packages/evaluation/src/runner.mjs';

const root = path.resolve(import.meta.dirname, '../../..');
const [command = 'help', ...args] = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const index = args.indexOf(name);
  return index >= 0 ? (args[index + 1] ?? true) : fallback;
};

async function ensureMiniCorpus() {
  try { return JSON.parse(await readFile(path.join(root, '.tmp/mini-chunks.json'), 'utf8')); }
  catch {
    const result = spawnSync(process.execPath, [path.join(root, 'scripts/build-mini-corpus.mjs')], { stdio: 'inherit' });
    if (result.status !== 0) throw new Error('Could not build mini corpus');
    return JSON.parse(await readFile(path.join(root, '.tmp/mini-chunks.json'), 'utf8'));
  }
}

function printAnswer(response) {
  console.log(`State: ${response.state}`);
  console.log(`Trace: ${response.traceId}`);
  console.log(`Assumptions: version=${response.assumptions.version}, runtime=${response.assumptions.runtime}`);
  console.log(`\n${response.answer || '(no answer)'}\n`);
  if (response.citations.length) {
    console.log('Evidence:');
    response.citations.forEach((citation, index) => console.log(`${index + 1}. ${citation.url}#${encodeURIComponent(citation.anchor ?? '')}`));
  }
  console.log(`\nProvider: ${response.provider}; latency=${response.latencyMs.toFixed(1)}ms`);
}

async function main() {
  if (command === 'help') {
    console.log('docsage commands: demo | ask --question "..." [--provider extractive|claude] | eval --dataset file --chunks file [--allow-candidate]');
    return;
  }
  const chunks = await ensureMiniCorpus();
  if (command === 'demo') {
    printAnswer(await answerQuestion({ question: 'How do I read a path parameter?', projectId: 'mini', chunks }));
    return;
  }
  if (command === 'ask') {
    const question = flag('--question');
    if (!question) throw new Error('--question is required');
    const providerName = flag('--provider', 'extractive');
    const provider = providerName === 'claude' ? new ClaudeProvider() : undefined;
    printAnswer(await answerQuestion({ question, projectId: flag('--project', 'mini'), chunks, provider, runtime: flag('--runtime', 'all'), version: flag('--version', 'current') }));
    return;
  }
  if (command === 'eval') {
    const dataset = flag('--dataset', path.join(root, 'test/fixtures/mini-evals.jsonl'));
    const chunkFile = flag('--chunks', path.join(root, '.tmp/mini-chunks.json'));
    const cases = await readJsonl(dataset);
    const evalChunks = JSON.parse(await readFile(chunkFile, 'utf8'));
    const outputDirectory = flag('--out', path.join(root, '.tmp/eval-run'));
    const result = await runEvaluation({ cases, chunks: evalChunks, projectId: flag('--project', 'mini'), allowCandidate: args.includes('--allow-candidate'), outputDirectory });
    console.log(JSON.stringify(result.metrics, null, 2));
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => { console.error(error.stack); process.exitCode = 1; });
