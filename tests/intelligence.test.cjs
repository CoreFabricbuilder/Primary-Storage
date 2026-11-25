'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function load() {
  const context = vm.createContext({ window: {}, Blob, Uint8Array, atob, console });
  context.window.window = context.window;
  for (const file of ['model.js', 'assurance.js', 'meraki.js', 'sdwan.js', 'intelligence.js', 'vendor/xlsx.full.min.js', 'transformation.js', 'demo.js', 'storage.js', 'transformation-views.js', 'sdwan-views.js', 'intelligence-views.js', 'views.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  return context.window.Cockpit;
}
function accepted(C, withSdwan = false) {
  let data = C.model.copy(C.demo.create());
  const previous = data.assuranceBaselines.find(x => x.branchId === 'branch-north' && x.status === 'Active');
  previous.status = 'Superseded';
  const baseline = { ...previous, id: 'baseline-syn-phase7-accepted', status: 'Active', values: { ...previous.values }, createdAt: '2026-11-25T00:00:00Z' };
  data.assuranceBaselines.push(baseline);
  for (const rule of data.assuranceRules) {
    const value = rule.comparator === 'number' ? '1' : rule.comparator === 'set' ? 'A, B' : 'Operational';
    baseline.values[rule.id] = value;
    data.assuranceObservations.push({ id: `accepted-observation-${rule.id}`, branchId: 'branch-north', ruleId: rule.id, perspective: 'Observed', classification: 'Observed', value, source: 'Synthetic accepted deployment', recordedAt: '2026-11-25T00:00:00Z' });
  }
  data = C.assurance.runValidation(C.model.validateWorkspace(data), 'branch-north').data;
  const run = C.assurance.latestRun(data, 'branch-north');
  assert.equal(C.assurance.evaluateAcceptance(data, run.id).gateOutcome, 'PASSED');
  if (withSdwan) {
    const snapshot = { format: C.sdwan.FORMAT, version: 1, generatedAt: '2026-11-25T00:00:00Z', manager: 'Synthetic Manager', siteId: '101',
      devices: [{ id: 'synthetic-edge', hostName: 'edge', systemIp: '10.255.101.1', siteId: '101', status: 'reachable', model: 'C8000', template: '', configGroup: '', policyGroup: '' }],
      controlConnections: [{ systemIp: '10.255.101.1', peer: '10.255.0.1', state: 'up', color: 'biz-internet' }], ompPeers: [], bfdSessions: [], interfaces: [], wanInterfaces: [],
      tlocs: [{ systemIp: '10.255.101.1', color: 'biz-internet', encapsulation: 'ipsec', state: 'up' }], alarms: [],
      coverage: { inventory: true, control: true, omp: false, bfd: false, interfaces: false, wan: false, tlocs: true, alarms: false, associations: false, policy: false } };
    data = C.sdwan.stageSnapshot(data, snapshot, 'Branch', 'branch-north').data;
    for (const candidate of [...data.sdwanCandidates]) data = C.sdwan.applyCandidate(data, candidate.id);
    data = C.sdwan.saveTarget(data, 'Branch', 'branch-north', { edgeCount: '1', siteId: '101', colours: 'biz-internet', controlState: 'Operational' }, 'Synthetic SD-WAN design');
    data = C.sdwan.runValidation(data, 'Branch', 'branch-north').data;
    assert.equal(C.sdwan.latestRun(data, 'Branch', 'branch-north').state, 'Ready for Review');
  }
  data = C.assurance.recordAcceptance(data, run.id, 'Synthetic architect', 'Synthetic acceptance');
  return data;
}
test('four example flows trace state-aware topology and highlight only their path', () => {
  const C = load(), data = C.demo.create();
  assert.equal(data.serviceFlows.length, 4);
  for (const flow of data.serviceFlows) {
    const result = C.intelligence.flowPath(data, flow, 'Transition');
    assert.ok(result.nodeIds.length >= 3, flow.name);
    assert.equal(result.nodeIds[0], flow.fromId);
    assert.equal(result.nodeIds.at(-1), flow.toId);
    assert.equal(result.linkIds.length, result.nodeIds.length - 1);
    assert.equal(result.classification, 'Inferred');
  }
  const current = C.intelligence.flowPath(data, data.serviceFlows[0], 'Current');
  assert.equal(current.nodeIds.includes('comp-catalyst-sdwan'), false);
  const transition = C.intelligence.flowPath(data, data.serviceFlows[0], 'Transition');
  assert.equal(transition.nodeIds.includes('comp-catalyst-sdwan'), true);
  const broken = C.model.copy(data); broken.topologyLinks = broken.topologyLinks.filter(x => !(x.state === 'Transition' && x.toId === 'comp-branch-north'));
  assert.equal(C.intelligence.flowPath(broken, broken.serviceFlows[0], 'Transition'), null);
  const custom = C.intelligence.createFlow(data, { name: 'Synthetic service path', fromId: 'comp-branch-south', toId: 'comp-shared-services', state: 'Transition', classification: 'Target', source: 'Synthetic HLD' });
  assert.equal(C.intelligence.flowPath(custom.data, custom.data.serviceFlows.at(-1), 'Current'), null);
  assert.ok(C.intelligence.flowPath(custom.data, custom.data.serviceFlows.at(-1), 'Transition'));
  assert.match(C.views.serviceFlows(data, { state: 'Transition', flowId: data.serviceFlows[0].id }), /flow-svg/);
  assert.match(fs.readFileSync(path.join(root, 'topology.js'), 'utf8'), /highlightedLinkIds\.includes\(link\.id\)/);
});
test('synthetic demo opens on an accepted As-Built example with real comparison outcomes', () => {
  const C = load(), data = C.demo.create();
  const baseline = data.deploymentBaselines.find(x => x.branchId === 'branch-south');
  assert.ok(baseline);
  const outcomes = C.intelligence.driftRows(data, baseline.id).map(x => x.classification);
  assert.ok(outcomes.includes('No Change'));
  assert.ok(outcomes.includes('Unexplained Drift'));
  assert.match(C.views.drift(data, {}), /Unexplained Drift/);
});
test('segmentation separates direct sourced links from site context and impact uses existing references', () => {
  const C = load(), data = C.demo.create();
  const found = C.intelligence.segmentationMatches(data, '10.101', 'Subnet');
  assert.equal(found.length, 1);
  const context = C.intelligence.segmentContext(data, 'Subnet', 'subnet-north');
  assert.equal(context.branches[0].id, 'branch-north');
  assert.ok(context.devices.some(x => x.id === 'device-north-edge'));
  assert.equal(context.services.length, 0);
  assert.ok(context.decisions.some(x => x.id === 'dec-branch-subnets'));
  const linked = C.intelligence.addSegmentationLink(data, { segmentKind: 'Subnet', segmentId: 'subnet-north', targetKind: 'Service', targetId: 'service-shared', classification: 'Architect Confirmed', source: 'Synthetic LLD review' }).data;
  assert.equal(C.intelligence.segmentContext(linked, 'Subnet', 'subnet-north').services[0].id, 'service-shared');
  assert.throws(() => C.intelligence.addSegmentationLink(linked, { segmentKind: 'Subnet', segmentId: 'subnet-north', targetKind: 'Service', targetId: 'service-shared', classification: 'Observed', source: 'Duplicate' }), /already exists/);
  const impact = C.intelligence.impact(data, 'comp-teraco', 'Transition');
  assert.ok(impact.sites.some(x => x.id === 'site-mutual-park'));
  assert.ok(impact.routing.some(x => x.id === 'adj-example-core'));
  assert.ok(impact.lld.length > 0);
  assert.match(C.views.impact(data, { state: 'Transition', impactComponentId: 'comp-teraco' }), /LLD dependencies/);
  assert.match(C.views.segmentation(data, { segmentKind: 'Subnet', segmentQuery: '10.101', segmentSelection: 'Subnet|subnet-north' }), /Direct sourced links|explicit sourced links/);
  const escaped = C.model.copy(data); escaped.serviceFlows[0].name = '<img src=x onerror=alert(1)>';
  assert.ok(C.views.serviceFlows(escaped, { state: 'Transition' }).includes('&lt;img'));
  assert.ok(!C.views.serviceFlows(escaped, { state: 'Transition' }).includes('<img src=x'));
});
test('accepted deployment becomes a separate frozen As-Built baseline; later values produce reviewable drift', async () => {
  const C = load(); let data = accepted(C);
  const acceptance = data.acceptanceRecords.at(-1);
  const result = C.intelligence.createBaseline(data, acceptance.id, 'Synthetic architect', 'Accepted branch deployment');
  data = result.data;
  const baseline = data.deploymentBaselines.find(x => x.id === result.id);
  assert.equal(baseline.items.length, data.assuranceRules.length);
  assert.equal(baseline.acceptanceId, acceptance.id);
  assert.throws(() => C.intelligence.createBaseline(data, acceptance.id, 'A', 'Duplicate'), /already/);
  assert.ok(C.intelligence.driftRows(data, baseline.id).every(x => x.classification === null));
  const rule = data.assuranceRules.find(x => x.code === 'SDW-EDGE-COUNT');
  const later = { id: 'later-observation', branchId: 'branch-north', ruleId: rule.id, perspective: 'Observed', classification: 'Observed', value: '2', source: 'Synthetic later inventory', recordedAt: '2098-01-01T00:00:00Z' };
  data = C.model.copy(data); data.assuranceObservations.push(later);
  data.deploymentBaselines.find(x => x.id === result.id).createdAt = '2099-01-01T00:00:00Z';
  C.model.validateWorkspace(data);
  let row = C.intelligence.driftRows(data, baseline.id).find(x => x.item.key === rule.id);
  assert.equal(row.classification, 'Unexplained Drift');
  const frozen = JSON.stringify(data.deploymentBaselines.find(x => x.id === result.id));
  assert.throws(() => C.intelligence.reviewDrift(data, { baselineId: baseline.id, itemKey: C.intelligence.baselineItemId(row.item), observationId: later.id, classification: 'Approved Change', decisionId: 'dec-firewall', architect: 'A', rationale: 'Not approved' }), /approved architecture decision/);
  data = C.intelligence.reviewDrift(data, { baselineId: baseline.id, itemKey: C.intelligence.baselineItemId(row.item), observationId: later.id, classification: 'Expected Change', decisionId: 'dec-firewall', architect: 'Synthetic architect', rationale: 'Proposed security boundary' });
  assert.equal(JSON.stringify(data.deploymentBaselines.find(x => x.id === result.id)), frozen);
  row = C.intelligence.driftRows(data, baseline.id).find(x => x.item.key === rule.id);
  assert.equal(row.classification, 'Expected Change');
  data = C.intelligence.reviewDrift(data, { baselineId: baseline.id, itemKey: C.intelligence.baselineItemId(row.item), observationId: later.id, classification: 'Approved Change', decisionId: 'dec-branch-subnets', architect: 'Synthetic architect', rationale: 'Approved change record' });
  assert.equal(C.intelligence.driftRows(data, baseline.id).find(x => x.item.key === rule.id).classification, 'Approved Change');
  const backup = await C.storage.makeBackup(data, []);
  assert.equal(C.storage.parseBackup(JSON.stringify(backup)).workspace.deploymentBaselines.length, data.deploymentBaselines.length);
  assert.match(C.views.drift(data, { driftBranchId: 'branch-north' }), /Approved Change/);
});
test('schema 6 migration preserves vendor validation without creating a baseline', () => {
  const C = load(); const old = C.model.copy(C.demo.create()); old.schemaVersion = 6;
  for (const name of ['serviceFlows', 'segmentationLinks', 'deploymentBaselines', 'driftReviews']) delete old[name];
  const migrated = C.model.migrateWorkspace(old);
  assert.equal(migrated.schemaVersion, 7);
  assert.equal(migrated.sdwanBatches.length, old.sdwanBatches.length);
  assert.equal(migrated.merakiCandidates.length, old.merakiCandidates.length);
  assert.equal(migrated.transActivities.length, old.transActivities.length);
  assert.equal(migrated.deploymentBaselines.length, 0);
});
test('No Change needs a later sourced observation and cannot receive a change review', () => {
  const C = load(); let data = accepted(C);
  const baseline = C.intelligence.createBaseline(data, data.acceptanceRecords.at(-1).id, 'Synthetic architect', 'Accepted example');
  data = baseline.data;
  const item = data.deploymentBaselines.find(x => x.id === baseline.id).items.find(x => x.kind === 'Assurance');
  assert.equal(C.intelligence.driftRows(data, baseline.id).find(x => x.item.key === item.key).classification, null);
  const later = { id: 'unchanged-later-observation', branchId: 'branch-north', ruleId: item.key, perspective: 'Observed', classification: 'Observed', value: item.value, source: 'Synthetic later check', recordedAt: '2098-01-01T00:00:00Z' };
  data = C.model.copy(data); data.assuranceObservations.push(later); C.model.validateWorkspace(data);
  const row = C.intelligence.driftRows(data, baseline.id).find(x => x.item.key === item.key);
  assert.equal(row.classification, 'No Change');
  assert.throws(() => C.intelligence.reviewDrift(data, { baselineId: baseline.id, itemKey: C.intelligence.baselineItemId(item), observationId: later.id, classification: 'Expected Change', decisionId: 'dec-firewall', architect: 'A', rationale: 'Wrong' }), /changed current observation/);
});
test('As-Built snapshots include ready SD-WAN values available at acceptance', () => {
  const C = load(); const data = accepted(C, true);
  const result = C.intelligence.createBaseline(data, data.acceptanceRecords.at(-1).id, 'Synthetic architect', 'Combined accepted deployment');
  const baseline = result.data.deploymentBaselines.find(x => x.id === result.id);
  assert.equal(baseline.sdwanRunId, C.sdwan.latestRun(data, 'Branch', 'branch-north').id);
  assert.ok(baseline.items.some(x => x.kind === 'SD-WAN' && x.key === 'colours' && x.value === 'biz-internet'));
});
