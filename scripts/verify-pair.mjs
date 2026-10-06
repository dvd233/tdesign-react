import assert from 'node:assert/strict';
import path from 'node:path';
import { root, argsOf, readJson, hashFile, writeJson } from './common.mjs';
import { verifyReport } from './classify.mjs';
const args = argsOf();
const baselinePath = path.resolve(args.baseline);
const fixedPath = path.resolve(args.fixed);
const baseline = await readJson(baselinePath);
const fixed = await readJson(fixedPath);
const manifest = await readJson(path.join(root, 'source-manifest.json'));
assert.equal(manifest.status, 'ready');
const verdicts = [verifyReport(baseline, 'baseline'), verifyReport(fixed, 'fixed')];
assert.equal(baseline.provenance.sourceSha, manifest.baselineSha);
assert.equal(fixed.provenance.sourceSha, manifest.candidate.sha);
assert.equal(baseline.provenance.hookSha256, manifest.baselineHookSha256);
assert.equal(fixed.provenance.hookSha256, manifest.candidate.expectedChangedFiles[manifest.hookPath]);
assert.equal(fixed.provenance.patchTreeBinding.baselineTree, baseline.provenance.sourceTree);
assert.equal(fixed.provenance.patchTreeBinding.candidateTree, fixed.provenance.sourceTree);
assert.equal(fixed.provenance.patchTreeBinding.reconstructedTree, fixed.provenance.sourceTree);
for (const field of ['specSha256', 'runnerSha256', 'harnessSha256', 'harnessLockSha256', 'dependencyLockSha256', 'packageJsonSha256', 'candidatePatchSha256', 'validationManifestSha256', 'actionsLockSha256', 'sourceVerifierSha256', 'sourceGuardsSha256', 'executionScopeSha256', 'reactVersion', 'reactDOMVersion', 'submodules', 'browser']) {
  assert.deepEqual(baseline.provenance[field], fixed.provenance[field], `A/B drift: ${field}`);
}
assert.equal(baseline.provenance.specSha256, await hashFile(path.join(root, 'scripts/spec.mjs')));
assert.equal(baseline.provenance.runnerSha256, await hashFile(path.join(root, 'scripts/browser-regression.mjs')));
assert.equal(baseline.provenance.harnessSha256, await hashFile(path.join(root, 'harness/main.jsx')));
assert.equal(baseline.provenance.harnessLockSha256, await hashFile(path.join(root, 'package-lock.json')));
assert.equal(baseline.provenance.dependencyLockSha256, manifest.dependencies.lockSha256);
assert.equal(baseline.provenance.candidatePatchSha256, manifest.candidate.patchSha256);
assert.equal(baseline.provenance.validationManifestSha256, await hashFile(path.join(root, 'source-manifest.json')));
assert.equal(baseline.provenance.actionsLockSha256, await hashFile(path.join(root, 'actions-lock.json')));
for (const [field, file] of [['sourceVerifierSha256', 'verify-source.mjs'], ['sourceGuardsSha256', 'source-guards.mjs'], ['executionScopeSha256', 'execution-scope.mjs']]) {
  assert.equal(baseline.provenance[field], await hashFile(path.join(root, 'scripts', file)));
}
assert.equal(baseline.actualBrowserVersion, manifest.browser.browserVersion);
assert.equal(fixed.actualBrowserVersion, manifest.browser.browserVersion);
assert.equal(baseline.runId, fixed.runId);
assert.equal(baseline.runAttempt, fixed.runAttempt);
assert.ok(baseline.runId && baseline.runAttempt, 'Missing Actions run identity');
for (const [report, reportPath] of [[baseline, baselinePath], [fixed, fixedPath]]) {
  for (const scenario of report.scenarios) {
    for (const evidence of [scenario.readyScreenshot, scenario.trace]) {
      assert.equal(await hashFile(path.join(path.dirname(reportPath), evidence.path)), evidence.sha256, 'Missing or altered ready screenshot/trace');
    }
    for (const record of scenario.checkpoints) {
      assert.equal(await hashFile(path.join(path.dirname(reportPath), record.screenshot)), record.screenshotSha256, 'Missing or altered screenshot');
    }
  }
}
const result = {
  conclusion: 'Exact baseline red reproduced; the same browser specification passes on the source-bound fixed commit.',
  baselineSha: manifest.baselineSha, fixedSha: manifest.candidate.sha,
  runId: baseline.runId, runAttempt: baseline.runAttempt, verdicts,
  specSha256: baseline.provenance.specSha256, lockSha256: manifest.dependencies.lockSha256,
  baselineResultsSha256: await hashFile(baselinePath), fixedResultsSha256: await hashFile(fixedPath),
};
await writeJson(path.resolve(args.out), result);
console.log(JSON.stringify(result, null, 2));
