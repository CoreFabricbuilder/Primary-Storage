/* Local workbook projection and architecture enrichment. Source rows never update mappings or gates. */
(() => {
  'use strict';
  const C = window.Cockpit;
  const SHEETS = ['Planned High Level Streams', 'Detailed Plan'];
  const GATES = Object.freeze(['Planned', 'Architecture Defined', 'LLD Ready', 'Implementation Ready', 'Deployed', 'Validated', 'As-Built']);
  const DOMAINS = Object.freeze([
    ['Teraco Core', 'Teraco Core'], ['Catalyst SD-WAN', 'SD-WAN'], ['Branch LAN', 'Branch'], ['Meraki Wi-Fi', 'Wireless'],
    ['Campus LAN', 'Campus LAN'], ['Campus Core', 'Campus LAN'], ['Security', 'Security'], ['Internet', 'Internet'],
    ['AWS / Cloud', 'AWS'], ['Mainframe', 'Shared Services'], ['Shared Services', 'Shared Services'], ['Routing', 'SD-WAN'],
  ].map(([name, parent]) => ({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/,''), name, parent })));
  const REQUIRED = {
    [SHEETS[0]]: ['Location', 'Workstream', 'TA', 'Category', 'Detail', 'Start', 'End', 'Dependency'],
    [SHEETS[1]]: ['Programme Area', 'Phase', 'Task', 'Source Schedule', 'Resources', 'Source Category', 'Start', 'End', 'Planning Status', 'Source Line', 'Notes'],
  };
  const collections = ['transProgrammes', 'transProjects', 'transStreams', 'transActivities', 'transDependencies', 'transMilestones', 'transMappings', 'transGates', 'planImports', 'importChanges', 'dataQualityIssues'];
  const clean = value => String(value ?? '').trim();
  const norm = value => clean(value).replace(/\s+/g, ' ').toLowerCase();
  const keyOf = (...parts) => parts.map(norm).join('|');
  function stableId(prefix, key) {
    let a = 2166136261, b = 2166136261 ^ 0x9e3779b9;
    for (const char of key) { const code = char.charCodeAt(0); a = Math.imul(a ^ code, 16777619); b = Math.imul(b ^ code, 16777619); }
    return `${prefix}-${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}`;
  }
  function check(ok, message) { if (!ok) throw new Error(message); }
  function isoDate(y, m, d) {
    const value = new Date(Date.UTC(y, m - 1, d));
    return value.getUTCFullYear() === y && value.getUTCMonth() === m - 1 && value.getUTCDate() === d ? value.toISOString().slice(0, 10) : null;
  }
  function parseDate(value) {
    if (value instanceof Date) return isoDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
    const s = clean(value);
    if (!s || /^tbd|^tbc|^n\/a$/i.test(s)) return null;
    let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (m) return isoDate(+m[1], +m[2], +m[3]);
    m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
    if (m) return isoDate(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]); // South African day/month/year.
    m = s.match(/^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{2}|\d{4})$/i);
    if (m) return isoDate(m[3].length === 2 ? 2000 + +m[3] : +m[3], monthIndex[m[2].slice(0, 3).toLowerCase()], +m[1]);
    if (/^\d{5}(?:\.\d+)?$/.test(s)) {
      const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86400000);
      return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
    }
    return null;
  }
  const monthIndex = Object.freeze({ jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 });
  function monthOf(label) {
    const s = clean(label);
    let m = s.match(/^(20\d{2})[-/](0?[1-9]|1[0-2])$/);
    if (m) return `${m[1]}-${String(+m[2]).padStart(2, '0')}`;
    m = s.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s/-]*(20\d{2}|\d{2})?$/i);
    if (!m) return null;
    const year = m[2] ? (+m[2] < 100 ? 2000 + +m[2] : +m[2]) : null;
    return year ? `${year}-${String(monthIndex[m[1].slice(0, 3).toLowerCase()]).padStart(2, '0')}` : 'unknown-year';
  }
  function rowsFromSheet(sheet, name, xlsx) {
    const bounds = xlsx.utils.decode_range(sheet['!ref'] || 'A1:A1');
    check(bounds.e.r - bounds.s.r <= 6000 && bounds.e.c - bounds.s.c <= 100, `${name} exceeds workbook dimensions.`);
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false, blankrows: true });
    const required = REQUIRED[name];
    const headerIndex = rows.findIndex(row => required.every(field => row.some(cell => norm(cell) === norm(field))));
    check(headerIndex >= 0, `${name} is missing required column headers.`);
    const headers = rows[headerIndex].map(clean);
    check(headers.length <= 100, `${name} has too many columns.`);
    const seen = new Set();
    for (const header of headers.filter(Boolean)) { check(!seen.has(norm(header)), `${name} has a duplicate header: ${header}.`); seen.add(norm(header)); }
    const result = [];
    for (let index = headerIndex + 1; index < rows.length; index++) {
      const row = rows[index];
      if (!row.some(cell => clean(cell))) continue;
      const values = Object.fromEntries(headers.map((header, col) => [header || `Column ${col + 1}`, clean(row[col])]));
      const rowNumber = bounds.s.r + index + 1;
      check(Object.entries(values).every(([header, value]) => header.length <= 150 && value.length <= 4000), `${name} row ${rowNumber} has an oversized field.`);
      const dateValues = {};
      for (const field of ['Start', 'End']) {
        const col = headers.findIndex(header => norm(header) === norm(field));
        if (col < 0) continue;
        const address = xlsx.utils.encode_cell({ r: bounds.s.r + index, c: bounds.s.c + col });
        const cell = sheet[address] || sheet['!data']?.[bounds.s.r + index]?.[bounds.s.c + col];
        if (cell?.t === 'n') dateValues[field] = parseDate(cell.v);
      }
      result.push({ sheet: name, row: rowNumber, values, dateValues });
      check(result.length <= 5000, `${name} exceeds 5,000 rows.`);
    }
    return result;
  }
  function parseWorkbook(bytes, filename = 'Selected workbook.xlsx') {
    check(bytes && bytes.byteLength <= 25 * 1024 * 1024, 'Workbook exceeds 25 MB.');
    const xlsx = window.XLSX || globalThis.XLSX;
    check(xlsx?.read && xlsx?.utils?.sheet_to_json, 'Bundled XLSX parser is unavailable.');
    let workbook;
    try { workbook = xlsx.read(bytes, { type: 'array', cellDates: false, dense: true }); }
    catch { throw new Error('The selected file is not a readable XLSX workbook.'); }
    for (const name of SHEETS) check(workbook.Sheets[name], `Workbook is missing sheet: ${name}.`);
    return { filename: clean(filename).slice(0, 200), sheets: Object.fromEntries(SHEETS.map(name => [name, rowsFromSheet(workbook.Sheets[name], name, xlsx)])) };
  }
  function projectRows(parsed) {
    check(parsed?.sheets && SHEETS.every(name => Array.isArray(parsed.sheets[name])), 'Invalid transformation workbook projection.');
    const projectMap = new Map();
    const streamCounts = new Map(), activityCounts = new Map();
    const streams = parsed.sheets[SHEETS[0]].map(row => {
      const v = row.values, area = clean(v.Location), workstream = clean(v.Workstream), ta = clean(v.TA), category = clean(v.Category), scope = clean(v.Detail);
      if (ta) projectMap.set(norm(ta), { id: stableId('trp', norm(ta)), programmeId: 'tr-programme', code: ta, name: ta, removed: false });
      const base = keyOf(area, workstream, ta); const n = (streamCounts.get(base) || 0) + 1; streamCounts.set(base, n);
      const sourceKey = `high|${base}|${n}`;
      check(sourceKey.length <= 700, 'High-level stream identity is too long.');
      const monthMarkers = Object.entries(v).filter(([header, value]) => monthOf(header) && clean(value)).map(([label, value]) => ({ label, value, month: monthOf(label) }));
      return { id: stableId('trs', sourceKey), sourceKey, programmeId: 'tr-programme', projectId: ta ? stableId('trp', norm(ta)) : null, removed: false,
        source: { sheet: row.sheet, row: row.row, values: v, area, workstream, ta, category,
          sourceDomainId: DOMAINS.find(item => norm(item.name) === norm(category))?.id || null,
          scope, plannedStart: row.dateValues?.Start || parseDate(v.Start), plannedEnd: row.dateValues?.End || parseDate(v.End), dependencyText: clean(v.Dependency), monthMarkers } };
    });
    const activities = parsed.sheets[SHEETS[1]].map(row => {
      const v = row.values, area = clean(v['Programme Area']), phase = clean(v.Phase), task = clean(v.Task), schedule = clean(v['Source Schedule']);
      const sourceLine = clean(v['Source Line']);
      const base = sourceLine ? keyOf(sourceLine) : keyOf(area, phase, task, schedule);
      const n = (activityCounts.get(base) || 0) + 1; activityCounts.set(base, n);
      const sourceKey = `detail|${base}|${n}`;
      check(sourceKey.length <= 700, 'Detailed activity identity is too long.');
      return { id: stableId('tra', sourceKey), sourceKey, programmeId: 'tr-programme', streamId: null, removed: false,
        source: { sheet: row.sheet, row: row.row, values: v, area, phase, task, schedule, participants: clean(v.Resources), category: clean(v['Source Category']),
          plannedStart: row.dateValues?.Start || parseDate(v.Start), plannedEnd: row.dateValues?.End || parseDate(v.End), planningStatus: clean(v['Planning Status']), sourceLine, notes: clean(v.Notes) } };
    });
    return { projects: [...projectMap.values()], streams, activities, duplicateKeys: [...streamCounts, ...activityCounts].filter(([, count]) => count > 1).map(([key]) => key) };
  }
  function qualityIssues(projected) {
    const issues = [];
    const add = (item, code, detail) => issues.push({ entityKind: item.source.sheet === SHEETS[0] ? 'Stream' : 'Activity', sourceKey: item.sourceKey, code, detail, sheet: item.source.sheet, row: item.source.row });
    const all = [...projected.streams, ...projected.activities];
    const areaNames = new Map(), workstreamNames = new Map();
    for (const item of all) {
      const s = item.source, v = s.values;
      if (!s.plannedStart || !s.plannedEnd) add(item, 'MISSING_DATE', 'Start or End is missing or unreadable.');
      if (s.plannedStart && s.plannedEnd && s.plannedStart > s.plannedEnd) add(item, 'DATE_CONFLICT', 'Start is after End.');
      if (clean(v.Start) && !s.plannedStart) add(item, 'INVALID_START', 'Start cannot be parsed.');
      if (clean(v.End) && !s.plannedEnd) add(item, 'INVALID_END', 'End cannot be parsed.');
      if (s.area) {
        const previous = areaNames.get(norm(s.area));
        if (previous && previous !== s.area) add(item, 'POSSIBLE_DUPLICATE_AREA', `Area name differs from “${previous}”.`);
        else areaNames.set(norm(s.area), s.area);
      }
      if (s.workstream) {
        const previous = workstreamNames.get(norm(s.workstream));
        if (previous && previous !== s.workstream) add(item, 'INCONSISTENT_NAME', `Workstream name differs from “${previous}”.`);
        else workstreamNames.set(norm(s.workstream), s.workstream);
      }
      if (s.sheet === SHEETS[0]) {
        if (!s.ta) add(item, 'MISSING_TA', 'Project / TA mapping is missing.');
        for (const marker of s.monthMarkers) {
          if (marker.month === 'unknown-year') add(item, 'MARKER_YEAR_UNKNOWN', `${marker.label} marker has no year.`);
          else if (s.plannedStart && s.plannedEnd && (marker.month < s.plannedStart.slice(0, 7) || marker.month > s.plannedEnd.slice(0, 7)))
            add(item, 'MARKER_DATE_CONFLICT', `${marker.label} marker lies outside Start/End.`);
        }
      } else if (/^tbd|^tbc|^unknown$/i.test(s.planningStatus) || !s.planningStatus) add(item, 'TBD_STATUS', 'Source Planning Status is TBD or missing.');
    }
    for (const key of projected.duplicateKeys) issues.push({ entityKind: 'Plan', sourceKey: key, code: 'DUPLICATE_SOURCE_KEY', detail: 'Rows share the same identity fields; confirm whether they are separate activities.', sheet: '', row: 0 });
    const mappedAreas = new Set(projected.streams.filter(item => item.projectId).map(item => norm(item.source.area)));
    for (const item of projected.activities) if (!mappedAreas.has(norm(item.source.area))) add(item, 'MISSING_TA', 'No high-level stream with a Project / TA maps to this area.');
    return issues;
  }
  function sourceChanged(a, b) { return JSON.stringify(a) !== JSON.stringify(b); }
  function previewImport(data, parsed) {
    C.model.validateWorkspace(data);
    const projected = projectRows(parsed), changes = [];
    for (const [kind, incoming, existing] of [['Stream', projected.streams, data.transStreams], ['Activity', projected.activities, data.transActivities]]) {
      const old = new Map(existing.map(item => [item.sourceKey, item]));
      const now = new Set(incoming.map(item => item.sourceKey));
      for (const item of incoming) {
        const before = old.get(item.sourceKey);
        if (!before) changes.push({ kind: 'New', entityKind: kind, item, fields: [] });
        else if (before.removed || sourceChanged(before.source, item.source)) {
          const fields = Object.keys(item.source).filter(key => sourceChanged(before.source[key], item.source[key]));
          changes.push({ kind: before.removed ? 'Restored' : 'Changed', entityKind: kind, item, fields,
            dateChange: before.source.plannedStart !== item.source.plannedStart || before.source.plannedEnd !== item.source.plannedEnd,
            dependencyChange: kind === 'Stream' && before.source.dependencyText !== item.source.dependencyText,
            statusChange: kind === 'Activity' && before.source.planningStatus !== item.source.planningStatus });
        }
      }
      for (const item of existing.filter(item => !item.removed && !now.has(item.sourceKey))) changes.push({ kind: 'Removed', entityKind: kind, item, fields: [] });
    }
    return { filename: parsed.filename, projected, changes, issues: qualityIssues(projected), summary: {
      new: changes.filter(item => item.kind === 'New').length, changed: changes.filter(item => ['Changed', 'Restored'].includes(item.kind)).length,
      removed: changes.filter(item => item.kind === 'Removed').length, dates: changes.filter(item => item.dateChange).length,
      dependencies: changes.filter(item => item.dependencyChange).length, statuses: changes.filter(item => item.statusChange).length,
    } };
  }
  function applyImport(data, preview) {
    C.model.validateWorkspace(data);
    check(preview?.projected && Array.isArray(preview.changes), 'Import preview is required.');
    const next = C.model.copy(data), importId = C.model.newId(), now = new Date().toISOString();
    if (!next.transProgrammes.length) next.transProgrammes.push({ id: 'tr-programme', name: 'Transformation Portfolio' });
    const upsert = (collection, incoming) => {
      const byKey = new Map(collection.map(item => [item.sourceKey || norm(item.code), item]));
      const present = new Set(incoming.map(item => item.sourceKey || norm(item.code)));
      for (const item of incoming) {
        const key = item.sourceKey || norm(item.code), old = byKey.get(key);
        if (old) { if (item.source) old.source = item.source; if (item.projectId !== undefined) old.projectId = item.projectId; if (item.code) { old.code = item.code; old.name = item.name; } old.removed = false; }
        else collection.push({ ...item, importId });
      }
      for (const old of collection) if (!present.has(old.sourceKey || norm(old.code))) old.removed = true;
    };
    upsert(next.transProjects, preview.projected.projects);
    upsert(next.transStreams, preview.projected.streams);
    upsert(next.transActivities, preview.projected.activities);
    const dependencyKeys = new Set(), milestoneKeys = new Set();
    for (const stream of next.transStreams.filter(item => !item.removed)) {
      const texts = stream.source.dependencyText.split(/[;\n]+/).map(clean).filter(Boolean);
      for (const text of texts) {
        const key = `${stream.sourceKey}|${stableId('text', norm(text))}`; dependencyKeys.add(key);
        if (!next.transDependencies.some(item => item.sourceKey === key)) next.transDependencies.push({ id: stableId('trd', key), sourceKey: key, streamId: stream.id, sourceText: text, targetStreamId: null, removed: false, importId });
      }
      const milestones = [{ label: 'Planned End', date: stream.source.plannedEnd, markerValue: '' }, ...stream.source.monthMarkers.map(item => ({ label: item.label, date: item.month === 'unknown-year' ? null : `${item.month}-01`, markerValue: item.value }))];
      for (const milestone of milestones.filter(item => item.date || item.markerValue)) {
        const key = `${stream.sourceKey}|${stableId('label', norm(milestone.label))}`; milestoneKeys.add(key);
        const old = next.transMilestones.find(item => item.sourceKey === key);
        if (old) Object.assign(old, { ...milestone, removed: false });
        else next.transMilestones.push({ id: stableId('trm', key), sourceKey: key, streamId: stream.id, ...milestone, removed: false, importId });
      }
    }
    next.transDependencies.forEach(item => { item.removed = !dependencyKeys.has(item.sourceKey); });
    next.transMilestones.forEach(item => { item.removed = !milestoneKeys.has(item.sourceKey); });
    next.planImports.push({ id: importId, filename: preview.filename, importedAt: now, ...preview.summary, warningCount: preview.issues.length });
    for (const change of preview.changes) next.importChanges.push({ id: C.model.newId(), importId, kind: change.kind, entityKind: change.entityKind,
      entityId: change.item.id, sourceKey: change.item.sourceKey, fields: change.fields, dateChange: !!change.dateChange,
      dependencyChange: !!change.dependencyChange, statusChange: !!change.statusChange });
    for (const issue of preview.issues) next.dataQualityIssues.push({ id: C.model.newId(), importId, ...issue });
    return C.model.validateWorkspace(next);
  }
  function setGate(data, ownerKind, ownerId, gate, note = '') {
    check(GATES.includes(gate), 'Invalid architecture gate.'); check(clean(note).length <= 500, 'Gate note is too long.');
    const next = C.model.copy(data); check(owner(next, ownerKind, ownerId), 'Transformation item not found.');
    const prior = next.transGates.find(item => item.ownerKind === ownerKind && item.ownerId === ownerId);
    if (prior) Object.assign(prior, { gate, note: clean(note), updatedAt: new Date().toISOString() });
    else next.transGates.push({ id: C.model.newId(), ownerKind, ownerId, gate, note: clean(note), updatedAt: new Date().toISOString() });
    return C.model.validateWorkspace(next);
  }
  function owner(data, kind, id) { return (kind === 'Stream' ? data.transStreams : kind === 'Activity' ? data.transActivities : []).find(item => item.id === id); }
  const targetCollections = { Site: 'sites', Branch: 'branches', Component: 'components', 'Branch Pattern': 'branchPatterns', Decision: 'decisions', Dependency: 'dependencies', Source: 'sources' };
  function addMapping(data, ownerKind, ownerId, targetKind, targetId, reference = '') {
    const next = C.model.copy(data); check(owner(next, ownerKind, ownerId), 'Transformation item not found.');
    check(targetKind === 'Domain' || targetKind === 'HLD' || targetKind === 'LLD' || targetKind === 'Validation Requirement' || targetCollections[targetKind], 'Invalid architecture mapping kind.');
    const ref = clean(reference); check(ref.length <= 300, 'Mapping reference is too long.');
    if (targetKind === 'Domain') check(DOMAINS.some(item => item.id === targetId), 'Architecture domain not found.');
    else if (targetCollections[targetKind]) check(next[targetCollections[targetKind]].some(item => item.id === targetId), 'Architecture target not found.');
    else check(ref, 'Enter a document or validation reference.');
    check(!next.transMappings.some(item => item.ownerKind === ownerKind && item.ownerId === ownerId && item.targetKind === targetKind && item.targetId === targetId && item.reference === ref), 'Mapping already exists.');
    next.transMappings.push({ id: C.model.newId(), ownerKind, ownerId, targetKind, targetId: targetId || null, reference: ref, source: 'Architect' });
    return C.model.validateWorkspace(next);
  }
  function removeMapping(data, id) {
    const next = C.model.copy(data), index = next.transMappings.findIndex(item => item.id === id);
    check(index >= 0, 'Mapping not found.'); next.transMappings.splice(index, 1); return C.model.validateWorkspace(next);
  }
  function linkActivity(data, activityId, streamId) {
    const next = C.model.copy(data), item = next.transActivities.find(item => item.id === activityId);
    check(item && (!streamId || next.transStreams.some(stream => stream.id === streamId)), 'Stream or activity not found.');
    item.streamId = streamId || null; return C.model.validateWorkspace(next);
  }
  function linkDependency(data, dependencyId, streamId) {
    const next = C.model.copy(data), item = next.transDependencies.find(item => item.id === dependencyId);
    check(item && (!streamId || next.transStreams.some(stream => stream.id === streamId)), 'Stream dependency target not found.');
    check(!streamId || streamId !== item.streamId, 'A stream cannot depend on itself.');
    item.targetStreamId = streamId || null; return C.model.validateWorkspace(next);
  }
  function gateOf(data, kind, id) { return data.transGates.find(item => item.ownerKind === kind && item.ownerId === id)?.gate || 'Planned'; }
  function validate(data) {
    for (const name of collections) check(Array.isArray(data[name]), `Missing ${name}.`);
    const ids = name => new Set(data[name].map(item => item.id));
    const programmes = ids('transProgrammes'), projects = ids('transProjects'), streams = ids('transStreams'), imports = ids('planImports');
    const short = (value, max) => typeof value === 'string' && value.length <= max;
    const date = value => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value);
    for (const item of data.transProgrammes) check(short(item.name, 200), 'Invalid transformation programme.');
    for (const item of data.transProjects) check(programmes.has(item.programmeId) && short(item.code, 200) && short(item.name, 200) && typeof item.removed === 'boolean', 'Invalid transformation project.');
    for (const [name, kind] of [['transStreams', 'Stream'], ['transActivities', 'Activity']]) for (const item of data[name]) {
      check(programmes.has(item.programmeId) && short(item.sourceKey, 700) && item.source && typeof item.source === 'object' && !Array.isArray(item.source) && item.source.values && typeof item.source.values === 'object' && !Array.isArray(item.source.values) && typeof item.removed === 'boolean', `Invalid ${kind} source.`);
      const source = item.source;
      check(source.sheet === (kind === 'Stream' ? SHEETS[0] : SHEETS[1]) && Number.isInteger(source.row) && source.row >= 1 && source.row <= 100000, `Invalid ${kind} traceability.`);
      check(Object.keys(source.values).length <= 100 && Object.entries(source.values).every(([field, value]) => short(field, 150) && short(value, 4000)), `Invalid ${kind} source values.`);
      check(short(source.area, 4000) && date(source.plannedStart) && date(source.plannedEnd), `Invalid ${kind} dates or area.`);
      if (kind === 'Stream') check(item.projectId === null || projects.has(item.projectId), 'Stream project is missing.');
      if (kind === 'Stream') {
        check(['workstream', 'ta', 'category', 'scope', 'dependencyText'].every(field => short(source[field], 4000)), 'Invalid stream source fields.');
        check(source.sourceDomainId === null || DOMAINS.some(domain => domain.id === source.sourceDomainId), 'Invalid source domain mapping.');
        check(Array.isArray(source.monthMarkers) && source.monthMarkers.length <= 100 && source.monthMarkers.every(marker => short(marker.label, 150) && short(marker.value, 4000) && short(marker.month, 20)), 'Invalid timeline markers.');
      } else {
        check(item.streamId === null || streams.has(item.streamId), 'Activity stream is missing.');
        check(['phase', 'task', 'schedule', 'participants', 'category', 'planningStatus', 'sourceLine', 'notes'].every(field => short(source[field], 4000)), 'Invalid activity source fields.');
      }
    }
    for (const item of data.transDependencies) check(streams.has(item.streamId) && (item.targetStreamId === null || streams.has(item.targetStreamId)) && short(item.sourceKey, 800) && short(item.sourceText, 4000) && typeof item.removed === 'boolean', 'Invalid transformation dependency.');
    for (const item of data.transMilestones) check(streams.has(item.streamId) && short(item.sourceKey, 800) && short(item.label, 150) && short(item.markerValue, 4000) && date(item.date) && typeof item.removed === 'boolean', 'Invalid transformation milestone.');
    for (const item of data.transGates) check(owner(data, item.ownerKind, item.ownerId) && GATES.includes(item.gate) && short(item.note, 500) && short(item.updatedAt, 40), 'Invalid transformation gate.');
    for (const item of data.transMappings) {
      check(owner(data, item.ownerKind, item.ownerId) && short(item.reference, 300) && item.source === 'Architect', 'Invalid architecture mapping.');
      if (item.targetKind === 'Domain') check(DOMAINS.some(domain => domain.id === item.targetId), 'Invalid mapped domain.');
      else if (targetCollections[item.targetKind]) check(data[targetCollections[item.targetKind]].some(target => target.id === item.targetId), 'Invalid mapped target.');
      else check(['HLD', 'LLD', 'Validation Requirement'].includes(item.targetKind) && item.reference, 'Invalid mapped reference.');
    }
    for (const item of data.planImports) check(short(item.filename, 200) && short(item.importedAt, 40) && ['new', 'changed', 'removed', 'dates', 'dependencies', 'statuses', 'warningCount'].every(field => Number.isInteger(item[field]) && item[field] >= 0), 'Invalid plan import.');
    for (const item of data.importChanges) check(imports.has(item.importId) && ['New', 'Changed', 'Restored', 'Removed'].includes(item.kind) && ['Stream', 'Activity'].includes(item.entityKind) && short(item.sourceKey, 700) && Array.isArray(item.fields) && item.fields.every(field => short(field, 100)), 'Invalid import change.');
    for (const item of data.dataQualityIssues) check(imports.has(item.importId) && short(item.code, 100) && short(item.detail, 500) && short(item.sourceKey, 700), 'Invalid data quality issue.');
    return data;
  }
  C.transformation = Object.freeze({ SHEETS, GATES, DOMAINS, parseDate, monthOf, parseWorkbook, projectRows, qualityIssues, previewImport, applyImport,
    setGate, addMapping, removeMapping, linkActivity, linkDependency, gateOf, validate });
})();
