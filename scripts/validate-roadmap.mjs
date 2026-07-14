#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const manifestPath = path.join(root, 'docs/roadmap/remaining-phases.manifest.json');
const planPath = path.join(root, 'docs/roadmap/remaining-phases.md');

function fail(message) {
  throw new Error(`Roadmap validation failed: ${message}`);
}

const [manifestText, plan] = await Promise.all([
  readFile(manifestPath, 'utf8'),
  readFile(planPath, 'utf8')
]);
const planLower = plan.toLowerCase();

let manifest;
try {
  manifest = JSON.parse(manifestText);
} catch (error) {
  fail(`manifest is not valid JSON: ${error.message}`);
}

if (manifest.schemaVersion !== 1) fail('schemaVersion must be 1');
if (manifest.roadmapId !== 'docsage-remaining-phases') fail('unexpected roadmapId');
if (manifest.trigger?.default !== 'build') fail('default trigger must be "build"');
if (manifest.trigger?.specific !== 'build phase N') fail('specific trigger must be "build phase N"');

const regressionCommands = manifest.requiredRegressionCommands ?? [];
for (const command of ['npm run check', 'npm run gate:hono', 'npm run gate:widget']) {
  if (!regressionCommands.includes(command)) fail(`missing regression command: ${command}`);
  if (!plan.includes(command)) fail(`plan does not document regression command: ${command}`);
}

if (!plan.includes('docs/phase-N/implementation-plan.md')) {
  fail('plan must define the generic phase-lock document path');
}

const readiness = manifest.externalReadinessTrack ?? [];
if (readiness.length !== 3) fail('externalReadinessTrack must contain exactly three current blockers');
for (const item of readiness) {
  if (!item.id || !item.requiredEvidence) fail('readiness entries require id and requiredEvidence');
  if (item.currentStatus !== 'incomplete') fail(`readiness item ${item.id} must remain incomplete until evidence is committed`);
  if (item.mayBeSelfCertified !== false) fail(`readiness item ${item.id} cannot be self-certified`);
}

const phases = manifest.phases ?? [];
if (phases.length !== 4) fail('exactly four tracked phases are required');
const expectedNumbers = [3, 4, 5, 6];
const allowedStatuses = new Set(['incomplete', 'engineering_complete', 'pilot_validated']);
const ids = new Set();
let incompleteSeen = false;

for (let index = 0; index < phases.length; index += 1) {
  const phase = phases[index];
  const expected = expectedNumbers[index];
  if (phase.number !== expected) fail(`phase order must be 3, 4, 5, 6; found ${phase.number} at index ${index}`);
  if (!phase.id || ids.has(phase.id)) fail(`phase ${phase.number} has a missing or duplicate id`);
  ids.add(phase.id);
  if (!allowedStatuses.has(phase.status)) fail(`phase ${phase.number} has unsupported status ${phase.status}`);
  if (phase.status === 'incomplete') incompleteSeen = true;
  if (incompleteSeen && phase.status !== 'incomplete') fail(`phase ${phase.number} cannot be complete while an earlier phase is incomplete`);
  if (phase.status !== 'incomplete') {
    if (!phase.completedAt) fail(`phase ${phase.number} completion requires completedAt`);
    if (!regressionCommands.includes(phase.gateCommand)) fail(`completed phase ${phase.number} gate must be a required regression command`);
    await access(path.join(root, phase.lockDocument)).catch(() => fail(`completed phase ${phase.number} lock document is missing`));
    await access(path.join(root, phase.reviewDocument)).catch(() => fail(`completed phase ${phase.number} review document is missing`));
  }
  const expectedPrerequisite = phase.number - 1;
  if (phase.prerequisites?.length !== 1 || phase.prerequisites[0] !== expectedPrerequisite) {
    fail(`phase ${phase.number} must depend on phase ${expectedPrerequisite}`);
  }
  if (phase.lockDocument !== `docs/phase-${phase.number}/implementation-plan.md`) {
    fail(`phase ${phase.number} lockDocument is inconsistent`);
  }
  if (!phase.reviewDocument?.includes(`phase-${phase.number}`)) fail(`phase ${phase.number} reviewDocument is inconsistent`);
  if (!phase.gateCommand?.startsWith('npm run gate:')) fail(`phase ${phase.number} gateCommand is invalid`);
  if (!Array.isArray(phase.slices) || phase.slices.length !== 4 || phase.slices.some((slice) => !slice)) {
    fail(`phase ${phase.number} must define four non-empty slices`);
  }
  if (!Array.isArray(phase.requiredOutcomes) || phase.requiredOutcomes.length < 5) {
    fail(`phase ${phase.number} must define at least five required outcomes`);
  }
  if (!phase.externalGoEvidence) fail(`phase ${phase.number} requires an externalGoEvidence statement`);

  const heading = `Phase ${phase.number} — ${phase.name}`;
  for (const requiredText of [heading, phase.gateCommand, phase.reviewDocument]) {
    if (!plan.includes(requiredText)) fail(`plan is missing phase ${phase.number} reference: ${requiredText}`);
  }
  for (const slice of phase.slices) {
    const readable = slice.split('-').map((word) => word[0]?.toUpperCase() + word.slice(1)).join(' ');
    if (!planLower.includes(slice.replaceAll('-', ' ')) && !plan.includes(readable)) {
      const concepts = slice.split('-').filter((word) => word.length > 3);
      if (!concepts.every((concept) => planLower.includes(concept))) {
        fail(`plan does not cover phase ${phase.number} slice: ${slice}`);
      }
    }
  }
}

const protocol = manifest.mergeProtocol ?? {};
if (protocol.base !== 'main') fail('mergeProtocol base must be main');
if (protocol.requireGreenCi !== true) fail('green CI must be required');
if (protocol.verifyMainAfterMerge !== true) fail('main verification after merge must be required');
if (protocol.continueAutomatically !== true) fail('automatic continuation between slices must be enabled');
if (protocol.mergeMethod !== 'squash') fail('default merge method must be squash');

const requiredReportFields = [
  'branch',
  'pullRequest',
  'validatedHeadSha',
  'ciResults',
  'mergeSha',
  'mainHead',
  'gates',
  'remainingBlockers'
];
for (const field of requiredReportFields) {
  if (!protocol.completionReportFields?.includes(field)) fail(`missing completion report field: ${field}`);
}

for (const phrase of [
  'four numbered product phases remain',
  'when the user says **`build`**',
  'commit, push, open a pull request',
  'verify the new `main` head',
  'no autonomous repository mutation or merge'
]) {
  if (!planLower.includes(phrase.toLowerCase())) fail(`plan is missing required policy phrase: ${phrase}`);
}

const incompletePhases = phases.filter((phase) => phase.status === 'incomplete');
console.log(JSON.stringify({
  valid: true,
  roadmapId: manifest.roadmapId,
  trackedPhaseCount: phases.length,
  remainingPhaseCount: incompletePhases.length,
  nextIncompletePhase: incompletePhases[0]?.number ?? null,
  phases: phases.map(({ number, id, name, status, gateCommand }) => ({ number, id, name, status, gateCommand })),
  externalReadinessItems: readiness.map(({ id, currentStatus }) => ({ id, currentStatus }))
}, null, 2));
