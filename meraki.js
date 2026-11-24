/* Local snapshot adapter. Import is staged; only an explicit review adds Observed values. */
(() => {
  'use strict';
  const C = window.Cockpit;
  const FORMAT = 'network-refresh-meraki-snapshot';
  const MAX_SNAPSHOT_BYTES = 30 * 1024 * 1024;
  function check(condition, message) { if (!condition) throw new Error(message); }
  function text(value, label, max = 200, required = false) {
    check(typeof value === 'string' && value.length <= max && (!required || value.trim()), `Invalid ${label}.`);
  }
  function noCredentialFields(value, depth = 0) {
    check(depth < 12, 'Snapshot nesting exceeds the supported limit.');
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      check(!/(api[-_]?key|authorization|password|passphrase|psk|token|secret|credential|private[-_]?key)/i.test(key), 'Snapshot contains a credential field and was not imported.');
      noCredentialFields(item, depth + 1);
    }
  }
  function parseSnapshot(input) {
    check(typeof input === 'string' && input.length <= MAX_SNAPSHOT_BYTES, 'Meraki snapshot exceeds 30 MB.');
    let raw;
    try { raw = JSON.parse(input); } catch { throw new Error('Meraki snapshot is not valid JSON.'); }
    noCredentialFields(raw);
    check(raw && raw.format === FORMAT && raw.version === 1, 'Unsupported Meraki snapshot format.');
    text(raw.generatedAt, 'snapshot timestamp', 40, true);
    check(!Number.isNaN(Date.parse(raw.generatedAt)), 'Invalid snapshot timestamp.');
    text(raw.organizationId, 'organization ID', 80, true);
    check(raw.network && typeof raw.network === 'object', 'Missing Meraki network.');
    text(raw.network.id, 'network ID', 80, true); text(raw.network.name, 'network name', 160, true);
    check(!raw.network.organizationId || raw.network.organizationId === raw.organizationId, 'Network does not belong to the stated organization.');
    check(raw.coverage && typeof raw.coverage.statuses === 'boolean' && typeof raw.coverage.ssids === 'boolean', 'Invalid snapshot coverage.');
    for (const [name, max] of [['devices', 2000], ['statuses', 2000], ['ssids', 100]]) check(Array.isArray(raw[name]) && raw[name].length <= max, `Invalid ${name} list.`);
    const devices = raw.devices.map(item => {
      check(item && typeof item === 'object', 'Invalid Meraki device.');
      text(item.serial, 'device serial', 80, true); text(item.model, 'device model', 80, true);
      check(!item.networkId || item.networkId === raw.network.id, 'Device belongs to another network.');
      return { serial: item.serial, model: item.model, name: typeof item.name === 'string' ? item.name.slice(0, 160) : '' };
    });
    check(new Set(devices.map(item => item.serial)).size === devices.length, 'Duplicate Meraki serial.');
    const statuses = raw.statuses.map(item => {
      check(item && typeof item === 'object', 'Invalid Meraki status.');
      text(item.serial, 'status serial', 80, true); text(item.status, 'device status', 40, true);
      return { serial: item.serial, status: item.status };
    }).filter(item => devices.some(device => device.serial === item.serial));
    const ssids = raw.ssids.map(item => {
      check(item && typeof item === 'object', 'Invalid Meraki SSID.');
      check(typeof item.enabled === 'boolean', 'Invalid SSID enabled state.');
      if (!item.enabled && !item.name) return null;
      text(item.name, 'SSID name', 100, true);
      const vlanId = item.vlanId === null || item.vlanId === undefined ? null : String(item.vlanId);
      if (vlanId !== null) check(/^\d{1,4}$/.test(vlanId), 'Invalid SSID VLAN.');
      return { name: item.name, enabled: item.enabled, vlanId };
    }).filter(Boolean);
    return { format: FORMAT, version: 1, generatedAt: raw.generatedAt, organizationId: raw.organizationId,
      network: { id: raw.network.id, name: raw.network.name }, devices, statuses, ssids,
      coverage: { statuses: raw.coverage.statuses, ssids: raw.coverage.ssids } };
  }
  function candidatesFrom(snapshot) {
    const switches = snapshot.devices.filter(item => /^MS\d/i.test(item.model));
    const aps = snapshot.devices.filter(item => /^MR\d/i.test(item.model));
    const values = [];
    const add = (ruleId, value, endpoint) => {
      if (value.length <= 500) values.push({ ruleId, value, source: `Meraki snapshot ${snapshot.generatedAt.slice(0, 10)} · ${snapshot.network.id} · ${endpoint}`.slice(0, 200) });
    };
    add('rule-lan-sw-count', String(switches.length), 'network devices');
    if (switches.length && new Set(switches.map(item => item.model)).size === 1) add('rule-lan-sw-model', switches[0].model, 'network devices');
    add('rule-wifi-ap-count', String(aps.length), 'network devices');
    if (aps.length && new Set(aps.map(item => item.model)).size === 1) add('rule-wifi-ap-model', aps[0].model, 'network devices');
    if (snapshot.coverage.statuses && aps.length && aps.every(item => snapshot.statuses.some(status => status.serial === item.serial))) {
      const allOnline = aps.every(item => snapshot.statuses.find(status => status.serial === item.serial).status.toLowerCase() === 'online');
      add('rule-wifi-mgmt-state', allOnline ? 'Online' : 'Needs review', 'device statuses');
    }
    if (snapshot.coverage.ssids) {
      const enabled = snapshot.ssids.filter(item => item.enabled).sort((a, b) => a.name.localeCompare(b.name));
      add('rule-wifi-ssids', enabled.map(item => item.name).join(', ') || 'None', 'wireless SSIDs');
      if (enabled.length && enabled.every(item => item.vlanId !== null)) add('rule-wifi-vlan-map', enabled.map(item => `${item.name}:${item.vlanId}`).join(', '), 'wireless SSIDs');
    }
    return values;
  }
  function stageSnapshot(data, snapshot, branchId) {
    C.model.validateWorkspace(data);
    check(data.branches.some(item => item.id === branchId), 'Select a branch for the Meraki network.');
    const clean = parseSnapshot(JSON.stringify(snapshot));
    const next = C.model.copy(data);
    const batchId = C.model.newId();
    next.merakiBatches.push({ id: batchId, branchId, organizationId: clean.organizationId,
      networkId: clean.network.id, networkName: clean.network.name, generatedAt: clean.generatedAt,
      importedAt: new Date().toISOString(), source: 'Read-only Meraki Dashboard snapshot' });
    for (const candidate of candidatesFrom(clean)) {
      if (!next.assuranceRules.some(rule => rule.id === candidate.ruleId)) continue;
      next.merakiCandidates.push({ id: C.model.newId(), batchId, branchId, ruleId: candidate.ruleId,
        value: candidate.value, source: candidate.source, classification: 'Observed', status: 'Pending', appliedObservationId: null });
    }
    return { data: C.model.validateWorkspace(next), batchId, count: next.merakiCandidates.filter(item => item.batchId === batchId).length };
  }
  function applyCandidate(data, candidateId) {
    const candidate = data.merakiCandidates.find(item => item.id === candidateId);
    check(candidate?.status === 'Pending', 'Only a pending candidate can be applied.');
    const result = C.assurance.recordObservation(data, { branchId: candidate.branchId, ruleId: candidate.ruleId,
      perspective: 'Observed', value: candidate.value, source: candidate.source });
    const next = C.model.copy(result.data);
    const stored = next.merakiCandidates.find(item => item.id === candidateId);
    stored.status = 'Applied'; stored.appliedObservationId = result.id;
    return C.model.validateWorkspace(next);
  }
  function dismissCandidate(data, candidateId) {
    const next = C.model.copy(data);
    const item = next.merakiCandidates.find(candidate => candidate.id === candidateId);
    check(item?.status === 'Pending', 'Only a pending candidate can be dismissed.');
    item.status = 'Dismissed';
    return C.model.validateWorkspace(next);
  }
  function validate(data) {
    const branchIds = new Set(data.branches.map(item => item.id));
    const ruleIds = new Set(data.assuranceRules.map(item => item.id));
    const observationIds = new Set(data.assuranceObservations.map(item => item.id));
    const batches = new Map(data.merakiBatches.map(item => [item.id, item]));
    for (const batch of data.merakiBatches) {
      check(branchIds.has(batch.branchId), 'Meraki batch references a missing branch.');
      text(batch.organizationId, 'Meraki organization ID', 80, true); text(batch.networkId, 'Meraki network ID', 80, true);
      text(batch.networkName, 'Meraki network name', 160, true); text(batch.generatedAt, 'Meraki snapshot timestamp', 40, true);
      text(batch.importedAt, 'Meraki import timestamp', 40, true); text(batch.source, 'Meraki source', 200, true);
    }
    for (const candidate of data.merakiCandidates) {
      const batch = batches.get(candidate.batchId);
      check(batch && candidate.branchId === batch.branchId && ruleIds.has(candidate.ruleId), 'Meraki candidate association is invalid.');
      text(candidate.value, 'Meraki candidate value', 500, true); text(candidate.source, 'Meraki candidate source', 200, true);
      check(candidate.classification === 'Observed' && ['Pending', 'Applied', 'Dismissed'].includes(candidate.status), 'Invalid Meraki candidate state.');
      if (candidate.status === 'Applied') {
        const observation = data.assuranceObservations.find(item => item.id === candidate.appliedObservationId);
        check(observationIds.has(candidate.appliedObservationId) && observation.branchId === candidate.branchId && observation.ruleId === candidate.ruleId && observation.perspective === 'Observed' && observation.value === candidate.value && observation.source === candidate.source, 'Applied Meraki candidate is missing its sourced observation.');
      } else check(candidate.appliedObservationId === null, 'Unapplied Meraki candidate links an observation.');
    }
    return data;
  }
  C.meraki = Object.freeze({ FORMAT, MAX_SNAPSHOT_BYTES, parseSnapshot, candidatesFrom, stageSnapshot, applyCandidate, dismissCandidate, validate });
})();
