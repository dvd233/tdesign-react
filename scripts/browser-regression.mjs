import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright-core';
import { SCENARIOS, stepsFor, visibleRows } from './spec.mjs';
import { argsOf, readJson, hashFile, writeJson } from './common.mjs';

// This executor has a denied local Chromium path. Never use this runner as a local fallback.
if (process.env.GITHUB_ACTIONS !== 'true' || process.env.CI !== 'true') {
  throw new Error('Browser execution is CI-only. Local browser launch is intentionally forbidden.');
}
const args = argsOf();
const dist = path.resolve(args.dist);
const out = path.resolve(args.out);
const variant = args.variant;
assert.ok(['baseline', 'fixed'].includes(variant));
await fs.mkdir(out, { recursive: true });
const report = {
  schemaVersion: 1, variant, status: 'infrastructure-error', completed: false,
  runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT,
  startedAt: new Date().toISOString(), provenance: null, scenarios: [], failures: [], errors: [],
};
let server;
let browser;
let context;
let exitCode = 2;
const exact = (actual, expected, message) => assert.deepEqual(actual, expected, message);
function contract(result, field, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    report.failures.push({ scenario: result.scenario, step: result.step, field, expected, actual });
  }
}
try {
  const provenance = await readJson(path.join(dist, 'build-provenance.json'));
  report.provenance = provenance;
  exact(provenance.variant, variant, 'Build variant mismatch');
  exact(await hashFile(path.join(dist, 'bundle.js')), provenance.bundleSha256, 'Bundle changed since build');
  exact(await hashFile(path.join(dist, 'bundle.css')), provenance.cssSha256, 'CSS changed since build');
  const allowed = new Set(['index.html', 'bundle.js', 'bundle.css', 'bundle.js.map', 'bundle.css.map']);
  server = http.createServer(async (req, res) => {
    const file = new URL(req.url, 'http://127.0.0.1').pathname.slice(1) || 'index.html';
    if (!allowed.has(file)) { res.writeHead(404); res.end(); return; }
    try {
      const content = await fs.readFile(path.join(dist, file));
      res.setHeader('content-type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.map') ? 'application/json' : 'text/html');
      res.end(content);
    } catch (error) {
      report.errors.push(`Static server: ${String(error)}`);
      res.writeHead(500); res.end();
    }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, chromiumSandbox: true });
  report.actualBrowserVersion = browser.version();
  exact(browser.version(), provenance.browser.browserVersion, 'Unexpected Chromium binary version');
  for (const scenario of SCENARIOS) {
    context = await browser.newContext({ viewport: { width: 1120, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => report.errors.push(`pageerror: ${String(error)}`));
    page.on('console', message => { if (message.type() === 'error') report.errors.push(`console.error: ${message.text()}`); });
    page.on('requestfailed', request => report.errors.push(`requestfailed: ${request.url()} ${request.failure()?.errorText}`));
    page.on('response', response => { if (response.status() >= 400) report.errors.push(`HTTP ${response.status()}: ${response.url()}`); });
    await page.route('**/*', route => {
      if (new URL(route.request().url()).origin !== origin) {
        report.errors.push(`Unexpected network request: ${route.request().url()}`);
        return route.abort('blockedbyclient');
      }
      return route.continue();
    });
    const entry = { ...scenario, ready: false, initial: null, checkpoints: [], completed: false };
    report.scenarios.push(entry);
    const response = await page.goto(`${origin}/?reserve=${scenario.reserve}&initialPage=${scenario.initialPage}`, { waitUntil: 'networkidle' });
    exact(response.status(), 200, 'Page did not load');
    await page.waitForFunction(() => window.validation?.ready === true);
    await page.locator('#root[data-ready="true"]').waitFor({ state: 'visible' });
    await page.locator('tbody [data-row-id]').first().waitFor({ state: 'visible' });
    async function snapshot() {
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      return page.evaluate(() => ({
        ready: window.validation.ready,
        provenance: window.validation.provenance,
        selected: [...window.validation.selected],
        visibleRows: Array.from(document.querySelectorAll('tbody [data-row-id]'), node => Number(node.dataset.rowId)),
        headerChecked: document.querySelector('thead input[type="checkbox"]')?.checked,
        headerDisabled: document.querySelector('thead input[type="checkbox"]')?.disabled,
        visibleChecked: Array.from(document.querySelectorAll('tbody input[type="checkbox"]'), node => node.checked),
        events: JSON.parse(JSON.stringify(window.validation.events)),
        pageEvents: JSON.parse(JSON.stringify(window.validation.pageEvents)),
        currentPage: Number(document.querySelector('.t-pagination__number.t-is-current')?.textContent.trim()),
      }));
    }
    const initial = await snapshot();
    const sourceFields = ['variant', 'sourceSha', 'sourceRepository', 'hookSha256', 'dependencyLockSha256'];
    for (const field of sourceFields) exact(initial.provenance[field], provenance[field], `Runtime provenance ${field}`);
    exact(initial.visibleRows, visibleRows(scenario.initialPage), 'Initial rendered row identities');
    exact(initial.currentPage, scenario.initialPage, 'Initial page control');
    exact(initial.selected, [], 'Initial selected keys');
    exact(initial.events, [], 'Unexpected event before interaction');
    exact(initial.pageEvents, [], 'Unexpected pagination event before interaction');
    exact(initial.headerChecked, false, 'Initial header state');
    exact(initial.headerDisabled, false, 'Header should be enabled');
    exact(initial.visibleChecked, [false, false], 'Initial visible checkbox states');
    exact(await page.locator('thead label.t-checkbox').count(), 1, 'Exactly one real Table header checkbox is required');
    entry.ready = true;
    entry.initial = initial;
    let previous = initial;
    const readyScreenshot = `${scenario.id}--00-ready.png`;
    await page.screenshot({ path: path.join(out, readyScreenshot), fullPage: true });
    entry.readyScreenshot = { path: readyScreenshot, sha256: await hashFile(path.join(out, readyScreenshot)) };
    for (const [index, step] of stepsFor(scenario).entries()) {
      const before = previous;
      if (step.action === 'toggle') {
        await page.locator('thead label.t-checkbox').click();
        await page.waitForFunction(count => window.validation.events.length > count, before.events.length);
      } else {
        await page.locator('.t-pagination__number').filter({ hasText: new RegExp(`^${step.page}$`) }).click();
        await page.waitForFunction(count => window.validation.pageEvents.length > count, before.pageEvents.length);
        await page.waitForFunction(expected => Array.from(document.querySelectorAll('tbody [data-row-id]'), node => Number(node.dataset.rowId)).join(',') === expected.join(','), visibleRows(step.page));
      }
      const after = await snapshot();
      exact(after.ready, true, 'Ready state lost');
      exact(after.visibleRows, visibleRows(step.page), 'Wrong rendered page');
      exact(after.currentPage, step.page, 'Wrong pagination button state');
      exact(after.headerDisabled, false, 'Header became disabled');
      const emitsSelect = step.action === 'toggle' || !scenario.reserve;
      exact(after.events.length, before.events.length + Number(emitsSelect), 'Missing, duplicated or unexpected onSelectChange');
      exact(after.pageEvents.length, before.pageEvents.length + Number(step.action === 'paginate'), 'Missing, duplicated or unexpected onPageChange');
      const event = emitsSelect ? after.events.at(-1) : null;
      if (event) {
        exact(event.type, step.type, 'Unexpected select type');
        exact(event.currentRowKey, step.currentRowKey, 'Unexpected select event origin');
        exact(after.selected, event.keys, 'Controlled selected keys differ from callback');
        exact(event.selectedRowData, event.keys.map(id => ({ id, name: `Row ${id}` })), 'selectedRowData not the original matching rows');
      } else {
        exact(after.selected, before.selected, 'True mode did not preserve selection on pagination');
      }
      if (step.action === 'paginate') exact(after.pageEvents.at(-1), { current: step.page, pageSize: 2, rowIds: visibleRows(step.page) }, 'Unexpected onPageChange payload');
      exact(after.headerChecked, step.selected.length > 0, 'Unexpected header checked state');
      exact(after.visibleChecked, [step.selected.length > 0, step.selected.length > 0], 'Unexpected visible checkbox states');
      const record = { scenario: scenario.id, step: step.id, action: step.action, page: step.page, expected: step.selected, event, selected: after.selected, visibleRows: after.visibleRows, headerChecked: after.headerChecked, visibleChecked: after.visibleChecked };
      entry.checkpoints.push(record);
      if (event) {
        contract(record, 'keys', event.keys, step.selected);
        contract(record, 'selectedRowDataIds', event.selectedRowDataIds, step.selected);
      } else exact(after.selected, step.selected, 'Retained true-mode selected keys');
      const screenshot = `${scenario.id}--${String(index + 1).padStart(2, '0')}-${step.id}.png`;
      await page.screenshot({ path: path.join(out, screenshot), fullPage: true });
      record.screenshot = screenshot;
      record.screenshotSha256 = await hashFile(path.join(out, screenshot));
      previous = after;
    }
    entry.completed = true;
    entry.final = previous;
    const tracePath = `${scenario.id}-trace.zip`;
    await context.tracing.stop({ path: path.join(out, tracePath) });
    entry.trace = { path: tracePath, sha256: await hashFile(path.join(out, tracePath)) };
    await context.close(); context = undefined;
  }
  exact(report.errors, [], 'Browser loading, runtime or network errors');
  report.completed = true;
  report.status = report.failures.length ? 'contract-failed' : 'passed';
  exitCode = report.failures.length ? 1 : 0;
} catch (error) {
  report.status = 'infrastructure-error';
  report.errors.push(error.stack || String(error));
  exitCode = 2;
} finally {
  try { if (context) { await context.tracing.stop({ path: path.join(out, 'interrupted-trace.zip') }); await context.close(); } }
  catch (error) { report.errors.push(`Context close: ${String(error)}`); exitCode = 2; report.status = 'infrastructure-error'; }
  try { if (browser) await browser.close(); }
  catch (error) { report.errors.push(`Browser close: ${String(error)}`); exitCode = 2; report.status = 'infrastructure-error'; }
  try { if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
  catch (error) { report.errors.push(`Server close: ${String(error)}`); exitCode = 2; report.status = 'infrastructure-error'; }
  report.finishedAt = new Date().toISOString();
  report.exitCode = exitCode;
  await writeJson(path.join(out, 'results.json'), report);
  console.log(`${variant}: ${report.status}; contract mismatches=${report.failures.length}; runner exit=${exitCode}`);
}
process.exitCode = exitCode;
