'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

function load() {
  const context = vm.createContext({ window: {}, Blob, Uint8Array, ArrayBuffer, atob, console });
  for (const file of ['model.js', 'library.js', 'assurance.js', 'meraki.js', 'sdwan.js', 'intelligence.js', 'current-report.js', 'scenario.js', 'vendor/xlsx.full.min.js', 'transformation.js', 'demo.js', 'storage.js', 'transformation-views.js', 'sdwan-views.js', 'intelligence-views.js', 'current-report-views.js', 'scenario-views.js', 'library-views.js', 'views.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  return { C: context.window.Cockpit, XLSX: context.window.XLSX };
}
const highHeaders = ['Location', 'Workstream', 'TA', 'Category', 'Detail', 'Start', 'End', 'Dependency', 'Jan 2027', 'Feb 2027'];
const detailHeaders = ['Programme Area', 'Phase', 'Task', 'Source Schedule', 'Resources', 'Source Category', 'Start', 'End', 'Planning Status', 'Source Line', 'Notes'];
function rows() {
  return {
    high: [highHeaders, ['Example Branch North', 'Branch Rollout', 'TA-SYN', 'Branch LAN', 'Synthetic scope', '10/01/2027', '2027-02-28', 'Core ready', '●', '●']],
    detail: [detailHeaders, ['Example Branch North', 'Design', 'Complete LLD', 'SYN-01', 'Synthetic team', 'Design', '2027-01-10', '2027-01-31', 'TBD', 'SYN-001', 'Synthetic note']],
  };
}
function workbook(C, XLSX, rowsIn = rows()) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rowsIn.high), 'Planned High Level Streams');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rowsIn.detail), 'Detailed Plan');
  return C.transformation.parseWorkbook(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), 'Synthetic plan.xlsx');
}

test('bundled XLSX maps both sheets and preserves displayed source fields and markers', () => {
  const { C, XLSX } = load();
  const parsed = workbook(C, XLSX), projected = C.transformation.projectRows(parsed);
  const stream = projected.streams[0], activity = projected.activities[0];
  assert.equal(stream.source.area, 'Example Branch North');
  assert.equal(stream.source.workstream, 'Branch Rollout');
  assert.equal(stream.source.ta, 'TA-SYN');
  assert.equal(stream.source.category, 'Branch LAN');
  assert.equal(stream.source.sourceDomainId, 'branch-lan');
  assert.equal(stream.source.scope, 'Synthetic scope');
  assert.equal(stream.source.plannedStart, '2027-01-10');
  assert.equal(stream.source.plannedEnd, '2027-02-28');
  assert.equal(stream.source.dependencyText, 'Core ready');
  assert.equal(stream.source.monthMarkers[0].month, '2027-01');
  assert.equal(stream.source.values.Start, '10/01/2027');
  assert.equal(activity.source.area, 'Example Branch North');
  assert.equal(activity.source.phase, 'Design');
  assert.equal(activity.source.task, 'Complete LLD');
  assert.equal(activity.source.schedule, 'SYN-01');
  assert.equal(activity.source.participants, 'Synthetic team');
  assert.equal(activity.source.category, 'Design');
  assert.equal(activity.source.planningStatus, 'TBD');
  assert.equal(activity.source.sourceLine, 'SYN-001');
  assert.equal(activity.source.notes, 'Synthetic note');
});

