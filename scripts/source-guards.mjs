import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { root } from './common.mjs';
function gitRaw(source, args, env = process.env) {
  return execFileSync('git', ['-C', source, ...args], { env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}
export async function verifyPatchTree(source, baselineSha, candidateSha, patchPath) {
  const tempRoot = path.join(root, 'work', 'temporary-indexes');
  await fs.mkdir(tempRoot, { recursive: true });
  const temp = await fs.mkdtemp(path.join(tempRoot, 'patch-'));
  const env = { ...process.env, GIT_INDEX_FILE: path.join(temp, 'index') };
  try {
    const baselineTree = gitRaw(source, ['rev-parse', `${baselineSha}^{tree}`]).trim();
    const candidateTree = gitRaw(source, ['rev-parse', `${candidateSha}^{tree}`]).trim();
    gitRaw(source, ['read-tree', baselineSha], env);
    // Cached application affects only the temporary index; it never edits the source worktree/index.
    // No 3-way fallback or unsafe-path bypass: the frozen patch must apply directly to the baseline.
    gitRaw(source, ['apply', '--cached', '--binary', '--whitespace=nowarn', path.resolve(patchPath)], env);
    const reconstructedTree = gitRaw(source, ['write-tree'], env).trim();
    assert.equal(reconstructedTree, candidateTree, 'Frozen patch does not reconstruct the exact candidate tree');
    return { baselineTree, candidateTree, reconstructedTree };
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
}
export function verifyNoExtraSourceInputs(source, { topLevel = false } = {}) {
  const tracked = gitRaw(source, ['ls-files', '-z']).split('\0').filter(Boolean);
  // Dependency directories are allowed only at package roots actually present in this committed source.
  const dependencyDirs = tracked.filter(file => path.posix.basename(file) === 'package.json').map(file => {
    const parent = path.posix.dirname(file);
    return parent === '.' ? 'node_modules' : `${parent}/node_modules`;
  });
  const buildDirs = topLevel ? ['es', 'esm', 'lib', 'cjs', 'dist'].map(dir => `packages/tdesign-react/${dir}`) : [];
  // Intentionally omit --exclude-standard: ignored source is just as relevant to glob/resolver inputs.
  // --directory prevents enumerating every dependency file while still surfacing every extra source directory.
  const extra = gitRaw(source, ['ls-files', '--others', '--directory', '--no-empty-directory', '-z']).split('\0').filter(Boolean);
  const inDirectory = (file, dir) => file === `${dir}/` || file.startsWith(`${dir}/`);
  const unexpected = extra.filter(file => {
    if (topLevel && file === 'pnpm-lock.yaml') return false; // Its bytes are separately hash-checked.
    return ![...dependencyDirs, ...buildDirs].some(dir => inDirectory(file, dir));
  });
  assert.deepEqual(unexpected, [], `Untracked or ignored source/config inputs: ${source}`);
  return { policyVersion: 2, allowedDependencyDirectories: dependencyDirs.sort(), allowedBuildDirectories: buildDirs };
}
