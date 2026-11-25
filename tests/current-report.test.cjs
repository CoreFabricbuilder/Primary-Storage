'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function load() {
  const context = vm.createContext({ window: {}, Blob, Uint8Array, ArrayBuffer, TextDecoder, console });
  context.window.window = context.window;
  for (const file of ['model.js', 'library.js', 'assurance.js', 'meraki.js', 'sdwan.js', 'intelligence.js', 'current-report.js', 'transformation.js', 'demo.js', 'storage.js', 'transformation-views.js', 'sdwan-views.js', 'intelligence-views.js', 'current-report-views.js', 'library-views.js', 'views.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  return context.window.Cockpit;
}
function csv(C, entries) {
  return [C.currentReport.FIELDS.join(';'), ...entries.map(values => C.currentReport.FIELDS.map(key => values[key] || '').join(';'))].join('\r\n');
}
const row = (uid, name, extra = {}) => ({ 'Location UID': uid, Identity: 'Branch', Location: name, 'Primary Connectivity Type': 'Fibre', 'Primary Bandwidth': '100 Mbps', 'Total Switches': '2', 'Total Aps': '3', 'Used Macs': '21', Subnet: '10.44.1.0/24', ...extra });

test('Windows encoding, quoted separators, source date and ambiguous cells are handled locally', () => {
  const C = load();
  const text = csv(C, [row('0012', 'Example; Branch', { Subnet: '10.44.1.0/24, 10.44.2.0/24' })]).replace('Example; Branch', '"Example; Branch"');
  const parsed = C.currentReport.parse(text, 'Location Branch Report 27-08-2026.csv');
  assert.equal(parsed.sourceDate, '2026-08-27');
  assert.equal(parsed.rows[0].uid, '0012');
  assert.equal(parsed.rows[0].fields.Location, 'Example; Branch');
  assert.match(parsed.rows[0].warnings.join(' '), /Multiple subnets/);
  const bytes = Uint8Array.from([0x43, 0x61, 0x66, 0xe9]);
  assert.equal(C.currentReport.decode(bytes.buffer), 'Café');
  assert.throws(() => C.currentReport.parse(csv(C, [row('0012', 'A'), row('0012', 'B')]), 'test.csv'), /Duplicate Location UID/);
  assert.throws(() => C.currentReport.parse('password;token\na;b', 'test.csv'), /Unexpected branch report columns/);
});

test('clean import makes Current Observed records and leaves targets and LLD Unknown', () => {
  const C = load();
  const demo = C.demo.create();
  const parsed = C.currentReport.parse(csv(C, [row('0012', 'Example Branch A'), row('0013', 'Example Branch B', { 'Secondary Bandwidth': 'Active', Subnet: '' })]), 'Location Branch Report 27-08-2026.csv');
  const preview = C.currentReport.plan(demo, parsed, { mode: 'new', programmeName: 'Example Programme' });
  assert.equal(preview.counts.newBranches, 2);
  const { data } = C.currentReport.apply(demo, preview);
  assert.equal(data.programme.isDemo, false);
  assert.equal(data.branches.length, 2);
  assert.equal(data.lldReadiness.length, 2 * 3 * 11);
  assert.ok(data.lldReadiness.every(item => item.status === 'Unknown'));
  assert.equal(data.branchPatterns[0].expectations.wanTransports, null);
  assert.equal(data.assuranceBaselines.length, 0);
  assert.equal(data.currentBranchReports[0].classification, 'Observed');
  assert.equal(data.currentBranchReports[0].state, 'Current');
  assert.equal(data.currentBranchReports[0].fields['Location UID'], '0012');
  assert.equal(data.currentReportImports[0].fileName, parsed.fileName);
  assert.match(C.views.branches(data, { state: 'Current', selectedBranchId: data.branches[0].id }), /Pre-SD-WAN deployment report/);
  assert.match(C.views.overview(data, { state: 'Current' }), /2 of 2 branches/);
  assert.equal(C.storage.parseBackup(JSON.stringify({ format: 'network-refresh-cockpit-backup', version: 1, workspace: data, photos: [] })).workspace.currentBranchReports.length, 2);
});

test('merge matches UID, keeps design and As-Built data, and is idempotent', () => {
  const C = load();
  const demo = C.demo.create();
  const beforePattern = JSON.stringify(demo.branchPatterns);
  const beforeBaselines = JSON.stringify(demo.deploymentBaselines);
  const parsed = C.currentReport.parse(csv(C, [row('SYN-N01', 'Different Report Name'), row('0099', 'Example New Branch')]), 'Location Branch Report 27-08-2026.csv');
  const first = C.currentReport.apply(demo, C.currentReport.plan(demo, parsed, { mode: 'merge' })).data;
  assert.equal(first.branches.find(item => item.siteCode === 'SYN-N01').name, 'Example Branch North');
  assert.equal(first.branches.length, demo.branches.length + 1);
  assert.equal(JSON.stringify(first.branchPatterns.slice(0, demo.branchPatterns.length)), beforePattern);
  assert.equal(JSON.stringify(first.deploymentBaselines), beforeBaselines);
  const second = C.currentReport.apply(first, C.currentReport.plan(first, parsed, { mode: 'merge' }));
  assert.equal(second.changed, 0);
  assert.equal(second.data.currentBranchReports.length, first.currentBranchReports.length);
  assert.equal(second.data.currentReportImports.length, 1);
  const revised = C.currentReport.parse(csv(C, [row('SYN-N01', 'Different Report Name', { 'Primary Bandwidth': '200 Mbps' })]), 'Location Branch Report 27-08-2026.csv');
  const third = C.currentReport.apply(second.data, C.currentReport.plan(second.data, revised, { mode: 'merge' })).data;
  assert.equal(third.currentBranchReports.filter(item => item.uid === 'SYN-N01').length, 2);
  assert.equal(C.currentReport.latest(third, 'branch-north').fields['Primary Bandwidth'], '200 Mbps');
});

test('schema 7 migration retains all previous data; report views escape supplied text', () => {
  const C = load();
  const legacy = C.demo.create(); legacy.schemaVersion = 7; delete legacy.currentReportImports; delete legacy.currentBranchReports;
  const migrated = C.model.migrateWorkspace(legacy);
  assert.equal(migrated.schemaVersion, 9);
  assert.equal(migrated.serviceFlows.length, legacy.serviceFlows.length);
  const parsed = C.currentReport.parse(csv(C, [row('0123', '<img src=x onerror=alert(1)>')]), 'Location Branch Report 27-08-2026.csv');
  const data = C.currentReport.apply(migrated, C.currentReport.plan(migrated, parsed, { mode: 'merge' })).data;
  const html = C.currentReportViews.currentEstate(data, {});
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<img src=x'));
});
