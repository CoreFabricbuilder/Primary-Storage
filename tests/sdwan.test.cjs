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
  for (const file of ['model.js', 'assurance.js', 'meraki.js', 'sdwan.js', 'vendor/xlsx.full.min.js', 'transformation.js', 'demo.js', 'storage.js', 'transformation-views.js', 'sdwan-views.js', 'views.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  return context.window.Cockpit;
}
function snapshot(C) {
  return { format: C.sdwan.FORMAT, version: 1, generatedAt: '2026-11-25T00:00:00Z', manager: 'Synthetic Manager', siteId: '101',
    devices: [{ id: 'edge-1', hostName: 'edge-1', systemIp: '10.255.101.1', siteId: '101', status: 'reachable', model: 'C8000', template: 'Branch Example', configGroup: '', policyGroup: '' }],
    controlConnections: [{ systemIp: '10.255.101.1', peer: '10.255.0.1', state: 'up', color: 'biz-internet' }],
    ompPeers: [{ systemIp: '10.255.101.1', peer: '10.255.0.2', state: 'up' }],
    bfdSessions: [{ systemIp: '10.255.101.1', peer: '10.255.0.3', state: 'up', color: 'biz-internet' }],
    interfaces: [{ systemIp: '10.255.101.1', name: 'Gi0/0', vpnId: '10', status: 'up', side: 'service' }],
    wanInterfaces: [{ systemIp: '10.255.101.1', name: 'Gi0/0', color: 'biz-internet', status: 'up' }],
    tlocs: [{ systemIp: '10.255.101.1', color: 'biz-internet', encapsulation: 'ipsec', state: 'up' }], alarms: [],
    coverage: { inventory: true, control: true, omp: true, bfd: true, interfaces: true, wan: true, tlocs: true, alarms: true, associations: true, policy: false } };
}
test('snapshot parser rejects credentials and retains only allowlisted fields', () => {
  const C = load(), s = snapshot(C);
  s.devices[0].unrelated = 'discard';
  const clean = C.sdwan.parseSnapshot(JSON.stringify(s));
  assert.equal(clean.devices[0].unrelated, undefined);
  s.apiToken = 'redacted';
  assert.throws(() => C.sdwan.parseSnapshot(JSON.stringify(s)), /credential field/);
  delete s.apiToken; s.devices[0].siteId = '102';
  assert.throws(() => C.sdwan.parseSnapshot(JSON.stringify(s)), /another site/);
});
test('review creates sourced Observed values; unsupported queries remain Unknown', () => {
  const C = load(), original = C.demo.create(), s = snapshot(C);
  s.coverage.bfd = false; s.bfdSessions = [];
  const staged = C.sdwan.stageSnapshot(original, s, 'Branch', 'branch-north');
  assert.equal(original.sdwanBatches.length, 0);
  assert.equal(staged.data.sdwanCandidates.some(x => x.key === 'bfdState'), false);
  s.coverage.tlocs = false; s.tlocs = [];
  const fallback = C.sdwan.candidatesFrom(C.sdwan.parseSnapshot(JSON.stringify(s)));
  assert.equal(fallback.find(x => x.key === 'colours')?.value, 'biz-internet');
  assert.equal(fallback.some(x => x.key === 'tlocCount'), false);
  const edge = staged.data.sdwanCandidates.find(x => x.key === 'edgeCount');
  const applied = C.sdwan.applyCandidate(staged.data, edge.id);
  assert.equal(applied.sdwanObservations[0].classification, 'Observed');
  assert.match(applied.sdwanObservations[0].source, /Synthetic Manager/);
  assert.equal(applied.assuranceObservations.length, original.assuranceObservations.length);
  const dismissed = C.sdwan.dismissCandidate(applied, applied.sdwanCandidates.find(x => x.key === 'siteId').id);
  assert.equal(dismissed.sdwanCandidates.find(x => x.key === 'siteId').status, 'Dismissed');
});
test('Critical failure blocks overall state despite other passing results and old runs remain immutable', () => {
  const C = load(); let data = C.demo.create();
  data = C.sdwan.stageSnapshot(data, snapshot(C), 'Branch', 'branch-north').data;
  for (const candidate of [...data.sdwanCandidates]) data = C.sdwan.applyCandidate(data, candidate.id);
  const target = { edgeCount: '2', siteId: '101', systemIps: '10.255.101.1', deviceStatus: 'Operational', colours: 'biz-internet', vpnIds: '10', tlocCount: '1', bfdState: 'Operational', controlState: 'Operational', ompState: 'Operational', serviceSide: 'Operational', templateAssociation: 'Branch Example', activeAlarms: '0' };
  data = C.sdwan.saveTarget(data, 'Branch', 'branch-north', target, 'Synthetic HLD target');
  data = C.sdwan.runValidation(data, 'Branch', 'branch-north').data;
  const first = C.sdwan.latestRun(data, 'Branch', 'branch-north');
  assert.equal(first.state, 'Failed');
  assert.ok(data.sdwanResults.filter(x => x.runId === first.id).filter(x => x.outcome === 'Pass').length > 5);
  const forged = C.model.copy(data); forged.sdwanResults.find(x => x.runId === first.id && x.key === 'edgeCount').outcome = 'Pass';
  assert.throws(() => C.model.validateWorkspace(forged), /comparison is inconsistent/);
  data = C.sdwan.saveTarget(data, 'Branch', 'branch-north', { ...target, edgeCount: '1' }, 'Revised synthetic target');
  data = C.sdwan.runValidation(data, 'Branch', 'branch-north').data;
  assert.equal(data.sdwanRuns.find(x => x.id === first.id).state, 'Failed');
  assert.equal(C.sdwan.latestRun(data, 'Branch', 'branch-north').state, 'Ready for Review');
  const html = C.views.combinedBranch(data, { combinedBranchId: 'branch-north' });
  assert.match(html, /Catalyst SD-WAN/); assert.match(html, /Meraki LAN/); assert.match(html, /Meraki Wi-Fi/);
});
test('campus scope, schema 5 migration and JSON backup retain validation history', async () => {
  const C = load(); let data = C.demo.create();
  const campus = data.sites.find(x => /campus/i.test(x.siteType));
  assert.ok(campus);
  data = C.sdwan.stageSnapshot(data, snapshot(C), 'Campus', campus.id).data;
  data = C.sdwan.saveTarget(data, 'Campus', campus.id, { edgeCount: '1' }, 'Synthetic campus design');
  data = C.sdwan.runValidation(data, 'Campus', campus.id).data;
  const backup = await C.storage.makeBackup(data, []);
  assert.equal(C.storage.parseBackup(JSON.stringify(backup)).workspace.sdwanRuns.length, 1);
  const legacy = C.model.copy(C.demo.create()); legacy.schemaVersion = 5;
  for (const name of ['sdwanBatches', 'sdwanCandidates', 'sdwanObservations', 'sdwanTargets', 'sdwanRuns', 'sdwanResults']) delete legacy[name];
  const migrated = C.model.migrateWorkspace(legacy);
  assert.equal(migrated.schemaVersion, 6); assert.equal(migrated.merakiCandidates.length, legacy.merakiCandidates.length);
});
test('collector uses fixed read-only data routes and no browser connection', () => {
  const shell = fs.readFileSync(path.join(root, 'sdwan-companion.sh'), 'utf8');
  assert.match(shell, /j_security_check/);
  for (const endpoint of ['ControlConnection', 'OMPPeer', 'BFDSessions', 'Interface', 'device\/tloc']) assert.ok(shell.includes(endpoint));
  assert.match(shell, /--request GET/);
  assert.doesNotMatch(shell, /--insecure|--request PUT|--request DELETE/);
  assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /connect-src 'none'/);
});
test('macOS response projector filters site and WAN Edge types, and rejects partial pages', () => {
  const payloads = {
    inventory: { data: [
      { 'site-id': 101, 'device-type': 'vedge', 'system-ip': '10.255.101.1', reachability: 'reachable' },
      { 'site-id': 101, 'device-type': 'vmanage', 'system-ip': '10.255.0.1' },
      { 'site-id': 102, 'device-type': 'vedge', 'system-ip': '10.255.102.1' },
    ] },
    control: { data: [{ 'site-id': 101, 'vdevice-name': '10.255.101.1', state: 'up', 'local-color': 'biz-internet' }] },
    omp: { data: [] }, bfd: { data: [] }, interfaces: { data: [] }, wan: { data: [] },
    tloc: { data: [{ 'system-ip': '10.255.101.1', color: 'biz-internet', state: 'up' }] }, alarms: { data: [] },
  };
  const context = vm.createContext({
    ObjC: { import() {}, unwrap(x) { return x; } },
    $: { NSUTF8StringEncoding: 4, NSString: { stringWithContentsOfFileEncodingError(filename) { return JSON.stringify(payloads[path.basename(filename, '.json')]); } } },
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'sdwan-companion.jxa.js'), 'utf8'), context);
  const args = ['/tmp/synthetic', '101', 'https://manager.example.com', '2026-11-25T00:00:00Z'];
  const clean = JSON.parse(context.run(args));
  assert.equal(clean.devices.length, 1);
  assert.equal(clean.devices[0].systemIp, '10.255.101.1');
  assert.equal(clean.controlConnections.length, 1);
  assert.ok(!JSON.stringify(clean).includes('10.255.102.1'));
  payloads.bfd.pageInfo = { moreEntries: true, endId: 'next' };
  assert.throws(() => context.run(args), /Paginated/);
});