test('Excel serial dates and non-first-row headers retain source display and row traceability', () => {
  const { C, XLSX } = load();
  const serial = date => (Date.parse(`${date}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86400000;
  const input = rows();
  input.high.unshift(['Synthetic workbook title']);
  input.high[2][5] = serial('2027-01-10');
  input.high[2][6] = serial('2027-02-28');
  const wb = XLSX.utils.book_new();
  const high = XLSX.utils.aoa_to_sheet(input.high);
  high.F3.z = 'dd/mm/yy'; high.G3.z = 'dd/mm/yy';
  XLSX.utils.book_append_sheet(wb, high, 'Planned High Level Streams');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(input.detail), 'Detailed Plan');
  const parsed = C.transformation.parseWorkbook(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
  const stream = C.transformation.projectRows(parsed).streams[0];
  assert.equal(stream.source.row, 3);
  assert.equal(stream.source.plannedStart, '2027-01-10');
  assert.equal(stream.source.plannedEnd, '2027-02-28');
  assert.match(stream.source.values.Start, /27/);
  assert.equal(C.transformation.parseDate('10/01/27'), '2027-01-10');
  assert.equal(C.transformation.parseDate('10 Jan 2027'), '2027-01-10');
});

test('workbooks without required sheets or headers are rejected before import', () => {
  const { C, XLSX } = load();
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Other', 'Columns']]), 'Planned High Level Streams');
  const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  assert.throws(() => C.transformation.parseWorkbook(bytes), /missing sheet: Detailed Plan/);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([detailHeaders]), 'Detailed Plan');
  assert.throws(() => C.transformation.parseWorkbook(XLSX.write(wb, { type: 'array', bookType: 'xlsx' })), /missing required column headers/);
});

test('repeat import is idempotent for source records and architect enrichment survives changes', () => {
  const { C, XLSX } = load();
  const base = C.demo.create(), first = workbook(C, XLSX);
  const applied = C.transformation.applyImport(base, C.transformation.previewImport(base, first));
  const stream = applied.transStreams.find(item => item.sourceKey === C.transformation.projectRows(first).streams[0].sourceKey);
  const activity = applied.transActivities.find(item => item.source.sourceLine === 'SYN-001');
  let enriched = C.transformation.addMapping(applied, 'Stream', stream.id, 'Domain', 'branch-lan');
  enriched = C.transformation.setGate(enriched, 'Stream', stream.id, 'LLD Ready', 'Synthetic architect review');
  enriched = C.transformation.linkActivity(enriched, activity.id, stream.id);
  const beforeCounts = [enriched.transStreams.length, enriched.transActivities.length, enriched.transDependencies.length];
  const unchanged = C.transformation.previewImport(enriched, first);
  assert.equal(unchanged.changes.length, 0);
  const repeated = C.transformation.applyImport(enriched, unchanged);
  assert.deepEqual([repeated.transStreams.length, repeated.transActivities.length, repeated.transDependencies.length], beforeCounts);
  const changedRows = rows(); changedRows.high[1][4] = 'Changed synthetic scope'; changedRows.high[1][5] = '2027-01-12'; changedRows.high[1][7] = 'Core and security ready'; changedRows.detail[1][8] = 'In progress';
  const changed = workbook(C, XLSX, changedRows), preview = C.transformation.previewImport(repeated, changed);
  assert.ok(preview.changes.some(item => item.entityKind === 'Stream' && item.kind === 'Changed' && item.dateChange && item.dependencyChange));
  assert.ok(preview.changes.some(item => item.entityKind === 'Activity' && item.statusChange));
  const next = C.transformation.applyImport(repeated, preview);
  assert.equal(next.transStreams.find(item => item.id === stream.id).source.scope, 'Changed synthetic scope');
  assert.equal(C.transformation.gateOf(next, 'Stream', stream.id), 'LLD Ready');
  assert.ok(next.transMappings.some(item => item.ownerId === stream.id && item.targetId === 'branch-lan'));
  assert.equal(next.transActivities.find(item => item.id === activity.id).streamId, stream.id);
  assert.ok(next.transDependencies.some(item => item.streamId === stream.id && item.sourceText === 'Core ready' && item.removed));
  assert.ok(next.transDependencies.some(item => item.streamId === stream.id && item.sourceText === 'Core and security ready' && !item.removed));
});

test('preview detects removed records without deleting enrichment', () => {
  const { C, XLSX } = load();
  const original = workbook(C, XLSX), data = C.transformation.applyImport(C.demo.create(), C.transformation.previewImport(C.demo.create(), original));
  const id = C.transformation.projectRows(original).streams[0].id;
  const enriched = C.transformation.addMapping(data, 'Stream', id, 'Branch', 'branch-north');
  const smaller = rows(); smaller.high.pop(); smaller.detail.pop();
  const preview = C.transformation.previewImport(enriched, workbook(C, XLSX, smaller));
  assert.equal(preview.summary.removed, 2);
  const applied = C.transformation.applyImport(enriched, preview);
  assert.equal(applied.transStreams.find(item => item.id === id).removed, true);
  assert.ok(applied.transMappings.some(item => item.ownerId === id));
});

test('explicit cross-stream dependency link survives an unchanged re-import', () => {
  const { C, XLSX } = load();
  const input = rows();
  input.high.push(['Teraco', 'Core Connectivity', 'TA-CORE', 'Teraco Core', 'Synthetic core', '2026-12-01', '2027-02-01', '', '', '']);
  const parsed = workbook(C, XLSX, input);
  const first = C.transformation.applyImport(C.demo.create(), C.transformation.previewImport(C.demo.create(), parsed));
  const north = first.transStreams.find(item => !item.removed && item.source.area === 'Example Branch North');
  const core = first.transStreams.find(item => !item.removed && item.source.area === 'Teraco');
  const dependency = first.transDependencies.find(item => !item.removed && item.streamId === north.id);
  assert.throws(() => C.transformation.linkDependency(first, dependency.id, north.id), /cannot depend on itself/);
  const linked = C.transformation.linkDependency(first, dependency.id, core.id);
  const repeated = C.transformation.applyImport(linked, C.transformation.previewImport(linked, parsed));
  assert.equal(repeated.transDependencies.find(item => item.id === dependency.id).targetStreamId, core.id);
  assert.equal(repeated.transDependencies.filter(item => !item.removed && item.streamId === north.id).length, 1);
});

test('date and marker conflicts, missing TA, name variants and TBD are reported without correction', () => {
  const { C, XLSX } = load();
  const input = rows();
  input.high[1][2] = ''; input.high[1][5] = '2027-03-01'; input.high[1][6] = '2027-02-01';
  input.high.push(['Example  Branch North', 'branch rollout', 'TA-SYN', 'Branch LAN', 'Other synthetic scope', '', '', '', '●', '']);
  const parsed = workbook(C, XLSX, input), issues = C.transformation.qualityIssues(C.transformation.projectRows(parsed));
  const codes = new Set(issues.map(item => item.code));
  for (const code of ['DATE_CONFLICT', 'MARKER_DATE_CONFLICT', 'MISSING_TA', 'MISSING_DATE', 'TBD_STATUS', 'POSSIBLE_DUPLICATE_AREA', 'INCONSISTENT_NAME']) assert.ok(codes.has(code), code);
  assert.equal(C.transformation.projectRows(parsed).streams[0].source.values.Start, '2027-03-01');
  assert.equal(C.transformation.parseDate('2027-02-29'), null);
  assert.equal(C.transformation.parseDate(44927), '2023-01-01');
  assert.equal(C.transformation.monthOf('Jan 2027'), '2027-01');
});

test('planning status and architecture gate remain independent; backup preserves portfolio', async () => {
  const { C } = load();
  const data = C.demo.create(), activity = data.transActivities.find(item => item.source.planningStatus === 'TBD');
  const next = C.transformation.setGate(data, 'Activity', activity.id, 'Architecture Defined', 'Synthetic review');
  assert.equal(next.transActivities.find(item => item.id === activity.id).source.planningStatus, 'TBD');
  assert.equal(C.transformation.gateOf(next, 'Activity', activity.id), 'Architecture Defined');
  const backup = await C.storage.makeBackup(next, []), restored = C.storage.parseBackup(JSON.stringify(backup)).workspace;
  assert.equal(restored.transStreams.length, next.transStreams.length);
  assert.equal(restored.transMappings.length, next.transMappings.length);
  assert.equal(restored.transGates.length, next.transGates.length);
  assert.equal(restored.dataQualityIssues.length, next.dataQualityIssues.length);
  assert.equal(restored.transActivities.find(item => item.id === activity.id).source.planningStatus, 'TBD');
  const legacy = C.model.copy(next); legacy.schemaVersion = 4;
  for (const name of ['transProgrammes', 'transProjects', 'transStreams', 'transActivities', 'transDependencies', 'transMilestones', 'transMappings', 'transGates', 'planImports', 'importChanges', 'dataQualityIssues']) delete legacy[name];
  const migrated = C.model.migrateWorkspace(legacy);
  assert.equal(migrated.schemaVersion, 9);
  assert.equal(migrated.transStreams.length, 0);
  assert.equal(migrated.merakiCandidates.length, next.merakiCandidates.length);
});

test('all portfolio views render synthetic data and escape workbook text', () => {
  const { C } = load(), data = C.demo.create();
  const ui = { transTimelineBy: 'Architecture Domain', transKind: 'Stream', transItemId: data.transStreams[0].id };
  for (const screen of ['transformation', 'transTimeline', 'transProjects', 'transWorkstreams', 'transMatrix', 'transDependencies', 'transQuality', 'transDetail']) {
    assert.ok(C.views[screen](data, ui).length > 200, screen);
  }
  data.transStreams[0].source.values.Detail = '<img src=x onerror=alert(1)>';
  const html = C.views.transDetail(data, ui);
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<img src=x'));
});
