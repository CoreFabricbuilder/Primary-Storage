'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load() {
  const context = vm.createContext({ window: {}, Blob, Uint8Array, atob, console });
  for (const file of ['model.js', 'assurance.js', 'meraki.js', 'sdwan.js', 'intelligence.js', 'current-report.js', 'transformation.js', 'demo.js', 'storage.js', 'transformation-views.js', 'sdwan-views.js', 'intelligence-views.js', 'current-report-views.js', 'views.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
  }
  return context.window.Cockpit;
}

test('synthetic catalogue covers all assurance categories and branch domains', () => {
  const C = load();
  const data = C.demo.create();
  assert.equal(data.schemaVersion, 8);
  for (const category of C.assurance.categories) assert.ok(data.assuranceRules.some(rule => rule.category === category), category);
  for (const domain of C.assurance.domains) assert.ok(data.assuranceRules.some(rule => rule.domain === domain), domain);
  for (const code of ['LAN-SW-COUNT', 'LAN-SW-MODEL', 'LAN-UPLINK-MODE', 'LAN-PORT-MODE', 'LAN-NATIVE-VLAN', 'LAN-ALLOWED-VLANS', 'LAN-POE', 'LAN-MGMT-CONFIG', 'WIFI-AP-COUNT', 'WIFI-AP-MODEL', 'WIFI-SSIDS', 'WIFI-VLAN-MAP', 'WIFI-RF-PROFILE', 'WIFI-MGMT-STATE', 'SDW-EDGE-COUNT', 'SDW-TRANSPORTS', 'SDW-VPNS', 'SDW-COLOURS', 'SDW-ROUTING', 'SDW-SERVICE-SIDE']) assert.ok(data.assuranceRules.some(rule => rule.code === code), code);
  const ui = { assuranceBranchId: 'branch-north' };
  for (const screen of ['deployment', 'deploymentReadiness', 'validation', 'exceptions', 'acceptance', 'baselines']) assert.ok(C.views[screen](data, ui).length > 300, screen);
});

test('a Critical mandatory failure makes deployment acceptance FAILED even with an approved exception', () => {
  const C = load();
  const data = C.demo.create();
  const run = C.assurance.latestRun(data, 'branch-north');
  const fail = data.assuranceResults.find(item => item.runId === run.id && item.ruleId === 'rule-lan-sw-count');
  assert.equal(fail.outcome, 'Fail');
  assert.equal(fail.observedSource, 'Synthetic manual inventory');
  assert.equal(C.assurance.evaluateAcceptance(data, run.id).gateOutcome, 'FAILED');
  const exception = C.assurance.createException(data, fail.id, 'Synthetic deployment exception');
  const approved = C.assurance.decideException(exception.data, exception.id, 'Approved', 'Synthetic Architect');
  assert.equal(C.assurance.evaluateAcceptance(approved, run.id).gateOutcome, 'FAILED');
  assert.equal(C.assurance.evaluateAcceptance(approved, run.id).status, 'Not Ready');
  assert.throws(() => C.assurance.recordAcceptance(approved, run.id, 'Synthetic Architect', ''), /not ready/);
});

test('observations and As-Built values stay separate and old runs stay unchanged', () => {
  const C = load();
  const original = C.demo.create();
  const oldRun = C.assurance.latestRun(original, 'branch-north');
  const asBuilt = C.assurance.recordObservation(original, { branchId: 'branch-north', ruleId: 'rule-lan-sw-count', perspective: 'As-Built', value: '2', source: 'Synthetic as-built check' }).data;
  const unchanged = C.assurance.runValidation(asBuilt, 'branch-north').data;
  const unchangedRun = C.assurance.latestRun(unchanged, 'branch-north');
  assert.equal(unchanged.assuranceResults.find(item => item.runId === unchangedRun.id && item.ruleId === 'rule-lan-sw-count').outcome, 'Fail');
  const observed = C.assurance.recordObservation(unchanged, { branchId: 'branch-north', ruleId: 'rule-lan-sw-count', perspective: 'Observed', value: '2', source: 'Synthetic manual recheck' }).data;
  const rerun = C.assurance.runValidation(observed, 'branch-north').data;
  const newRun = C.assurance.latestRun(rerun, 'branch-north');
  const result = rerun.assuranceResults.find(item => item.runId === newRun.id && item.ruleId === 'rule-lan-sw-count');
  assert.equal(result.outcome, 'Pass');
  assert.equal(result.observedSource, 'Synthetic manual recheck');
  assert.equal(rerun.assuranceResults.find(item => item.runId === oldRun.id && item.ruleId === 'rule-lan-sw-count').outcome, 'Fail');
  assert.equal(rerun.assuranceBaselines.find(item => item.id === newRun.baselineId).values['rule-lan-sw-count'], '2');
  assert.equal(C.assurance.latestObservation(rerun, 'branch-north', 'rule-lan-sw-count', 'As-Built').value, '2');
});

