import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { root, argsOf, readJson, hashFile, hash, writeJson, resolveMetafileInputs } from './common.mjs';
const args = argsOf();
const source = await fs.realpath(path.resolve(args.source));
const out = path.resolve(args.out);
const provenance = await readJson(path.resolve(args.provenance));
const manifest = await readJson(path.join(root, 'source-manifest.json'));
assert.equal(manifest.status, 'ready');
assert.equal(await hashFile(path.join(source, manifest.hookPath)), provenance.hookSha256);
const sourceRequire = createRequire(path.join(source, 'package.json'));
const react = sourceRequire.resolve('react');
const reactDOM = sourceRequire.resolve('react-dom');
const reactDOMClient = sourceRequire.resolve('react-dom/client');
await fs.mkdir(out, { recursive: true });
const result = await build({
  absWorkingDir: root,
  entryPoints: ['harness/main.jsx'], outfile: path.join(out, 'bundle.js'),
  bundle: true, platform: 'browser', format: 'iife', sourcemap: 'external', sourcesContent: true,
  minify: false, metafile: true, target: 'chrome141', logLevel: 'info',
  define: { 'process.env.NODE_ENV': '"production"', '__VALIDATION_PROVENANCE__': JSON.stringify(provenance) },
  alias: {
    'validation-table': path.join(source, manifest.harness.sourceImport),
    'validation-table-css': path.join(source, manifest.harness.cssImport),
    'react-dom/client': reactDOMClient,
    'react-dom': reactDOM,
    'react': react,
  },
});
const realInputs = await resolveMetafileInputs(result.metafile, root);
assert.ok(realInputs.some(file => file.startsWith(path.join(source, 'packages/tdesign-react/lib/table/'))), 'Bundle did not load built Table');
assert.ok(!realInputs.some(file => /\/node_modules\/(?:\.pnpm\/tdesign-react@[^/]+\/node_modules\/)?tdesign-react\//.test(file)), 'Npm tdesign-react cannot substitute source build');
const sourceMap = await readJson(path.join(out, 'bundle.js.map'));
const matching = sourceMap.sources.map((file, index) => ({ file, index })).filter(item => /\/table\/hooks\/useRowSelect\.tsx$/.test(item.file));
assert.ok(matching.length > 0, 'Built bundle lacks original hook source map; source equivalence unproven');
for (const entry of matching) assert.equal(hash(sourceMap.sourcesContent[entry.index]), provenance.hookSha256, 'Bundled hook differs from frozen source');
await fs.copyFile(path.join(root, 'harness/index.html'), path.join(out, 'index.html'));
const report = {
  ...provenance,
  specSha256: await hashFile(path.join(root, 'scripts/spec.mjs')),
  runnerSha256: await hashFile(path.join(root, 'scripts/browser-regression.mjs')),
  harnessSha256: await hashFile(path.join(root, 'harness/main.jsx')),
  harnessLockSha256: await hashFile(path.join(root, 'package-lock.json')),
  browser: manifest.browser,
  reactVersion: sourceRequire('react/package.json').version,
  reactDOMVersion: sourceRequire('react-dom/package.json').version,
  bundleSha256: await hashFile(path.join(out, 'bundle.js')),
  cssSha256: await hashFile(path.join(out, 'bundle.css')),
  sourceMapSha256: await hashFile(path.join(out, 'bundle.js.map')),
  hookSources: matching.map(entry => entry.file),
};
await writeJson(path.join(out, 'build-provenance.json'), report);
await writeJson(path.join(out, 'esbuild-metafile.json'), result.metafile);
console.log('Source-built Table bundled; original hook contents and source hashes verified.');
