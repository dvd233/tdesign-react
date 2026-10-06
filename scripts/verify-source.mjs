import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { argsOf, root, git, hashFile, readJson, writeJson } from './common.mjs';
import { verifyApprovedManifest } from './execution-scope.mjs';
import { verifyNoExtraSourceInputs, verifyPatchTree } from './source-guards.mjs';
const args = argsOf();
const source = path.resolve(args.source);
const variant = args.variant;
assert.ok(['baseline', 'fixed'].includes(variant));
const manifest = await readJson(path.join(root, 'source-manifest.json'));
assert.equal(manifest.status, 'ready', 'Frozen candidate and dependency manifest is not ready');
assert.match(manifest.candidate.sha, /^[a-f0-9]{40}$/);
verifyApprovedManifest(manifest);
assert.equal(await hashFile(path.join(root, manifest.candidate.patchPath)), manifest.candidate.patchSha256);
assert.equal(await hashFile(path.join(root, manifest.dependencies.lockPath)), manifest.dependencies.lockSha256);
const sha = variant === 'baseline' ? manifest.baselineSha : manifest.candidate.sha;
assert.equal(git(source, 'rev-parse', 'HEAD'), sha, 'Source checkout is not the frozen commit');
assert.equal(git(source, 'diff', '--name-only', 'HEAD'), '', 'Tracked source modified');
assert.equal(git(source, 'diff', '--cached', '--name-only'), '', 'Staged source modified');
assert.equal(await hashFile(path.join(source, 'package.json')), manifest.sourcePackageJsonSha256);
const sourcePackage = await readJson(path.join(source, 'package.json'));
assert.equal(sourcePackage.packageManager, `pnpm@${manifest.pnpmVersion}`);
assert.equal((await fs.readFile(path.join(source, '.node-version'), 'utf8')).trim(), String(manifest.nodeMajor));
const lock = path.join(source, 'pnpm-lock.yaml');
assert.equal(await hashFile(lock), manifest.dependencies.lockSha256, 'Both source builds must use the same frozen lock');
const sourceInputPolicy = verifyNoExtraSourceInputs(source, { topLevel: true });
let patchTreeBinding = null;
const changes = variant === 'fixed' ? git(source, 'diff', '--name-only', manifest.baselineSha, sha).split('\n').filter(Boolean).sort() : [];
if (variant === 'fixed') {
  git(source, 'merge-base', '--is-ancestor', manifest.baselineSha, sha);
  patchTreeBinding = await verifyPatchTree(source, manifest.baselineSha, sha, path.join(root, manifest.candidate.patchPath));
  const expected = manifest.candidate.expectedChangedFiles;
  assert.ok(expected && Object.keys(expected).length >= 1, 'Missing frozen product file hashes');
  assert.deepEqual(changes, Object.keys(expected).sort(), 'Candidate contains unexpected product changes');
  assert.ok(changes.every(file => !file.startsWith('.github/') && !file.startsWith('validation/')), 'Validation files must not be in product commit');
  for (const [file, digest] of Object.entries(expected)) assert.equal(await hashFile(path.join(source, file)), digest, file);
} else {
  assert.equal(await hashFile(path.join(source, manifest.hookPath)), manifest.baselineHookSha256);
}
const submodules = git(source, 'submodule', 'status', '--recursive').split('\n').filter(Boolean);
assert.ok(submodules.length >= 2, 'Expected source submodules');
assert.ok(submodules.every(line => !/^[+\-U]/.test(line)), 'Submodule is absent or differs from gitlink');
for (const line of submodules) {
  const location = line.trim().split(/\s+/)[1];
  assert.equal(git(path.join(source, location), 'status', '--porcelain', '--untracked-files=no'), '', `Dirty submodule ${location}`);
  verifyNoExtraSourceInputs(path.join(source, location));
}
const output = {
  variant, sourceSha: sha, sourceRepository: variant === 'baseline' ? manifest.upstreamRepository : manifest.candidate.repository,
  baselineSha: manifest.baselineSha,
  sourceTree: git(source, 'rev-parse', 'HEAD^{tree}'),
  patchTreeBinding, sourceInputPolicy,
  candidatePatchSha256: manifest.candidate.patchSha256,
  validationManifestSha256: await hashFile(path.join(root, 'source-manifest.json')),
  actionsLockSha256: await hashFile(path.join(root, 'actions-lock.json')),
  sourceVerifierSha256: await hashFile(path.join(root, 'scripts/verify-source.mjs')),
  sourceGuardsSha256: await hashFile(path.join(root, 'scripts/source-guards.mjs')),
  executionScopeSha256: await hashFile(path.join(root, 'scripts/execution-scope.mjs')),
  hookSha256: await hashFile(path.join(source, manifest.hookPath)),
  packageJsonSha256: await hashFile(path.join(source, 'package.json')),
  dependencyLockSha256: manifest.dependencies.lockSha256, submodules, changedFiles: changes,
  toolchain: { node: process.version, pnpm: sourcePackage.packageManager },
};
assert.equal(Number(process.versions.node.split('.')[0]), manifest.nodeMajor, 'Run source verification with Node 22');
if (args.compare) assert.deepEqual(output, await readJson(path.resolve(args.compare)), 'Source binding changed during build/browser test');
if (args.out) await writeJson(path.resolve(args.out), output);
console.log(JSON.stringify(output, null, 2));
