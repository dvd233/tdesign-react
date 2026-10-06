// Synthetic GitHub context validation only; no GitHub call or dispatch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { APPROVED_TARGET, verifyExecutionScope, verifyApprovedManifest } from '../scripts/execution-scope.mjs';
const manifest = () => ({ approvedTarget: { ...APPROVED_TARGET }, candidate: { repository: APPROVED_TARGET.repository } });
const context = () => ({ GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: APPROVED_TARGET.repository, GITHUB_REPOSITORY_ID: APPROVED_TARGET.repositoryId, GITHUB_REPOSITORY_OWNER_ID: APPROVED_TARGET.ownerId, GITHUB_REF: APPROVED_TARGET.ref, GITHUB_EVENT_NAME: 'push' });
for (const event of ['push', 'workflow_dispatch']) test(`accepts exact approved identity and branch for ${event}`, () => {
  verifyExecutionScope({ ...context(), GITHUB_EVENT_NAME: event }, manifest());
});
for (const [key, value] of [
  ['GITHUB_ACTIONS', 'false'], ['GITHUB_REPOSITORY', 'unapproved/tdesign-react'],
  ['GITHUB_REPOSITORY', 'Tencent/tdesign-react'], ['GITHUB_REPOSITORY_ID', '0'],
  ['GITHUB_REPOSITORY_OWNER_ID', '0'], ['GITHUB_REF', 'refs/heads/develop'],
  ['GITHUB_REF', 'refs/heads/validation/table-page-selection-extra'],
  ['GITHUB_EVENT_NAME', 'pull_request'], ['GITHUB_EVENT_NAME', 'pull_request_target'], ['GITHUB_EVENT_NAME', 'schedule'],
]) test(`rejects ${key}=${value}`, () => assert.throws(() => verifyExecutionScope({ ...context(), [key]: value }, manifest())));
test('rejects unapproved candidate repository even if execution identity is correct', () => {
  const m = manifest(); m.candidate.repository = 'other/tdesign-react';
  assert.throws(() => verifyExecutionScope(context(), m));
});
test('rejects changing approval identity in the manifest', () => {
  const m = manifest(); m.approvedTarget.repositoryId = '0'; assert.throws(() => verifyApprovedManifest(m));
});
