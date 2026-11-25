'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load() {
  const context = vm.createContext({ window: {}, Blob, Uint8Array, atob, console });
  for (const file of ['model.js', 'assurance.js', 'meraki.js', 'transformation.js', 'demo.js', 'storage.js', 'transformation-views.js', 'views.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
  }
  return context.window.Cockpit;
}
function snapshot() {
  return { format: 'network-refresh-meraki-snapshot', version: 1, generatedAt: '2026-11-24T10:00:00Z', organizationId: 'org-synthetic',
    network: { id: 'L_test', name: 'Synthetic test branch', organizationId: 'org-synthetic' },
    devices: [{ serial: 'SYN-MS-02', networkId: 'L_test', model: 'MS120-8' }, { serial: 'SYN-MR-02', networkId: 'L_test', model: 'MR46' }],
    statuses: [{ serial: 'SYN-MR-02', status: 'online' }],
    ssids: [{ name: 'Synthetic Wi-Fi', enabled: true, vlanId: 110 }, { name: null, enabled: false }],
    coverage: { statuses: true, ssids: true } };
}

test('snapshot parser projects supported data and rejects credentials or network mismatch', () => {
  const C = load();
  const clean = C.meraki.parseSnapshot(JSON.stringify(snapshot()));
  assert.equal(clean.ssids.length, 1);
  assert.equal(C.meraki.candidatesFrom(clean).length, 7);
  const html = C.views.meraki(C.demo.create(), { merakiBranchId: 'branch-north', pendingMerakiSnapshot: clean });
  assert.match(html, /Stage for review/);
  assert.match(html, /Apply as Observed/);
  const bad = snapshot(); bad.devices[0].networkId = 'L_other';
  assert.throws(() => C.meraki.parseSnapshot(JSON.stringify(bad)), /another network/);
  bad.devices[0].networkId = 'L_test'; bad.apiKey = 'synthetic-placeholder';
  assert.throws(() => C.meraki.parseSnapshot(JSON.stringify(bad)), /credential field/);
  delete bad.apiKey; bad.ssids[0].psk = 'synthetic-placeholder';
  assert.throws(() => C.meraki.parseSnapshot(JSON.stringify(bad)), /credential field/);
  assert.throws(() => C.meraki.parseSnapshot('x'.repeat(C.meraki.MAX_SNAPSHOT_BYTES + 1)), /30 MB/);
});

test('staging and review preserve intent, runs and explicit observation status', () => {
  const C = load();
  const original = C.demo.create();
  const staged = C.meraki.stageSnapshot(original, snapshot(), 'branch-south');
  assert.equal(staged.count, 7);
  assert.equal(staged.data.assuranceObservations.length, original.assuranceObservations.length);
  assert.equal(staged.data.assuranceRuns.length, original.assuranceRuns.length);
  assert.deepEqual(staged.data.assuranceBaselines, original.assuranceBaselines);
  const candidate = staged.data.merakiCandidates.find(item => item.batchId === staged.batchId && item.ruleId === 'rule-wifi-ap-count');
  const applied = C.meraki.applyCandidate(staged.data, candidate.id);
  const observation = applied.assuranceObservations.find(item => item.id === applied.merakiCandidates.find(item => item.id === candidate.id).appliedObservationId);
  assert.equal(observation.perspective, 'Observed');
  assert.match(observation.source, /Meraki snapshot/);
  assert.equal(applied.assuranceRuns.length, original.assuranceRuns.length);
  assert.throws(() => C.meraki.applyCandidate(applied, candidate.id), /pending/);
  const other = staged.data.merakiCandidates.find(item => item.batchId === staged.batchId && item.id !== candidate.id);
  const dismissed = C.meraki.dismissCandidate(applied, other.id);
  assert.equal(dismissed.merakiCandidates.find(item => item.id === other.id).status, 'Dismissed');
  assert.equal(dismissed.assuranceObservations.length, original.assuranceObservations.length + 1);
  assert.throws(() => C.meraki.stageSnapshot(original, snapshot(), 'missing'), /Select a branch/);
});

test('schema 3 migration and JSON backup retain the correct Meraki review state', async () => {
  const C = load();
  const data = C.demo.create();
  const legacy = C.model.copy(data);
  legacy.schemaVersion = 3; delete legacy.merakiBatches; delete legacy.merakiCandidates;
  const migrated = C.model.migrateWorkspace(legacy);
  assert.equal(migrated.schemaVersion, 5);
  assert.equal(migrated.assuranceRuns.length, data.assuranceRuns.length);
  assert.equal(migrated.merakiBatches.length, 0);
  assert.equal(migrated.merakiCandidates.length, 0);
  const backup = await C.storage.makeBackup(data, []);
  const restored = C.storage.parseBackup(JSON.stringify(backup)).workspace;
  assert.equal(restored.merakiBatches.length, data.merakiBatches.length);
  assert.equal(restored.merakiCandidates.length, data.merakiCandidates.length);
  assert.equal(restored.merakiCandidates[0].status, 'Pending');
});

test('macOS companion projects API responses without retaining SSID secrets', () => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'meraki-companion.jxa.js'), 'utf8');
  const context = vm.createContext({});
  vm.runInContext(code, context);
  const result = context.project(
    { id: 'L_test', name: 'Synthetic', organizationId: 'org-synthetic', hidden: 'unused' },
    [{ serial: 'SYN-MR-02', networkId: 'L_test', model: 'MR46', ignored: 'unused' }],
    [{ serial: 'SYN-MR-02', status: 'online', ignored: 'unused' }],
    [{ name: 'Synthetic Wi-Fi', enabled: true, vlanId: 110, psk: 'synthetic-secret-placeholder', radiusSecret: 'synthetic-secret-placeholder' }],
    'org-synthetic', 'L_test', '2026-11-24T10:00:00Z', 'true');
  const serialized = JSON.stringify(result);
  assert.ok(!serialized.includes('synthetic-secret-placeholder'));
  assert.ok(!serialized.includes('hidden'));
  assert.equal(load().meraki.parseSnapshot(serialized).ssids[0].name, 'Synthetic Wi-Fi');
  assert.throws(() => context.project({ id: 'L_other', organizationId: 'org-synthetic' }, [], [], [], 'org-synthetic', 'L_test', '', 'true'), /requested network/);
});
