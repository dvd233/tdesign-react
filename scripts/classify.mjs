import assert from 'node:assert/strict';
import { ALL, SCENARIOS, stepsFor, visibleRows } from './spec.mjs';
export function expectedBaselineFailures() {
  return SCENARIOS.flatMap(scenario => stepsFor(scenario).flatMap(step =>
    !scenario.reserve && step.type === 'check'
      ? ['keys', 'selectedRowDataIds'].map(field => ({ scenario: scenario.id, step: step.id, field, expected: step.selected, actual: ALL }))
      : []));
}
export function verifyReport(report, variant) {
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.variant, variant);
  assert.equal(report.completed, true, 'Suite did not finish');
  assert.deepEqual(report.errors, [], 'Infrastructure/runtime/loading errors are never expected red');
  assert.equal(report.status, variant === 'baseline' ? 'contract-failed' : 'passed');
  assert.equal(report.exitCode, variant === 'baseline' ? 1 : 0);
  assert.equal(report.scenarios.length, SCENARIOS.length, 'Scenario missing or duplicated');
  for (const [index, scenario] of SCENARIOS.entries()) {
    const actual = report.scenarios[index];
    assert.equal(actual.id, scenario.id);
    assert.equal(actual.reserve, scenario.reserve);
    assert.equal(actual.initialPage, scenario.initialPage);
    assert.equal(actual.ready, true, 'Ready gate was not passed');
    assert.equal(actual.completed, true);
    assert.equal(actual.readyScreenshot?.path, `${scenario.id}--00-ready.png`, 'Missing ready screenshot');
    assert.match(actual.readyScreenshot?.sha256, /^[a-f0-9]{64}$/, 'Missing ready screenshot digest');
    assert.equal(actual.trace?.path, `${scenario.id}-trace.zip`, 'Missing completed trace');
    assert.match(actual.trace?.sha256, /^[a-f0-9]{64}$/, 'Missing trace digest');
    assert.deepEqual(actual.initial.visibleRows, visibleRows(scenario.initialPage));
    assert.deepEqual(actual.initial.selected, []);
    assert.deepEqual(actual.initial.events, []);
    assert.deepEqual(actual.initial.pageEvents, []);
    assert.equal(actual.initial.currentPage, scenario.initialPage);
    assert.equal(actual.initial.headerChecked, false);
    assert.equal(actual.initial.headerDisabled, false);
    assert.deepEqual(actual.initial.visibleChecked, [false, false]);
    const steps = stepsFor(scenario);
    assert.equal(actual.checkpoints.length, steps.length, 'Checkpoint missing or duplicated');
    for (const [stepIndex, step] of steps.entries()) {
      const record = actual.checkpoints[stepIndex];
      assert.equal(record.scenario, scenario.id);
      assert.equal(record.step, step.id);
      assert.equal(record.action, step.action);
      assert.equal(record.page, step.page);
      assert.deepEqual(record.expected, step.selected);
      assert.deepEqual(record.visibleRows, visibleRows(step.page));
      assert.equal(record.headerChecked, step.selected.length > 0);
      assert.deepEqual(record.visibleChecked, [step.selected.length > 0, step.selected.length > 0]);
      const emits = step.action === 'toggle' || !scenario.reserve;
      const expectedKeys = variant === 'baseline' && !scenario.reserve && step.type === 'check' ? ALL : step.selected;
      assert.deepEqual(record.selected, expectedKeys, `${scenario.id}/${step.id} exact selected state`);
      if (emits) {
        assert.ok(record.event, 'Missing actual callback');
        assert.equal(record.event.type, step.type);
        assert.equal(record.event.currentRowKey, step.currentRowKey);
        assert.deepEqual(record.event.keys, expectedKeys, `${scenario.id}/${step.id} exact keys`);
        assert.deepEqual(record.event.selectedRowDataIds, expectedKeys, `${scenario.id}/${step.id} exact selectedRowDataIds`);
        assert.deepEqual(record.event.selectedRowData, expectedKeys.map(id => ({ id, name: `Row ${id}` })), 'Wrong row data values');
      } else assert.equal(record.event, null);
      assert.match(record.screenshot, /^[a-z0-9-]+\.png$/);
      assert.match(record.screenshotSha256, /^[a-f0-9]{64}$/);
    }
  }
  assert.deepEqual(report.failures, variant === 'baseline' ? expectedBaselineFailures() : [], 'Baseline must fail only the exact six-row payload contract');
  return { variant, status: report.status, mismatches: report.failures.length, scenarios: report.scenarios.length };
}