test('Unknown and Not Applicable remain explicit; acceptance needs a manual sign-off', () => {
  const C = load();
  const data = C.demo.create();
  const branch = C.model.createBranch(data, { name: 'Synthetic Assurance Branch', siteCode: 'SYN-A04', patternId: 'pattern-compact' });
  const draft = C.assurance.createBaseline(branch.data, branch.id);
  let next = draft.data;
  for (const rule of next.assuranceRules) next = C.assurance.setBaselineTarget(next, draft.id, rule.id, 'N/A');
  next = C.assurance.setBaselineTarget(next, draft.id, 'rule-lan-sw-count', '1');
  next = C.assurance.activateBaseline(next, draft.id);
  const beforeObservation = C.assurance.runValidation(next, branch.id);
  assert.equal(C.assurance.evaluateAcceptance(beforeObservation.data, beforeObservation.id).status, 'Not Ready');
  assert.equal(C.assurance.evaluateAcceptance(beforeObservation.data, beforeObservation.id).gateOutcome, 'PENDING');
  assert.equal(beforeObservation.data.assuranceResults.find(item => item.runId === beforeObservation.id && item.ruleId === 'rule-lan-sw-count').outcome, 'Unknown');
  const observed = C.assurance.recordObservation(beforeObservation.data, { branchId: branch.id, ruleId: 'rule-lan-sw-count', perspective: 'Observed', value: '1', source: 'Synthetic manual count' }).data;
  const run = C.assurance.runValidation(observed, branch.id);
  assert.equal(run.data.assuranceResults.find(item => item.runId === run.id && item.ruleId === 'rule-lan-sw-model').outcome, 'Not Applicable');
  assert.equal(C.assurance.evaluateAcceptance(run.data, run.id).status, 'Ready');
  const accepted = C.assurance.recordAcceptance(run.data, run.id, 'Synthetic Architect', 'Synthetic sign-off');
  assert.equal(C.assurance.evaluateAcceptance(accepted, run.id).status, 'Accepted');
});

test('approved noncritical exception permits conditional acceptance and baseline snapshots stay immutable', () => {
  const C = load();
  const data = C.demo.create();
  const branch = C.model.createBranch(data, { name: 'Synthetic Exception Branch', siteCode: 'SYN-E05', patternId: 'pattern-compact' });
  const draft = C.assurance.createBaseline(branch.data, branch.id);
  let next = draft.data;
  for (const rule of next.assuranceRules) next = C.assurance.setBaselineTarget(next, draft.id, rule.id, 'N/A');
  next = C.assurance.setBaselineTarget(next, draft.id, 'rule-sdw-vpns', '10');
  next = C.assurance.activateBaseline(next, draft.id);
  assert.throws(() => C.assurance.setBaselineTarget(next, draft.id, 'rule-sdw-vpns', '20'), /draft baseline/);
  next = C.assurance.recordObservation(next, { branchId: branch.id, ruleId: 'rule-sdw-vpns', perspective: 'Observed', value: '20', source: 'Synthetic SD-WAN observation' }).data;
  const run = C.assurance.runValidation(next, branch.id);
  assert.equal(C.assurance.evaluateAcceptance(run.data, run.id).status, 'Not Ready');
  const fail = run.data.assuranceResults.find(item => item.runId === run.id && item.ruleId === 'rule-sdw-vpns');
  const exception = C.assurance.createException(run.data, fail.id, 'Synthetic approved deviation');
  const approved = C.assurance.decideException(exception.data, exception.id, 'Approved', 'Synthetic Architect');
  assert.equal(C.assurance.evaluateAcceptance(approved, run.id).status, 'Ready with Exceptions');
  const accepted = C.assurance.recordAcceptance(approved, run.id, 'Synthetic Architect', 'Conditional synthetic acceptance');
  assert.equal(C.assurance.evaluateAcceptance(accepted, run.id).status, 'Conditionally Accepted');
});

test('schema 2 JSON backup migrates assurance data without changing branch evidence', () => {
  const C = load();
  const old = C.demo.create();
  const evidenceCount = old.branchEvidence.length;
  old.schemaVersion = 2;
  for (const key of ['assuranceRules', 'assuranceObservations', 'assuranceBaselines', 'assuranceRuns', 'assuranceResults', 'assuranceExceptions', 'acceptanceGates', 'acceptanceRecords']) delete old[key];
  const backup = { format: 'network-refresh-cockpit-backup', version: 1, workspace: old, photos: [] };
  const migrated = C.storage.parseBackup(JSON.stringify(backup));
  assert.equal(migrated.workspace.schemaVersion, 8);
  assert.equal(migrated.workspace.branchEvidence.length, evidenceCount);
  assert.equal(migrated.workspace.assuranceRules.length, 22);
  assert.equal(migrated.workspace.assuranceRuns.length, 0);
  assert.equal(migrated.workspace.assuranceObservations.length, 0);
  assert.equal(C.assurance.evaluateAcceptance(migrated.workspace, null).status, 'Not Ready');
});

test('JSON backup retains assurance runs, baselines and observation provenance', async () => {
  const C = load();
  const data = C.demo.create();
  const backup = await C.storage.makeBackup(data, []);
  const restored = C.storage.parseBackup(JSON.stringify(backup)).workspace;
  assert.equal(restored.assuranceRuns.length, 2);
  assert.equal(restored.assuranceBaselines.length, 3);
  assert.equal(restored.assuranceResults.find(item => item.ruleId === 'rule-lan-sw-count').observedSource, 'Synthetic manual inventory');
  backup.workspace.assuranceResults.find(item => item.ruleId === 'rule-lan-sw-count').observedSource = null;
  assert.throws(() => C.storage.parseBackup(JSON.stringify(backup)), /observed source/);
  const changedOutcome = await C.storage.makeBackup(data, []);
  changedOutcome.workspace.assuranceResults.find(item => item.ruleId === 'rule-lan-sw-count').outcome = 'Pass';
  assert.throws(() => C.storage.parseBackup(JSON.stringify(changedOutcome)), /deterministic rule logic/);
  const falseAcceptance = await C.storage.makeBackup(data, []);
  falseAcceptance.workspace.acceptanceRecords.push({ id: 'false-acceptance', branchId: 'branch-north', runId: data.assuranceRuns[0].id, status: 'Accepted', architect: 'Synthetic Architect', signedAt: '2026-11-24T00:00:00Z', notes: '' });
  assert.throws(() => C.storage.parseBackup(JSON.stringify(falseAcceptance)), /gate result/);
});
