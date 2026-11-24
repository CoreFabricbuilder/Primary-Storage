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
  for (const file of ['model.js', 'demo.js', 'storage.js', 'views.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  return context.window.Cockpit;
}

test('synthetic workspace has complete screen coverage and RFC1918 examples', () => {
  const C = load();
  const data = C.demo.create();
  assert.equal(data.domains.length, 11);
  assert.equal(data.branches.length, 2);
  assert.equal(data.lldReadiness.length, data.sites.length * 3 * 11);
  assert.equal(C.model.visibleComponents(data, 'Current').some(item => item.name === 'Catalyst SD-WAN'), false);
  assert.equal(C.model.visibleComponents(data, 'Transition').some(item => item.name === 'Catalyst SD-WAN'), true);
  assert.deepEqual([...data.subnets.map(item => item.cidr)], ['10.255.0.0/24', '10.10.0.0/16', '10.20.0.0/16', '10.101.0.0/24', '10.102.0.0/24']);
  for (const screen of ['overview', 'topology', 'readiness', 'decisions', 'dependencies', 'branches']) {
    const html = C.views[screen](data, { state: 'Transition', domainFilter: null, selectedComponentId: null, selectedSiteId: null, selectedDecisionId: null, selectedBranchId: null, decisionSearch: '' });
    assert.ok(html.length > 200, `${screen} rendered`);
  }
});

test('readiness status does not silently promote evidence classification', () => {
  const C = load();
  const data = C.demo.create();
  const row = data.lldReadiness.find(item => item.status === 'Unknown');
  const next = C.model.updateReadiness(data, row.id, { status: 'Confirmed', classification: row.classification, note: 'Architect status only', sourceId: row.sourceId });
  assert.equal(next.lldReadiness.find(item => item.id === row.id).classification, 'Inferred');
  assert.equal(data.lldReadiness.find(item => item.id === row.id).status, 'Unknown');
});

test('decisions and dependencies maintain stable references', () => {
  const C = load();
  const data = C.demo.create();
  const current = data.decisions[0];
  const result = C.model.upsertDecision(data, { ...current, title: 'Updated synthetic handoff' });
  assert.equal(result.id, current.id);
  assert.equal(result.data.decisions.length, data.decisions.length);
  assert.equal(result.data.decisions[0].title, 'Updated synthetic handoff');
  const dep = data.dependencies[0];
  const next = C.model.updateDependency(result.data, dep.id, 'Resolved');
  assert.equal(next.dependencies[0].status, 'Resolved');
  assert.equal(data.dependencies[0].status, 'Unresolved');
  assert.throws(() => C.model.upsertDecision(data, { ...current, domainId: 'missing' }), /Missing decision domain/);
});

test('JSON backup parser validates photo association and keeps photo as Observed', () => {
  const C = load();
  const data = C.demo.create();
  const photo = { id: 'photo-example', branchId: 'branch-north', deviceId: 'device-north-ap', name: 'Synthetic example.png', type: 'image/png', addedAt: '2026-11-24T00:00:00Z', note: '', sourceLabel: 'User-selected photograph', classification: 'Observed', dataUrl: 'data:image/png;base64,iVBORw0KGgo=' };
  const backup = { format: 'network-refresh-cockpit-backup', version: 1, workspace: data, photos: [photo] };
  const parsed = C.storage.parseBackup(JSON.stringify(backup));
  assert.equal(parsed.photos[0].blob.type, 'image/png');
  assert.equal(parsed.photos[0].classification, 'Observed');
  assert.throws(() => C.storage.parseBackup(JSON.stringify({ ...backup, photos: [{ ...photo, deviceId: 'device-south-ap' }] })), /selected branch/);
  assert.throws(() => C.storage.parseBackup(JSON.stringify({ ...backup, version: 2 })), /Unsupported/);
});

test('view renderers escape imported text', () => {
  const C = load();
  const data = C.demo.create();
  data.decisions[0].title = '<img src=x onerror=alert(1)>';
  const html = C.views.decisions(data, { selectedDecisionId: data.decisions[0].id, decisionSearch: '' });
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<img src=x'));
});

test('file-open entrypoint has only locally bundled assets and no module loader', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const assets = [...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(assets, ['styles.css', 'model.js', 'demo.js', 'storage.js', 'topology.js', 'views.js', 'app.js']);
  for (const asset of assets) assert.ok(fs.existsSync(path.join(root, asset)), `${asset} exists`);
  assert.ok(!html.includes('type="module"'));
  assert.match(html, /connect-src 'none'/);
  for (const asset of assets.filter(item => item.endsWith('.js'))) {
    assert.doesNotMatch(fs.readFileSync(path.join(root, asset), 'utf8'), /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/);
  }
});
