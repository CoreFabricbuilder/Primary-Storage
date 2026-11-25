/* Read-only Catalyst SD-WAN snapshot adapter and immutable validation history. */
(() => {
  'use strict';
  const C = window.Cockpit;
  const FORMAT = 'network-refresh-sdwan-snapshot';
  const MAX_SNAPSHOT_BYTES = 30 * 1024 * 1024;
  const specs = Object.freeze([
    ['edgeCount', 'Expected WAN Edges', 'number', 'Critical'],
    ['siteId', 'Site ID', 'exact', 'Critical'],
    ['systemIps', 'System IPs', 'set', 'High'],
    ['deviceStatus', 'WAN Edge reachability', 'exact', 'High'],
    ['colours', 'Transport colours', 'set', 'Critical'],
    ['vpnIds', 'Service VPN IDs', 'set', 'High'],
    ['tlocCount', 'TLOC quantity', 'number', 'High'],
    ['bfdState', 'BFD sessions', 'exact', 'High'],
    ['controlState', 'Control connections', 'exact', 'Critical'],
    ['ompState', 'OMP peers', 'exact', 'High'],
    ['serviceSide', 'LAN/service-side interfaces', 'exact', 'High'],
    ['templateAssociation', 'Configuration group/template', 'exact', 'Medium'],
    ['policyAssociation', 'Central policy association', 'exact', 'Medium'],
    ['activeAlarms', 'Active alarms', 'number', 'High'],
  ].map(([key, label, comparator, severity]) => ({ key, label, comparator, severity, mandatory: severity === 'Critical' })));
  const specMap = new Map(specs.map(item => [item.key, item]));
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const str = (v, max = 200) => typeof v === 'string' ? v.slice(0, max) : '';
  function credentials(value, depth = 0) {
    check(depth < 12, 'Snapshot nesting exceeds supported limit.');
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      check(!/(api[-_]?key|authorization|password|passphrase|psk|token|secret|credential|private[-_]?key)/i.test(key), 'Snapshot contains a credential field.');
      credentials(item, depth + 1);
    }
  }
  function parseSnapshot(input) {
    check(typeof input === 'string' && input.length <= MAX_SNAPSHOT_BYTES, 'SD-WAN snapshot exceeds 30 MB.');
    let raw;
    try { raw = JSON.parse(input); } catch { throw new Error('SD-WAN snapshot is not valid JSON.'); }
    credentials(raw);
    check(raw?.format === FORMAT && raw.version === 1, 'Unsupported SD-WAN snapshot format.');
    check(typeof raw.generatedAt === 'string' && !Number.isNaN(Date.parse(raw.generatedAt)), 'Invalid snapshot timestamp.');
    check(typeof raw.manager === 'string' && raw.manager.length <= 160 && raw.manager.trim(), 'Invalid Manager label.');
    check(typeof raw.siteId === 'string' && /^[0-9]{1,10}$/.test(raw.siteId), 'Invalid Cisco Site ID.');
    const names = ['devices', 'controlConnections', 'ompPeers', 'bfdSessions', 'interfaces', 'wanInterfaces', 'tlocs', 'alarms'];
    for (const name of names) check(Array.isArray(raw[name]) && raw[name].length <= 5000, `Invalid ${name} list.`);
    check(raw.coverage && typeof raw.coverage === 'object', 'Missing query coverage.');
    for (const name of ['inventory', 'control', 'omp', 'bfd', 'interfaces', 'wan', 'tlocs', 'alarms', 'associations', 'policy']) check(typeof raw.coverage[name] === 'boolean', `Invalid ${name} coverage.`);
    const fields = {
      devices: ['id', 'hostName', 'systemIp', 'siteId', 'status', 'model', 'template', 'configGroup', 'policyGroup'],
      controlConnections: ['systemIp', 'peer', 'state', 'color'], ompPeers: ['systemIp', 'peer', 'state'],
      bfdSessions: ['systemIp', 'peer', 'state', 'color'], interfaces: ['systemIp', 'name', 'vpnId', 'status', 'side'],
      wanInterfaces: ['systemIp', 'name', 'color', 'status'],
      tlocs: ['systemIp', 'color', 'encapsulation', 'state'], alarms: ['id', 'severity', 'state'],
    };
    const clean = { format: FORMAT, version: 1, generatedAt: raw.generatedAt, manager: raw.manager, siteId: raw.siteId, coverage: {} };
    for (const name of Object.keys(raw.coverage)) if (Object.hasOwn(raw.coverage, name) && typeof raw.coverage[name] === 'boolean') clean.coverage[name] = raw.coverage[name];
    for (const name of names) clean[name] = raw[name].map(item => {
      check(item && typeof item === 'object' && !Array.isArray(item), `Invalid ${name} item.`);
      return Object.fromEntries(fields[name].map(key => [key, str(item[key], 160)]));
    });
    check(clean.devices.every(item => !item.siteId || item.siteId === clean.siteId), 'Snapshot includes a device from another site.');
    return clean;
  }
  const unique = values => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b)).join(', ');
  const allUp = (items, good) => items.length && items.every(item => good.includes((item.state || item.status || '').toLowerCase())) ? 'Operational' : 'Degraded';
  function candidatesFrom(s) {
    const out = [];
    const add = (key, value, endpoint) => { if (value !== null && value !== undefined && String(value).length <= 500) out.push({ key, value: String(value), source: `${s.manager} · site ${s.siteId} · ${s.generatedAt} · ${endpoint}`.slice(0, 300) }); };
    if (s.coverage.inventory) {
      add('edgeCount', s.devices.length, 'device inventory');
      if (s.devices.length && s.devices.every(d => d.siteId === s.siteId)) add('siteId', s.siteId, 'device inventory');
      if (s.devices.length && s.devices.every(d => d.systemIp)) add('systemIps', unique(s.devices.map(d => d.systemIp)), 'device inventory');
      if (s.devices.length) add('deviceStatus', s.devices.every(d => ['reachable', 'up', 'online'].includes(d.status.toLowerCase())) ? 'Operational' : 'Degraded', 'device inventory');
      if (s.coverage.associations && s.devices.length) {
        if (s.devices.every(d => d.configGroup || d.template)) add('templateAssociation', unique(s.devices.map(d => d.configGroup || d.template)), 'inventory association');
      }
      if (s.coverage.policy && s.devices.length && s.devices.every(d => d.policyGroup)) add('policyAssociation', unique(s.devices.map(d => d.policyGroup)), 'policy association');
    }
    if (s.coverage.tlocs) {
      add('tlocCount', s.tlocs.length, 'device TLOC status');
      if (s.tlocs.length) add('colours', unique(s.tlocs.map(t => t.color)), 'device TLOC status');
    } else if (s.coverage.wan && s.wanInterfaces.length) add('colours', unique(s.wanInterfaces.map(i => i.color)), 'control WAN interfaces');
    if (s.coverage.bfd) add('bfdState', allUp(s.bfdSessions, ['up']), 'BFD sessions');
    if (s.coverage.control) add('controlState', allUp(s.controlConnections, ['up', 'connected']), 'control connections');
    if (s.coverage.omp) add('ompState', allUp(s.ompPeers, ['up', 'connected']), 'OMP peers');
    if (s.coverage.interfaces) {
      const services = s.interfaces.filter(i => i.vpnId && !['0', '512'].includes(i.vpnId));
      add('vpnIds', unique(services.map(i => i.vpnId)) || 'None', 'interfaces');
      add('serviceSide', allUp(services, ['up', 'operational']), 'service-side interfaces');
    }
    if (s.coverage.alarms) add('activeAlarms', s.alarms.filter(a => !['cleared', 'closed'].includes(a.state.toLowerCase())).length, 'alarms');
    return out;
  }
  function scopeValid(data, kind, id) { return kind === 'Branch' ? data.branches.some(x => x.id === id) : kind === 'Campus' && data.sites.some(x => x.id === id && /campus/i.test(x.siteType)); }
  function stageSnapshot(data, snapshot, scopeKind, scopeId) {
    C.model.validateWorkspace(data);
    check(scopeValid(data, scopeKind, scopeId), 'Select a branch or campus site.');
    const s = parseSnapshot(JSON.stringify(snapshot));
    const next = C.model.copy(data), batchId = C.model.newId();
    next.sdwanBatches.push({ id: batchId, scopeKind, scopeId, manager: s.manager, siteId: s.siteId, generatedAt: s.generatedAt, importedAt: new Date().toISOString(), coverage: s.coverage, deviceCount: s.devices.length });
    for (const item of candidatesFrom(s)) next.sdwanCandidates.push({ id: C.model.newId(), batchId, scopeKind, scopeId, key: item.key, value: item.value, source: item.source, classification: 'Observed', status: 'Pending', observationId: null });
    return { data: C.model.validateWorkspace(next), batchId, count: candidatesFrom(s).length };
  }
  function applyCandidate(data, id) {
    const next = C.model.copy(data), item = next.sdwanCandidates.find(x => x.id === id);
    check(item?.status === 'Pending', 'Only pending SD-WAN observations can be applied.');
    const observation = { id: C.model.newId(), scopeKind: item.scopeKind, scopeId: item.scopeId, key: item.key, value: item.value, source: item.source, classification: 'Observed', recordedAt: new Date().toISOString(), batchId: item.batchId };
    next.sdwanObservations.push(observation); item.status = 'Applied'; item.observationId = observation.id;
    return C.model.validateWorkspace(next);
  }
  function dismissCandidate(data, id) {
    const next = C.model.copy(data), item = next.sdwanCandidates.find(x => x.id === id);
    check(item?.status === 'Pending', 'Only pending SD-WAN observations can be dismissed.');
    item.status = 'Dismissed'; return C.model.validateWorkspace(next);
  }
  function activeTarget(data, kind, id) { return [...data.sdwanTargets].reverse().find(x => x.scopeKind === kind && x.scopeId === id && x.status === 'Active') || null; }
  function saveTarget(data, kind, id, values, source) {
    check(scopeValid(data, kind, id), 'Select a branch or campus site.');
    check(typeof source === 'string' && source.trim() && source.length <= 300, 'Target needs a source or architect rationale.');
    const next = C.model.copy(data);
    for (const old of next.sdwanTargets) if (old.scopeKind === kind && old.scopeId === id && old.status === 'Active') old.status = 'Superseded';
    const clean = {};
    for (const spec of specs) {
      check(typeof (values[spec.key] || '') === 'string' && (values[spec.key] || '').length <= 500, `Invalid ${spec.label} target.`);
      const value = (values[spec.key] || '').trim();
      if (value && spec.comparator === 'number') check(/^\d+$/.test(value), `${spec.label} must be a non-negative integer.`);
      clean[spec.key] = value;
    }
    next.sdwanTargets.push({ id: C.model.newId(), scopeKind: kind, scopeId: id, status: 'Active', values: clean, source: source.trim(), createdAt: new Date().toISOString() });
    return C.model.validateWorkspace(next);
  }
  function latestRun(data, kind, id) { return [...data.sdwanRuns].reverse().find(x => x.scopeKind === kind && x.scopeId === id) || null; }
  function stateOf(results) {
    if (results.some(x => x.mandatory && x.outcome === 'Fail')) return 'Failed';
    if (results.some(x => x.mandatory && x.outcome === 'Unknown')) return 'Not Ready';
    if (results.some(x => x.outcome === 'Fail' || x.outcome === 'Warning')) return 'Needs Review';
    return 'Ready for Review';
  }
  function runValidation(data, kind, id) {
    const target = activeTarget(data, kind, id); check(target, 'Save architecture targets before validation.');
    const next = C.model.copy(data), runId = C.model.newId();
    const results = specs.map(spec => {
      const observation = [...next.sdwanObservations].reverse().find(x => x.scopeKind === kind && x.scopeId === id && x.key === spec.key);
      const expected = target.values[spec.key];
      const comparison = C.assurance.compare(spec, expected, observation);
      return { id: C.model.newId(), runId, key: spec.key, expected, observed: observation?.value || '', observationId: observation?.id || null, source: observation?.source || '', outcome: comparison.outcome, note: comparison.note, severity: spec.severity, mandatory: spec.mandatory };
    });
    const state = stateOf(results);
    next.sdwanRuns.push({ id: runId, scopeKind: kind, scopeId: id, targetId: target.id, runAt: new Date().toISOString(), state });
    next.sdwanResults.push(...results);
    return { data: C.model.validateWorkspace(next), id: runId };
  }
  function validate(data) {
    const batches = new Map(data.sdwanBatches.map(x => [x.id, x]));
    const observations = new Map(data.sdwanObservations.map(x => [x.id, x]));
    const targets = new Map(data.sdwanTargets.map(x => [x.id, x]));
    const runs = new Map(data.sdwanRuns.map(x => [x.id, x]));
    for (const x of data.sdwanBatches) check(scopeValid(data, x.scopeKind, x.scopeId) && /^\d{1,10}$/.test(x.siteId) && typeof x.coverage === 'object' && Number.isInteger(x.deviceCount), 'Invalid SD-WAN batch.');
    for (const x of data.sdwanCandidates) {
      const b = batches.get(x.batchId);
      check(b && x.scopeKind === b.scopeKind && x.scopeId === b.scopeId && specMap.has(x.key) && ['Pending', 'Applied', 'Dismissed'].includes(x.status) && x.classification === 'Observed' && typeof x.value === 'string' && x.value.length <= 500 && typeof x.source === 'string' && x.source.length <= 300, 'Invalid SD-WAN candidate.');
      if (x.status === 'Applied') { const o = observations.get(x.observationId); check(o && o.batchId === x.batchId && o.key === x.key && o.value === x.value && o.source === x.source, 'Applied SD-WAN observation is missing.'); }
      else check(x.observationId === null, 'Unapplied SD-WAN candidate has observation.');
    }
    for (const x of data.sdwanObservations) check(batches.has(x.batchId) && scopeValid(data, x.scopeKind, x.scopeId) && specMap.has(x.key) && x.classification === 'Observed' && typeof x.value === 'string' && x.value.length <= 500 && typeof x.source === 'string' && x.source.length <= 300, 'Invalid SD-WAN observation.');
    const active = new Set();
    for (const x of data.sdwanTargets) {
      check(scopeValid(data, x.scopeKind, x.scopeId) && ['Active', 'Superseded'].includes(x.status) && typeof x.source === 'string' && x.source.trim() && x.values && typeof x.values === 'object', 'Invalid SD-WAN target.');
      for (const spec of specs) check(typeof x.values[spec.key] === 'string' && x.values[spec.key].length <= 500, 'Invalid SD-WAN target value.');
      const key = `${x.scopeKind}:${x.scopeId}`;
      if (x.status === 'Active') { check(!active.has(key), 'Duplicate active SD-WAN target.'); active.add(key); }
    }
    for (const x of data.sdwanRuns) check(scopeValid(data, x.scopeKind, x.scopeId) && targets.get(x.targetId)?.scopeId === x.scopeId && targets.get(x.targetId)?.scopeKind === x.scopeKind && ['Failed', 'Not Ready', 'Needs Review', 'Ready for Review'].includes(x.state), 'Invalid SD-WAN run.');
    for (const x of data.sdwanResults) {
      const run = runs.get(x.runId), spec = specMap.get(x.key), observation = observations.get(x.observationId), target = targets.get(run?.targetId);
      check(run && spec && target && ['Pass', 'Fail', 'Warning', 'Unknown', 'Not Applicable'].includes(x.outcome), 'Invalid SD-WAN result.');
      check(x.expected === target.values[x.key] && x.observed === (observation?.value || '') && x.source === (observation?.source || '') && x.severity === spec.severity && x.mandatory === spec.mandatory, 'SD-WAN result snapshot is inconsistent.');
      if (observation) check(observation.scopeKind === run.scopeKind && observation.scopeId === run.scopeId && observation.key === x.key, 'SD-WAN result observation is outside scope.');
      check(x.outcome === C.assurance.compare(spec, x.expected, observation).outcome, 'SD-WAN result comparison is inconsistent.');
    }
    for (const run of data.sdwanRuns) {
      const results = data.sdwanResults.filter(x => x.runId === run.id);
      check(results.length === specs.length && new Set(results.map(x => x.key)).size === specs.length && run.state === stateOf(results), 'SD-WAN run results are incomplete or inconsistent.');
    }
    return data;
  }
  C.sdwan = Object.freeze({ FORMAT, MAX_SNAPSHOT_BYTES, specs, parseSnapshot, candidatesFrom, stageSnapshot, applyCandidate, dismissCandidate, activeTarget, saveTarget, latestRun, runValidation, validate });
})();
