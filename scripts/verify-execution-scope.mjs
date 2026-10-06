import path from 'node:path';
import assert from 'node:assert/strict';
import { root, readJson } from './common.mjs';
import { verifyExecutionScope } from './execution-scope.mjs';
const manifest = await readJson(path.join(root, 'source-manifest.json'));
verifyExecutionScope(process.env, manifest);
assert.equal(manifest.status, 'ready', 'Frozen manifest is not ready');
assert.match(manifest.candidate.sha, /^[a-f0-9]{40}$/);
console.log('Exact approved fork identity, validation branch, event and candidate repository verified.');
