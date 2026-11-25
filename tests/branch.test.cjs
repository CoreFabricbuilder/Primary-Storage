'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load() {
  class FileReader {
    readAsDataURL(blob) {
      blob.arrayBuffer().then(bytes => {
        this.result = `data:${blob.type};base64,${Buffer.from(bytes).toString('base64')}`;
        this.onload?.();
      }, error => { this.error = error; this.onerror?.(); });
    }
  }
  const context = vm.createContext({ window: {}, Blob, Uint8Array, atob, FileReader, console });
  for (const file of ['model.js', 'assurance.js', 'meraki.js', 'sdwan.js', 'transformation.js', 'demo.js', 'storage.js', 'transformation-views.js', 'sdwan-views.js', 'views.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
  }
  return context.window.Cockpit;
}
const evidence = overrides => ({ branchId: 'branch-north', type: 'Manual observation', objectKind: 'Branch', objectId: 'branch-north', photoId: null, source: 'Synthetic architect note', date: '2026-11-24', classification: 'Observed', confidence: 'Low', notes: '', ...overrides });

test('branch evidence must associate with an object in the selected branch', () => {
  const C = load();
  const data = C.demo.create();
  const valid = C.model.upsertBranchEvidence(data, evidence({ objectKind: 'Wireless AP', objectId: 'device-north-ap' })).data;
  assert.equal(valid.branchEvidence.length, data.branchEvidence.length + 1);
  assert.throws(() => C.model.upsertBranchEvidence(data, evidence({ objectKind: 'Device', objectId: 'device-south-ap' })), /does not belong to branch/);
  assert.throws(() => C.model.upsertBranchEvidence(data, evidence({ objectKind: 'Interface', objectId: 'if-south-wan' })), /does not belong to branch/);
  assert.throws(() => C.model.upsertBranchEvidence(data, evidence({ objectKind: 'Wireless AP', objectId: 'device-north-switch' })), /not a wireless AP/);
});

test('evidence classification and unknown branch values remain explicit', () => {
  const C = load();
  const data = C.demo.create();
  const pending = C.model.branchEstateRow(data, 'branch-pending');
  assert.equal(pending.Physical, 'Unknown');
  assert.equal(pending.Evidence, 'Unknown');
  assert.equal(pending.Deployment, 'Unknown');
  const next = C.model.upsertBranchEvidence(data, evidence({ classification: 'Inferred' })).data;
  assert.equal(next.branchEvidence.at(-1).classification, 'Inferred');
  assert.equal(next.branches.find(item => item.id === 'branch-north').validationStatus, 'Pending Architect Review');
  assert.equal(C.model.branchDeltas(data, 'branch-pending').find(item => item.label === 'Power').delta, 'Unknown');
  assert.equal(C.model.branchDeltas(data, 'branch-north').find(item => item.label === 'Optics').delta, 'Unknown');
});

test('Current versus Target deltas use only entered attributes and inherited pattern', () => {
  const C = load();
  const data = C.demo.create();
  assert.equal(C.model.branchDeltas(data, 'branch-north').find(item => item.label === 'Device quantity').delta, '1 additional WAN Edge required');
  assert.equal(C.model.branchDeltas(data, 'branch-north').find(item => item.label === 'WAN transports').delta, 'Add MPLS');
  const pattern = data.branchPatterns.find(item => item.id === 'pattern-dual-transport');
  const changed = C.model.upsertPattern(data, { ...pattern, expectations: { ...pattern.expectations, wanEdgeQuantity: '1' } }).data;
  assert.equal(C.model.branchDeltas(changed, 'branch-north').find(item => item.label === 'Device quantity').delta, 'Aligned');
  assert.equal(changed.branches.find(item => item.id === 'branch-north').patternId, pattern.id);
  assert.equal(data.branchPatterns.find(item => item.id === pattern.id).expectations.wanEdgeQuantity, '2');
  const observed = C.model.upsertBranchAttribute(data, { branchId: 'branch-pending', category: 'Physical', key: 'wanEdge', value: '1', classification: 'Observed', source: 'Synthetic manual observation', note: '' });
  assert.equal(C.model.branchDeltas(observed, 'branch-pending').find(item => item.label === 'Device quantity').delta, '1 additional WAN Edge required');
  const targetOnly = C.model.upsertBranchAttribute(data, { branchId: 'branch-pending', category: 'Physical', key: 'wanEdge', value: '1', classification: 'Target', source: 'Synthetic target note', note: '' });
  assert.equal(C.model.branchDeltas(targetOnly, 'branch-pending').find(item => item.label === 'Device quantity').delta, 'Unknown');
});

