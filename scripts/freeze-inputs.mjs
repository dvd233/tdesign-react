// Preparation only; does not commit, push, publish, install or launch a browser.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { argsOf, root, hashFile, readJson, writeJson } from './common.mjs';
import { APPROVED_TARGET, verifyApprovedManifest } from './execution-scope.mjs';
const args = argsOf();
const manifestPath = path.join(root, 'source-manifest.json');
const manifest = await readJson(manifestPath);
if (args.patch) {
  const patch = path.resolve(args.patch);
  const destination = path.join(root, manifest.candidate.patchPath);
  if (patch !== destination) await fs.copyFile(patch, destination);
  manifest.candidate.patchSha256 = await hashFile(destination);
}
if (args.lock) {
  const lock = path.resolve(args.lock);
  const destination = path.join(root, manifest.dependencies.lockPath);
  if (lock !== destination) await fs.copyFile(lock, destination);
  manifest.dependencies.lockSha256 = await hashFile(destination);
}
if (args['changed-files']) {
  const files = await readJson(path.resolve(args['changed-files']));
  assert.ok(files && Object.keys(files).length >= 1);
  assert.ok(Object.hasOwn(files, manifest.hookPath));
  for (const [file, digest] of Object.entries(files)) {
    assert.ok(file.startsWith('packages/components/table/') && !file.includes('..'));
    assert.match(digest, /^[a-f0-9]{64}$/);
  }
  manifest.candidate.expectedChangedFiles = files;
}
if (args.repository) {
  assert.equal(args.repository, APPROVED_TARGET.repository, 'Candidate repository must be the exact approved public fork');
  manifest.candidate.repository = args.repository;
}
if (args.sha) { assert.match(args.sha, /^[a-f0-9]{40}$/); manifest.candidate.sha = args.sha; }
verifyApprovedManifest(manifest);
manifest.status = manifest.candidate.repository && manifest.candidate.sha && manifest.candidate.patchSha256 && manifest.candidate.expectedChangedFiles && manifest.dependencies.lockSha256 ? 'ready' : 'draft-awaiting-frozen-inputs';
await writeJson(manifestPath, manifest);
console.log(`Prepared manifest: ${manifest.status}. This does not prove a browser result or authorize publication.`);
