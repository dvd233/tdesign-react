// Real esbuild build-only regression. No browser or product-behavior mock.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { build, version } from 'esbuild';
import { root, resolveMetafileInputs } from '../scripts/common.mjs';

async function fixture(t) {
  assert.equal(version, '0.25.12');
  const workspace = path.join(root, 'work', 'real-esbuild-tests');
  await fs.mkdir(workspace, { recursive: true });
  const directory = await fs.mkdtemp(path.join(workspace, 'case-'));
  t.after(async () => fs.rm(directory, { recursive: true, force: true }));
  await fs.writeFile(path.join(directory, 'entry.js'), "import { value } from './value.js'; console.log(__VALIDATION_PROVENANCE__, value);\n");
  await fs.writeFile(path.join(directory, 'value.js'), 'export const value = 42;\n');
  const result = await build({
    absWorkingDir: directory, entryPoints: ['entry.js'], bundle: true,
    platform: 'browser', format: 'iife', metafile: true, write: false,
    define: { __VALIDATION_PROVENANCE__: JSON.stringify({ variant: 'build-only-regression', sourceSha: 'synthetic' }) },
  });
  assert.ok(Object.hasOwn(result.metafile.inputs, '<define:__VALIDATION_PROVENANCE__>'), 'Real esbuild must reproduce the object-define virtual input');
  assert.ok(result.outputFiles[0].text.includes('build-only-regression'));
  return { directory, metafile: result.metafile };
}

test('real esbuild object define accepts only its exact trusted virtual input', async t => {
  const f = await fixture(t);
  const inputs = await resolveMetafileInputs(f.metafile, f.directory);
  const expected = await Promise.all(['entry.js', 'value.js'].map(file => fs.realpath(path.join(f.directory, file))));
  assert.deepEqual(inputs.sort(), expected.sort());
});

test('real esbuild input that disappears still fails realpath validation', async t => {
  const f = await fixture(t);
  await fs.unlink(path.join(f.directory, 'value.js'));
  await assert.rejects(resolveMetafileInputs(f.metafile, f.directory), { code: 'ENOENT' });
});

for (const unexpected of ['<define:__UNTRUSTED__>', '<define:__VALIDATION_PROVENANCE__>/missing.js', '<runtime>']) {
  test(`unknown pseudo-input is not exempted: ${unexpected}`, async t => {
    const f = await fixture(t);
    f.metafile.inputs[unexpected] = { bytes: 1, imports: [] };
    await assert.rejects(resolveMetafileInputs(f.metafile, f.directory), { code: 'ENOENT' });
  });
}
