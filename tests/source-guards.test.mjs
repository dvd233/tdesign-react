// Static/synthetic local Git fixtures only. No product repo commits, native build or browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { root } from '../scripts/common.mjs';
import { verifyNoExtraSourceInputs, verifyPatchTree } from '../scripts/source-guards.mjs';
const fixtureEnv = {
  ...process.env, GIT_AUTHOR_NAME: 'Synthetic Validation', GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
  GIT_COMMITTER_NAME: 'Synthetic Validation', GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
};
function git(dir, ...args) { return execFileSync('git', ['-C', dir, ...args], { env: fixtureEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
async function put(dir, file, value) { await fs.mkdir(path.dirname(path.join(dir, file)), { recursive: true }); await fs.writeFile(path.join(dir, file), value); }
function commitTree(dir, parent) {
  git(dir, 'add', '-A');
  const tree = git(dir, 'write-tree');
  const commit = git(dir, 'commit-tree', tree, ...(parent ? ['-p', parent] : []), '-m', 'Synthetic test object only');
  git(dir, 'update-ref', 'HEAD', commit);
  return commit;
}
async function fixture(t) {
  const workspace = path.join(root, 'work', 'synthetic-source-tests');
  await fs.mkdir(workspace, { recursive: true });
  const dir = await fs.mkdtemp(path.join(workspace, 'case-'));
  t.after(async () => fs.rm(dir, { recursive: true, force: true }));
  const source = path.join(dir, 'source'); await fs.mkdir(source);
  git(source, 'init', '-q');
  await put(source, 'package.json', '{"name":"synthetic-validation-source","private":true}\n');
  await put(source, 'packages/tdesign-react/package.json', '{"name":"synthetic-built-package","private":true}\n');
  await put(source, '.gitignore', 'ignored-*.tsx\nnode_modules/\npackages/tdesign-react/es/\n');
  await put(source, 'packages/components/table/hooks/useRowSelect.tsx', 'export const selected = [1, 2, 3, 4, 5, 6];\n');
  const baseline = commitTree(source);
  await put(source, 'packages/components/table/hooks/useRowSelect.tsx', 'export const selected = [1, 2];\n');
  const candidate = commitTree(source, baseline);
  const patch = path.join(dir, 'candidate.patch');
  await fs.writeFile(patch, git(source, 'diff', '--binary', '--full-index', baseline, candidate) + '\n');
  return { dir, source, baseline, candidate, patch };
}
test('exact patch reconstructs candidate tree without changing source index or worktree', async t => {
  const f = await fixture(t);
  const before = git(f.source, 'status', '--porcelain');
  const indexBefore = git(f.source, 'write-tree');
  const result = await verifyPatchTree(f.source, f.baseline, f.candidate, f.patch);
  assert.equal(result.reconstructedTree, git(f.source, 'rev-parse', `${f.candidate}^{tree}`));
  assert.equal(result.baselineTree, git(f.source, 'rev-parse', `${f.baseline}^{tree}`));
  assert.equal(git(f.source, 'write-tree'), indexBefore);
  assert.equal(git(f.source, 'status', '--porcelain'), before);
});
test('rejects arbitrary non-patch text even with a separately matching hash', async t => {
  const f = await fixture(t); await fs.writeFile(f.patch, 'THIS IS NOT A PATCH.\n');
  await assert.rejects(verifyPatchTree(f.source, f.baseline, f.candidate, f.patch));
});
test('rejects a valid patch with context that cannot apply to the baseline', async t => {
  const f = await fixture(t);
  const bytes = await fs.readFile(f.patch, 'utf8');
  await fs.writeFile(f.patch, bytes.replace('-export const selected = [1, 2, 3, 4, 5, 6];', '-export const selected = [99];'));
  await assert.rejects(verifyPatchTree(f.source, f.baseline, f.candidate, f.patch));
});
test('rejects a valid applicable patch producing a different tree', async t => {
  const f = await fixture(t);
  const bytes = await fs.readFile(f.patch, 'utf8');
  await fs.writeFile(f.patch, bytes.replace('+export const selected = [1, 2];', '+export const selected = [3, 4];'));
  await assert.rejects(verifyPatchTree(f.source, f.baseline, f.candidate, f.patch), /exact candidate tree/);
});
test('clean committed source is accepted', async t => {
  const f = await fixture(t); assert.equal(verifyNoExtraSourceInputs(f.source, { topLevel: true }).policyVersion, 2);
});
for (const [name, file] of [
  ['extra TSX input', 'packages/components/table/UntrackedOverride.tsx'],
  ['same-name JavaScript resolver override', 'packages/components/table/hooks/useRowSelect.js'],
  ['ignored TSX input', 'packages/components/table/ignored-override.tsx'],
  ['untracked configuration', 'script/extra-config.js'],
  ['lookalike build directory', 'packages/tdesign-react/es-malicious/index.js'],
  ['nested dependency shadow outside a committed package root', 'packages/components/table/node_modules/evil/index.js'],
]) test(`rejects ${name}`, async t => {
  const f = await fixture(t); await put(f.source, file, 'export const extra = true;\n');
  if (name.startsWith('ignored')) assert.equal(git(f.source, 'check-ignore', file), file);
  assert.throws(() => verifyNoExtraSourceInputs(f.source, { topLevel: true }), /Untracked or ignored source\/config inputs/);
});
test('only committed package-root dependency directories, frozen root lock and explicit build outputs are allowed', async t => {
  const f = await fixture(t);
  await put(f.source, 'node_modules/dependency/index.js', 'synthetic dependency\n');
  await put(f.source, 'pnpm-lock.yaml', 'synthetic lock; digest checked elsewhere\n');
  await put(f.source, 'packages/tdesign-react/es/table/index.js', 'synthetic generated output\n');
  assert.equal(verifyNoExtraSourceInputs(f.source, { topLevel: true }).policyVersion, 2);
});
for (const ignored of [false, true]) test(`rejects ${ignored ? 'ignored' : 'untracked'} source inside a real registered submodule fixture`, async t => {
  const f = await fixture(t);
  const child = path.join(f.source, 'packages/common'); await fs.mkdir(child, { recursive: true });
  git(child, 'init', '-q');
  await put(child, 'js/table/tracked.ts', 'export const original = true;\n');
  await put(child, '.gitignore', 'ignored-*.tsx\n');
  const childSha = commitTree(child);
  await put(f.source, '.gitmodules', '[submodule "packages/common"]\n\tpath = packages/common\n\turl = https://example.invalid/synthetic-only.git\n');
  git(f.source, 'update-index', '--add', '--cacheinfo', `160000,${childSha},packages/common`);
  git(f.source, 'config', 'submodule.packages/common.url', 'https://example.invalid/synthetic-only.git');
  commitTree(f.source, f.candidate);
  const target = ignored ? 'js/table/ignored-extra.tsx' : 'js/table/extra.tsx';
  await put(child, target, 'export const injected = true;\n');
  if (ignored) assert.equal(git(child, 'check-ignore', target), target);
  // Git deliberately does not recurse through gitlinks; the source verifier explicitly calls the guard per submodule.
  assert.equal(verifyNoExtraSourceInputs(f.source, { topLevel: true }).policyVersion, 2);
  assert.throws(() => verifyNoExtraSourceInputs(child), /Untracked or ignored source\/config inputs/);
});
