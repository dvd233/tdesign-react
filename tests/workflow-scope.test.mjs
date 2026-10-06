// Static workflow structure checks only. No Actions execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { root, readJson } from '../scripts/common.mjs';
import { APPROVED_TARGET } from '../scripts/execution-scope.mjs';
const workflow = await fs.readFile(path.join(root, '.github/workflows/validate-table-page-selection.yml'), 'utf8');
test('workflow job gates the same exact immutable approved target', () => {
  for (const [context, value] of [['repository', APPROVED_TARGET.repository], ['repository_id', APPROVED_TARGET.repositoryId], ['repository_owner_id', APPROVED_TARGET.ownerId], ['ref', APPROVED_TARGET.ref]]) {
    assert.ok(workflow.includes(`github.${context} == '${value}'`));
  }
  assert.ok(workflow.includes("(github.event_name == 'push' || github.event_name == 'workflow_dispatch')"));
});
test('execution-scope gate occurs before harness install or source fetch', () => {
  const gate = workflow.indexOf('node scripts/verify-execution-scope.mjs');
  assert.ok(gate >= 0 && gate < workflow.indexOf('npm ci') && gate < workflow.indexOf('git clone'));
});
test('source gate occurs after install and before native build', () => {
  const install = workflow.indexOf('pnpm -C "work/$variant" install --frozen-lockfile');
  const gate = workflow.indexOf('--out "evidence/$variant/source-after-install.json"');
  const build = workflow.indexOf('pnpm -C "work/$variant" run build');
  assert.ok(install >= 0 && install < gate && gate < build);
});
test('all official Actions remain pinned to the recorded full SHAs', async () => {
  const lock = await readJson(path.join(root, 'actions-lock.json'));
  const uses = Array.from(workflow.matchAll(/uses: ([^\s]+)/g), match => match[1]);
  assert.deepEqual(uses, lock.actions.map(action => `${action.repository}@${action.commitSha}`));
});
