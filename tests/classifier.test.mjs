// Synthetic classifier tests only. These are not browser evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL, SCENARIOS, stepsFor, visibleRows } from '../scripts/spec.mjs';
import { expectedBaselineFailures, verifyReport } from '../scripts/classify.mjs';
function report(variant) {
  return {
    schemaVersion: 1, variant, completed: true, status: variant === 'baseline' ? 'contract-failed' : 'passed',
    exitCode: variant === 'baseline' ? 1 : 0, errors: [],
    failures: variant === 'baseline' ? expectedBaselineFailures() : [],
    scenarios: SCENARIOS.map(scenario => ({
      ...scenario, ready: true, completed: true,
      readyScreenshot: { path: `${scenario.id}--00-ready.png`, sha256: 'a'.repeat(64) },
      trace: { path: `${scenario.id}-trace.zip`, sha256: 'b'.repeat(64) },
      initial: { visibleRows: visibleRows(scenario.initialPage), selected: [], events: [], pageEvents: [], currentPage: scenario.initialPage, headerChecked: false, headerDisabled: false, visibleChecked: [false, false] },
      checkpoints: stepsFor(scenario).map(step => {
        const selected = variant === 'baseline' && !scenario.reserve && step.type === 'check' ? ALL : step.selected;
        return {
          scenario: scenario.id, step: step.id, action: step.action, page: step.page, expected: step.selected, selected,
          visibleRows: visibleRows(step.page), headerChecked: step.selected.length > 0, visibleChecked: [step.selected.length > 0, step.selected.length > 0],
          event: step.action === 'toggle' || !scenario.reserve ? { keys: selected, selectedRowDataIds: selected, selectedRowData: selected.map(id => ({ id, name: `Row ${id}` })), type: step.type, currentRowKey: step.currentRowKey } : null,
          screenshot: `${scenario.id}-${step.id}.png`, screenshotSha256: 'a'.repeat(64),
        };
      }),
    })),
  };
}
test('exact six-row baseline red is accepted by the classifier', () => {
  const result = verifyReport(report('baseline'), 'baseline');
  assert.equal(result.mismatches, 20);
});
test('fixed requires every checkpoint to pass', () => assert.equal(verifyReport(report('fixed'), 'fixed').mismatches, 0));
for (const [name, mutate] of [
  ['arbitrary runner exit', r => { r.exitCode = 2; }],
  ['browser not ready', r => { r.scenarios[0].ready = false; }],
  ['loading error', r => { r.errors.push('HTTP 404 bundle.js'); }],
  ['incomplete suite', r => { r.completed = false; }],
  ['missing scenario', r => { r.scenarios.pop(); }],
  ['baseline unexpectedly green', r => { r.status = 'passed'; r.exitCode = 0; r.failures = []; }],
  ['wrong six keys', r => { r.scenarios[0].checkpoints[0].event.keys = [1, 2, 3, 4, 5, 7]; }],
  ['wrong row objects', r => { r.scenarios[0].checkpoints[0].event.selectedRowData[0].name = 'Wrong'; }],
  ['omitted payload field assertion', r => { r.failures.pop(); }],
  ['true-mode regression', r => { r.scenarios[2].checkpoints[0].event.keys = [1, 2]; }],
  ['missing ready screenshot', r => { delete r.scenarios[0].readyScreenshot; }],
  ['invalid ready screenshot hash', r => { r.scenarios[0].readyScreenshot.sha256 = ''; }],
  ['missing trace', r => { delete r.scenarios[0].trace; }],
  ['invalid trace hash', r => { r.scenarios[0].trace.sha256 = ''; }],
  ['missing screenshot', r => { r.scenarios[0].checkpoints[0].screenshot = ''; }],
]) test(`rejects ${name}`, () => { const r = structuredClone(report('baseline')); mutate(r); assert.throws(() => verifyReport(r, 'baseline')); });
