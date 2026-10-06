import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { root, readJson } from './common.mjs';
for (const dir of ['scripts', 'tests']) {
  for (const file of await fs.readdir(path.join(root, dir))) {
    if (file.endsWith('.mjs')) execFileSync(process.execPath, ['--check', path.join(root, dir, file)], { stdio: 'inherit' });
  }
}
const pkg = await readJson(path.join(root, 'package.json'));
const lock = await readJson(path.join(root, 'package-lock.json'));
if (JSON.stringify(pkg.dependencies) !== JSON.stringify(lock.packages[''].dependencies)) throw new Error('Harness lock differs from manifest');
if (Object.keys(lock.packages).some(name => name === 'node_modules/tdesign-react')) throw new Error('Harness must not install npm tdesign-react');
console.log('JavaScript syntax and harness lock checks passed. No browser launched.');
