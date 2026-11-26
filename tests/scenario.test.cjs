'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function load() {
  const context = vm.createContext({ window: {}, Blob, Uint8Array, console });
  for (const file of ['model.js', 'library.js', 'assurance.js', 'meraki.js', 'sdwan.js', 'intelligence.js', 'current-report.js', 'scenario.js', 'transformation.js', 'risk.js', 'demo.js', 'storage.js', 'transformation-views.js', 'risk-views.js', 'sdwan-views.js', 'intelligence-views.js', 'current-report-views.js', 'scenario-views.js', 'library-views.js', 'views.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  return context.window.Cockpit;
}

test('hypothetical pattern changes comparison without assigning it or modifying baselines', () => {
  const C = load(), data = C.demo.create();
  assert.equal(C.model.migrateWorkspace(data).schemaVersion, 10);
  const before = JSON.stringify(data);
  const assigned = C.scenario.compare(data, 'branch-north');
  const proposed = C.scenario.compare(data, 'branch-north', 'pattern-compact');
  assert.equal(assigned.pattern.id, 'pattern-dual-transport');
  assert.equal(proposed.pattern.id, 'pattern-compact');
  assert.equal(assigned.rows.find(item => item.label === 'Device quantity').delta, '1 additional WAN Edge required');
  assert.equal(proposed.rows.find(item => item.label === 'Device quantity').delta, 'Aligned');
  assert.equal(proposed.rows.find(item => item.label === 'Device quantity').source, 'Synthetic workshop example');
  assert.equal(JSON.stringify(data), before);
  assert.throws(() => C.scenario.compare(data, 'branch-north', 'missing'), /Target pattern not found/);
});

test('estate comparison keeps missing evidence Unknown and provides site decision links', () => {
  const C = load(), data = C.demo.create();
  const estate = C.scenario.estate(data, 'pattern-dual-transport');
  assert.equal(estate.length, data.branches.length);
  assert.equal(estate.find(item => item.branch.id === 'branch-pending').rows.find(item => item.label === 'Wi-Fi APs').outcome, 'Current unknown');
  assert.ok(estate.find(item => item.branch.id === 'branch-north').decisions.length > 0);
});

test('report AP quantity is shown as Observed, while connectivity and subnet stay source context', () => {
  const C = load(), data = C.demo.create();
  data.currentReportImports = [{ id: 'synthetic-batch', fileName: 'Synthetic Branch Report.csv' }];
  data.currentBranchReports = [{ id: 'synthetic-report', branchId: 'branch-pending', importId: 'synthetic-batch', sourceDate: '2026-11-24', sourceRow: 2, fields: { 'Total Aps': '1', 'Primary Connectivity Type': 'Fibre', 'Primary Bandwidth': '50 Mbps', Subnet: '10.104.0.0/24' } }];
  const result = C.scenario.compare(data, 'branch-pending', 'pattern-dual-transport');
  const ap = result.rows.find(item => item.label === 'Wi-Fi APs');
  assert.equal(ap.current, '1');
  assert.equal(ap.delta, '1 additional Wi-Fi AP required');
  assert.equal(ap.classification, 'Observed');
  assert.match(ap.source, /Synthetic Branch Report/);
  assert.equal(result.rows.find(item => item.label === 'WAN transports').current, 'Unknown');
  assert.equal(result.rows.find(item => item.label === 'VLANs').current, 'Unknown');
  const html = C.views.scenarios(data, { scenarioBranchId: 'branch-pending', scenarioPatternId: 'pattern-dual-transport', scenarioState: 'Transition' });
  assert.match(html, /Fibre/);
  assert.match(html, /10\.104\.0\.0\/24/);
  assert.match(html, /Current unknown/);
});

test('scenario view escapes imported text', () => {
  const C = load(), data = C.demo.create();
  data.branchPatterns[0].name = '<img src=x onerror=alert(1)>';
  const html = C.views.scenarios(data, { scenarioBranchId: 'branch-north', scenarioPatternId: 'assigned' });
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<img src=x'));
});
