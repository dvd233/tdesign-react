import assert from 'node:assert/strict';
export const APPROVED_TARGET = Object.freeze({
  repository: 'dvd233/tdesign-react',
  repositoryId: '1407033111',
  ownerId: '111864431',
  ref: 'refs/heads/validation/table-page-selection',
});
export function verifyApprovedManifest(manifest) {
  assert.deepEqual(manifest.approvedTarget, APPROVED_TARGET, 'Manifest execution target is not the approved fork identity');
  assert.equal(manifest.candidate.repository, APPROVED_TARGET.repository, 'Candidate must come from the approved fork');
}
export function verifyExecutionScope(env, manifest) {
  verifyApprovedManifest(manifest);
  assert.equal(env.GITHUB_ACTIONS, 'true', 'GitHub Actions execution only');
  assert.equal(env.GITHUB_REPOSITORY, APPROVED_TARGET.repository, 'Wrong execution repository');
  assert.equal(env.GITHUB_REPOSITORY_ID, APPROVED_TARGET.repositoryId, 'Wrong repository identity');
  assert.equal(env.GITHUB_REPOSITORY_OWNER_ID, APPROVED_TARGET.ownerId, 'Wrong owner identity');
  assert.equal(env.GITHUB_REF, APPROVED_TARGET.ref, 'Wrong validation branch');
  assert.ok(['push', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME), 'Event is outside the approved trigger scope');
}