test('JSON export and import retain patterns, evidence and photograph blobs', async () => {
  const C = load();
  const data = C.model.upsertBranchEvidence(C.demo.create(), evidence({ id: 'be-photo-roundtrip', type: 'Photograph', objectKind: 'Switch', objectId: 'device-north-switch', photoId: 'photo-roundtrip', confidence: 'Medium' })).data;
  const photo = { id: 'photo-roundtrip', branchId: 'branch-north', deviceId: 'device-north-switch', name: 'Synthetic.png', type: 'image/png', blob: new Blob([Buffer.from('89504e470d0a1a0a', 'hex')], { type: 'image/png' }), addedAt: '2026-11-24T00:00:00Z', note: '', sourceLabel: 'Synthetic architect note', classification: 'Observed' };
  const exported = await C.storage.makeBackup(data, [photo]);
  const restored = C.storage.parseBackup(JSON.stringify(exported));
  assert.equal(restored.workspace.branchPatterns.length, 3);
  assert.equal(restored.workspace.branchEvidence.find(item => item.id === 'be-photo-roundtrip').objectKind, 'Switch');
  assert.equal(restored.photos[0].blob.size, photo.blob.size);
  assert.equal(restored.photos[0].classification, 'Observed');
  assert.throws(() => C.storage.parseBackup(JSON.stringify({ ...exported, workspace: C.demo.create() })), /matching branch evidence/);
});

test('version 1 workspace migration preserves legacy photograph provenance', () => {
  const C = load();
  const old = C.demo.create();
  old.schemaVersion = 1;
  delete old.branchAttributes; delete old.branchEvidence;
  old.branchPatterns.forEach(item => { delete item.code; delete item.intendedUse; delete item.expectations; });
  old.branches.forEach(item => { delete item.siteCode; delete item.locationDescription; delete item.currentStateConfidence; delete item.deploymentReadiness; delete item.validationStatus; delete item.lastUpdated; });
  const migrated = C.model.migrateWorkspace(old, [{ id: 'legacy-photo', branchId: 'branch-north', deviceId: 'device-north-ap', sourceLabel: 'Legacy architect photo', addedAt: '2026-11-20T12:00:00Z', classification: 'Observed', note: '' }]);
  assert.equal(migrated.schemaVersion, 6);
  assert.equal(migrated.branchEvidence.at(-1).photoId, 'legacy-photo');
  assert.equal(migrated.branchEvidence.at(-1).classification, 'Observed');
  assert.equal(migrated.branches[0].currentStateConfidence, 'Unknown');
});

test('a branch starts sparse and gains inventory without fabricated observations', () => {
  const C = load();
  const data = C.demo.create();
  const created = C.model.createBranch(data, { name: 'Synthetic New Branch', siteCode: 'SYN-N04', patternId: 'pattern-compact' });
  const branch = created.data.branches.find(item => item.id === created.id);
  assert.deepEqual([...branch.deviceIds], []);
  assert.equal(branch.currentStateConfidence, 'Unknown');
  assert.equal(C.model.branchEstateRow(created.data, created.id).Physical, 'Unknown');
  assert.equal(C.model.readinessFor(created.data, 'Current', branch.siteId).length, 11);
  assert.equal(C.model.readinessFor(created.data, 'Current', branch.siteId).every(item => item.status === 'Unknown'), true);
  const device = C.model.addBranchAsset(created.data, branch.id, 'Device', { name: 'SYN-EDGE-01', role: 'WAN edge', vendor: 'Cisco' });
  const withInterface = C.model.addBranchAsset(device.data, branch.id, 'Interface', { deviceId: device.id, name: 'GigabitEthernet0/0', description: 'Synthetic WAN port' });
  const withCircuit = C.model.addBranchAsset(withInterface.data, branch.id, 'Circuit', { name: 'Synthetic carrier', provider: 'Example Carrier', circuitType: 'Internet' });
  const withSubnet = C.model.addBranchAsset(withCircuit.data, branch.id, 'Subnet', { cidr: '10.104.0.0/24', purpose: 'Synthetic LAN' });
  assert.equal(withSubnet.data.branches.find(item => item.id === branch.id).deviceIds.length, 1);
  assert.ok(C.model.branchEvidenceTargets(withSubnet.data, branch.id).some(item => item.kind === 'Interface' && item.id === withInterface.id));
  assert.ok(C.model.branchEvidenceTargets(withSubnet.data, branch.id).some(item => item.kind === 'Circuit' && item.id === withCircuit.id));
  assert.equal(C.model.branchEstateRow(withSubnet.data, branch.id).Physical, 'Unknown');
  assert.throws(() => C.model.addBranchAsset(data, 'branch-north', 'Interface', { deviceId: 'device-south-edge', name: 'Wrong branch', description: '' }), /does not belong to branch/);
});
