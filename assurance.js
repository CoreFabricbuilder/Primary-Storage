/* Deterministic local deployment assurance. No network or AI dependency. */
(() => {
  'use strict';
  const C = window.Cockpit;
  const categories = Object.freeze(['Design Compliance', 'Inventory Compliance', 'Configuration Compliance', 'Operational Health', 'Deployment Readiness', 'Architecture Drift']);
  const domains = Object.freeze(['Physical', 'SD-WAN', 'LAN', 'Wi-Fi', 'Routing', 'Management']);
  const severities = Object.freeze(['Critical', 'High', 'Medium', 'Low', 'Informational']);
  const outcomes = Object.freeze(['Pass', 'Warning', 'Fail', 'Unknown', 'Not Applicable']);
  const acceptanceStatuses = Object.freeze(['Ready', 'Ready with Exceptions', 'Not Ready', 'Accepted', 'Conditionally Accepted']);
  const specs = [
    ['LAN-SW-COUNT', 'Expected switch count', 'Inventory Compliance', 'LAN', 'Critical', true, 'number', 'lanDevices'],
    ['LAN-SW-MODEL', 'Expected switch model', 'Inventory Compliance', 'LAN', 'High', true, 'exact', null],
    ['LAN-UPLINK-MODE', 'Expected uplink mode', 'Configuration Compliance', 'LAN', 'High', true, 'exact', null],
    ['LAN-PORT-MODE', 'Expected access/trunk mode', 'Configuration Compliance', 'LAN', 'High', true, 'exact', 'lanHandoff'],
    ['LAN-NATIVE-VLAN', 'Expected native VLAN', 'Configuration Compliance', 'LAN', 'High', true, 'exact', null],
    ['LAN-ALLOWED-VLANS', 'Expected allowed VLANs', 'Configuration Compliance', 'LAN', 'Medium', true, 'set', 'vlans'],
    ['LAN-POE', 'PoE requirement', 'Operational Health', 'LAN', 'Medium', false, 'exact', null],
    ['LAN-MGMT-CONFIG', 'Expected management configuration', 'Configuration Compliance', 'Management', 'High', true, 'exact', null],
    ['WIFI-AP-COUNT', 'Expected AP quantity', 'Inventory Compliance', 'Wi-Fi', 'High', true, 'number', 'wifiApQuantity'],
    ['WIFI-AP-MODEL', 'Expected AP model', 'Inventory Compliance', 'Wi-Fi', 'Medium', true, 'exact', null],
    ['WIFI-SSIDS', 'Expected SSIDs', 'Design Compliance', 'Wi-Fi', 'High', true, 'set', 'wifiSsids'],
    ['WIFI-VLAN-MAP', 'Expected VLAN mapping', 'Configuration Compliance', 'Wi-Fi', 'High', true, 'exact', null],
    ['WIFI-RF-PROFILE', 'Expected RF profile', 'Configuration Compliance', 'Wi-Fi', 'Low', false, 'exact', null],
    ['WIFI-MGMT-STATE', 'Expected management state', 'Operational Health', 'Wi-Fi', 'Medium', true, 'exact', null],
    ['SDW-EDGE-COUNT', 'Expected WAN Edge quantity', 'Inventory Compliance', 'SD-WAN', 'Critical', true, 'number', 'wanEdgeQuantity'],
    ['SDW-TRANSPORTS', 'Expected transports', 'Design Compliance', 'SD-WAN', 'Critical', true, 'set', 'wanTransports'],
    ['SDW-VPNS', 'Expected SD-WAN VPN IDs', 'Configuration Compliance', 'SD-WAN', 'High', true, 'set', 'sdwanVpns'],
    ['SDW-COLOURS', 'Expected transport colours', 'Configuration Compliance', 'SD-WAN', 'Medium', true, 'set', null],
    ['SDW-ROUTING', 'Expected routing protocol', 'Design Compliance', 'Routing', 'High', true, 'exact', 'routing'],
    ['SDW-SERVICE-SIDE', 'Expected service-side connectivity', 'Operational Health', 'SD-WAN', 'High', true, 'exact', null],
    ['PHYS-POWER', 'Expected power feeds', 'Deployment Readiness', 'Physical', 'High', true, 'number', 'power'],
    ['MGMT-CONNECTIVITY', 'Expected management connectivity', 'Architecture Drift', 'Management', 'Medium', true, 'exact', 'management'],
  ];
  const seedRules = () => specs.map(([code, name, category, domain, severity, mandatory, comparator, patternKey]) => ({
    id: `rule-${code.toLowerCase()}`, code, name, category, domain, severity, mandatory, comparator, patternKey,
    description: `Compare sourced observation with the active design baseline for ${name.toLowerCase()}.`,
  }));
  const seedGates = () => [
    { id: 'gate-critical', code: 'GATE-CRITICAL', name: 'Critical mandatory rules', criterion: 'no-critical-mandatory-fail', description: 'Any Critical mandatory failure makes deployment acceptance FAILED.' },
    { id: 'gate-mandatory', code: 'GATE-MANDATORY', name: 'Mandatory rule resolution', criterion: 'mandatory-resolved', description: 'Mandatory failures require approved exceptions; unknown mandatory results remain pending.' },
  ];
  function check(condition, message) { if (!condition) throw new Error(message); }
  function text(value, label, max = 500, required = false) { check(typeof value === 'string' && value.length <= max && (!required || value.trim()), `Invalid ${label}.`); }
  function valueOrNull(value, label) { if (value !== null) text(value, label, 500); }
  function validate(data) {
    const ids = name => new Set(data[name].map(item => item.id));
    const branchIds = ids('branches'), ruleIds = ids('assuranceRules'), baselineIds = ids('assuranceBaselines');
    const observationIds = ids('assuranceObservations'), runIds = ids('assuranceRuns'), resultIds = ids('assuranceResults');
    const codes = new Set(), active = new Set();
    check(data.assuranceRules.some(rule => rule.mandatory === true && rule.severity === 'Critical'), 'A Critical mandatory rule is required.');
    for (const rule of data.assuranceRules) {
      text(rule.code, 'assurance rule code', 40, true); text(rule.name, 'assurance rule name', 160, true); text(rule.description, 'assurance rule description', 500);
      check(!codes.has(rule.code), 'Duplicate assurance rule code.'); codes.add(rule.code);
      check(categories.includes(rule.category) && domains.includes(rule.domain) && severities.includes(rule.severity), 'Invalid assurance rule classification.');
      check(typeof rule.mandatory === 'boolean' && ['number', 'set', 'exact'].includes(rule.comparator), 'Invalid assurance rule logic.');
      check(rule.patternKey === null || C.model.expectationKeys.includes(rule.patternKey), 'Invalid rule pattern target.');
    }
    for (const item of data.assuranceObservations) {
      check(branchIds.has(item.branchId) && ruleIds.has(item.ruleId), 'Observation refers to a missing branch or rule.');
      check(['Observed', 'As-Built'].includes(item.perspective), 'Invalid observation perspective.');
      check(item.classification === (item.perspective === 'As-Built' ? 'As-Built' : 'Observed'), 'Observation classification must match its perspective.');
      text(item.value, 'observed value', 500, true); text(item.source, 'observation source', 200, true); text(item.recordedAt, 'observation timestamp', 40, true);
    }
    for (const baseline of data.assuranceBaselines) {
      check(branchIds.has(baseline.branchId), 'Baseline refers to a missing branch.');
      check(['Draft', 'Active', 'Superseded'].includes(baseline.status), 'Invalid baseline status.');
      text(baseline.name, 'baseline name', 160, true); text(baseline.source, 'baseline source', 200, true); text(baseline.createdAt, 'baseline timestamp', 40, true);
      check(baseline.values && typeof baseline.values === 'object' && !Array.isArray(baseline.values), 'Invalid baseline values.');
      for (const [ruleId, value] of Object.entries(baseline.values)) { check(ruleIds.has(ruleId), 'Baseline references a missing rule.'); valueOrNull(value, 'baseline target'); }
      if (baseline.status === 'Active') { check(!active.has(baseline.branchId), 'More than one active baseline for a branch.'); active.add(baseline.branchId); }
    }
    for (const run of data.assuranceRuns) {
      const baseline = data.assuranceBaselines.find(item => item.id === run.baselineId);
      check(branchIds.has(run.branchId) && baselineIds.has(run.baselineId) && baseline.branchId === run.branchId, 'Validation run has an invalid baseline.');
      text(run.runAt, 'validation run timestamp', 40, true); text(run.source, 'validation run source', 200, true);
    }
    const resultKeys = new Set();
    for (const result of data.assuranceResults) {
      const run = data.assuranceRuns.find(item => item.id === result.runId);
      const rule = data.assuranceRules.find(item => item.id === result.ruleId);
      check(runIds.has(result.runId) && ruleIds.has(result.ruleId) && run.branchId === result.branchId, 'Validation result has invalid references.');
      check(outcomes.includes(result.outcome) && severities.includes(result.severity) && typeof result.mandatory === 'boolean', 'Invalid validation result outcome.');
      check(result.severity === rule.severity && result.mandatory === rule.mandatory, 'Validation result rule snapshot is inconsistent.');
      valueOrNull(result.expected, 'expected value'); valueOrNull(result.observed, 'observed value'); text(result.note, 'validation result note', 500);
      if (result.observed !== null) {
        const observation = data.assuranceObservations.find(item => item.id === result.observationId);
        check(observationIds.has(result.observationId) && observation.branchId === result.branchId && observation.ruleId === result.ruleId && observation.perspective === 'Observed', 'Validation result observation is invalid.');
        text(result.observedSource, 'observed source', 200, true);
        check(result.observed === observation.value && result.observedSource === observation.source, 'Validation result provenance snapshot is inconsistent.');
      } else check(result.observationId === null && result.observedSource === null, 'Missing observation provenance.');
      const baseline = data.assuranceBaselines.find(item => item.id === run.baselineId);
      check(result.expected === (baseline.values[rule.id] ?? null), 'Validation result baseline snapshot is inconsistent.');
      const recomputed = compare(rule, result.expected, result.observed === null ? null : { value: result.observed });
      check(result.outcome === recomputed.outcome && result.note === recomputed.note, 'Validation result does not match deterministic rule logic.');
      const key = `${result.runId}:${result.ruleId}`; check(!resultKeys.has(key), 'Duplicate validation result for a rule.'); resultKeys.add(key);
    }
    for (const run of data.assuranceRuns) check(data.assuranceRules.every(rule => resultKeys.has(`${run.id}:${rule.id}`)), 'Validation run is missing rule results.');
    const exceptionResults = new Set();
    for (const exception of data.assuranceExceptions) {
      const result = data.assuranceResults.find(item => item.id === exception.resultId);
      check(resultIds.has(exception.resultId) && runIds.has(exception.runId) && result.runId === exception.runId && result.branchId === exception.branchId, 'Exception has invalid references.');
      check(['Fail', 'Warning'].includes(result.outcome), 'Exception must reference a failing or warning result.');
      check(['Open', 'Approved', 'Rejected', 'Closed'].includes(exception.status), 'Invalid exception status.');
      text(exception.reason, 'exception reason', 1000, true); text(exception.approvedBy, 'exception approver', 160); text(exception.decidedAt, 'exception decision date', 40);
      if (exception.status === 'Approved') text(exception.approvedBy, 'exception approver', 160, true);
      check(!exceptionResults.has(exception.resultId), 'Duplicate exception for one result.'); exceptionResults.add(exception.resultId);
    }
    const gateCodes = new Set();
    for (const gate of data.acceptanceGates) {
      text(gate.code, 'gate code', 40, true); text(gate.name, 'gate name', 160, true); text(gate.description, 'gate description', 500);
      check(['no-critical-mandatory-fail', 'mandatory-resolved'].includes(gate.criterion), 'Invalid acceptance gate criterion.');
      check(!gateCodes.has(gate.code), 'Duplicate acceptance gate.'); gateCodes.add(gate.code);
    }
    check(data.acceptanceGates.some(item => item.criterion === 'no-critical-mandatory-fail') && data.acceptanceGates.some(item => item.criterion === 'mandatory-resolved'), 'Mandatory acceptance gates are missing.');
    const acceptedRuns = new Set();
    for (const record of data.acceptanceRecords) {
      const run = data.assuranceRuns.find(item => item.id === record.runId);
      check(runIds.has(record.runId) && run.branchId === record.branchId, 'Acceptance record has invalid run.');
      check(['Accepted', 'Conditionally Accepted'].includes(record.status), 'Invalid acceptance status.');
      text(record.architect, 'acceptance architect', 160, true); text(record.signedAt, 'acceptance timestamp', 40, true); text(record.notes, 'acceptance notes', 1000);
      const withoutRecord = { ...data, acceptanceRecords: data.acceptanceRecords.filter(item => item.runId !== record.runId) };
      const eligible = evaluateAcceptance(withoutRecord, record.runId).status;
      check((eligible === 'Ready' && record.status === 'Accepted') || (eligible === 'Ready with Exceptions' && record.status === 'Conditionally Accepted'), 'Acceptance record conflicts with gate result.');
      check(!acceptedRuns.has(record.runId), 'Duplicate acceptance for one run.'); acceptedRuns.add(record.runId);
    }
    return data;
  }
  function latestRun(data, branchId) { return [...data.assuranceRuns].reverse().find(item => item.branchId === branchId) || null; }
  function latestObservation(data, branchId, ruleId, perspective = 'Observed') {
    return [...data.assuranceObservations].reverse().find(item => item.branchId === branchId && item.ruleId === ruleId && item.perspective === perspective) || null;
  }
  function activeBaseline(data, branchId) { return data.assuranceBaselines.find(item => item.branchId === branchId && item.status === 'Active') || null; }
  function baselineDraft(data, branchId, source) {
    const pattern = C.model.branchTarget(data, branchId);
    check(pattern, 'Assign a branch pattern before creating a baseline.');
    const values = Object.fromEntries(data.assuranceRules.map(rule => [rule.id, rule.patternKey ? pattern.expectations[rule.patternKey] || null : null]));
    return { id: C.model.newId(), branchId, name: `${pattern.code} design baseline`, source: source || `Branch pattern ${pattern.code}`, status: 'Draft', createdAt: new Date().toISOString(), values };
  }
  function createBaseline(data, branchId, source) {
    const next = C.model.copy(data);
    const baseline = baselineDraft(next, branchId, source);
    next.assuranceBaselines.push(baseline);
    return { data: C.model.validateWorkspace(next), id: baseline.id };
  }
  function setBaselineTarget(data, baselineId, ruleId, value) {
    const next = C.model.copy(data);
    const baseline = next.assuranceBaselines.find(item => item.id === baselineId);
    check(baseline?.status === 'Draft', 'Only a draft baseline can be edited.');
    check(next.assuranceRules.some(item => item.id === ruleId), 'Rule not found.');
    baseline.values[ruleId] = value?.trim() || null;
    return C.model.validateWorkspace(next);
  }
  function activateBaseline(data, baselineId) {
    const next = C.model.copy(data);
    const selected = next.assuranceBaselines.find(item => item.id === baselineId);
    check(selected?.status === 'Draft', 'Only a draft baseline can be activated.');
    next.assuranceBaselines.filter(item => item.branchId === selected.branchId && item.status === 'Active').forEach(item => { item.status = 'Superseded'; });
    selected.status = 'Active';
    return C.model.validateWorkspace(next);
  }
  function recordObservation(data, fields) {
    const next = C.model.copy(data);
    const item = { id: C.model.newId(), branchId: fields.branchId, ruleId: fields.ruleId,
      perspective: fields.perspective, classification: fields.perspective === 'As-Built' ? 'As-Built' : 'Observed',
      value: fields.value.trim(), source: fields.source.trim(), recordedAt: new Date().toISOString() };
    next.assuranceObservations.push(item);
    return { data: C.model.validateWorkspace(next), id: item.id };
  }
  function compare(rule, expected, observation) {
    const observed = observation?.value || null;
    if (expected?.trim().toUpperCase() === 'N/A') return { outcome: 'Not Applicable', note: 'Design baseline marks this rule not applicable.' };
    if (!expected || !observed) return { outcome: 'Unknown', note: !expected ? 'No target in active baseline.' : 'No sourced observation recorded.' };
    if (rule.comparator === 'number') {
      if (!/^\d+$/.test(expected.trim()) || !/^\d+$/.test(observed.trim())) return { outcome: 'Unknown', note: 'Quantity must be a non-negative integer.' };
      return Number(expected) === Number(observed) ? { outcome: 'Pass', note: 'Observed quantity matches baseline.' } : { outcome: 'Fail', note: 'Observed quantity differs from baseline.' };
    }
    if (rule.comparator === 'set') {
      const split = value => value.split(/[,;]/).map(item => item.trim().toLowerCase()).filter(Boolean);
      const target = new Set(split(expected)), actual = new Set(split(observed));
      if ([...target].some(item => !actual.has(item))) return { outcome: 'Fail', note: 'One or more expected values are missing.' };
      if ([...actual].some(item => !target.has(item))) return { outcome: 'Warning', note: 'Observed values include items outside the baseline.' };
      return { outcome: 'Pass', note: 'Observed set matches baseline.' };
    }
    return expected.trim().toLowerCase() === observed.trim().toLowerCase() ? { outcome: 'Pass', note: 'Observed value matches baseline.' } : { outcome: 'Fail', note: 'Observed value differs from baseline.' };
  }
  function runValidation(data, branchId) {
    const next = C.model.copy(data);
    const baseline = activeBaseline(next, branchId);
    check(baseline, 'Activate a design baseline before running validation.');
    const run = { id: C.model.newId(), branchId, baselineId: baseline.id, runAt: new Date().toISOString(), source: 'Local deterministic comparison' };
    next.assuranceRuns.push(run);
    for (const rule of next.assuranceRules) {
      const observation = latestObservation(next, branchId, rule.id);
      const expected = baseline.values[rule.id] ?? null;
      const comparison = compare(rule, expected, observation);
      next.assuranceResults.push({ id: C.model.newId(), runId: run.id, branchId, ruleId: rule.id,
        outcome: comparison.outcome, severity: rule.severity, mandatory: rule.mandatory,
        expected, observed: observation?.value || null, observationId: observation?.id || null,
        observedSource: observation?.source || null, note: comparison.note });
    }
    return { data: C.model.validateWorkspace(next), id: run.id };
  }
  function createException(data, resultId, reason) {
    const next = C.model.copy(data);
    const result = next.assuranceResults.find(item => item.id === resultId);
    check(result && ['Fail', 'Warning'].includes(result.outcome), 'Select a failing or warning result.');
    check(!next.assuranceExceptions.some(item => item.resultId === resultId), 'This result already has an exception.');
    const item = { id: C.model.newId(), branchId: result.branchId, runId: result.runId, resultId,
      reason: reason.trim(), status: 'Open', approvedBy: '', decidedAt: '' };
    next.assuranceExceptions.push(item);
    return { data: C.model.validateWorkspace(next), id: item.id };
  }
  function decideException(data, id, status, architect) {
    const next = C.model.copy(data);
    const item = next.assuranceExceptions.find(entry => entry.id === id);
    check(item && ['Approved', 'Rejected', 'Closed'].includes(status), 'Invalid exception decision.');
    item.status = status; item.approvedBy = architect.trim(); item.decidedAt = new Date().toISOString();
    return C.model.validateWorkspace(next);
  }
  function evaluateAcceptance(data, runId) {
    const run = data.assuranceRuns.find(item => item.id === runId);
    if (!run) return { gateOutcome: 'PENDING', status: 'Not Ready', gates: [], results: [] };
    const results = data.assuranceResults.filter(item => item.runId === runId);
    const exceptionFor = result => data.assuranceExceptions.find(item => item.resultId === result.id && item.status === 'Approved');
    const gates = data.acceptanceGates.map(gate => {
      let outcome = 'Pass';
      if (gate.criterion === 'no-critical-mandatory-fail') {
        if (results.some(item => item.mandatory && item.severity === 'Critical' && item.outcome === 'Fail')) outcome = 'Fail';
        else if (results.some(item => item.mandatory && item.severity === 'Critical' && item.outcome === 'Unknown')) outcome = 'Unknown';
      } else {
        if (results.some(item => item.mandatory && item.outcome === 'Fail' && !exceptionFor(item))) outcome = 'Fail';
        else if (results.some(item => item.mandatory && item.outcome === 'Unknown')) outcome = 'Unknown';
      }
      return { ...gate, outcome };
    });
    const gateOutcome = gates.some(item => item.outcome === 'Fail') ? 'FAILED' : gates.some(item => item.outcome === 'Unknown') ? 'PENDING' : 'PASSED';
    const hasExceptions = results.some(item => ['Warning', 'Fail'].includes(item.outcome)) || data.assuranceExceptions.some(item => item.runId === runId && item.status === 'Approved');
    let status = gateOutcome !== 'PASSED' ? 'Not Ready' : hasExceptions ? 'Ready with Exceptions' : 'Ready';
    const record = data.acceptanceRecords.find(item => item.runId === runId);
    if (record && status === 'Ready' && record.status === 'Accepted') status = 'Accepted';
    if (record && status === 'Ready with Exceptions' && record.status === 'Conditionally Accepted') status = 'Conditionally Accepted';
    return { gateOutcome, status, gates, results, record };
  }
  function recordAcceptance(data, runId, architect, notes) {
    const evaluation = evaluateAcceptance(data, runId);
    check(['Ready', 'Ready with Exceptions'].includes(evaluation.status), 'Acceptance gates are not ready.');
    const next = C.model.copy(data);
    next.acceptanceRecords.push({ id: C.model.newId(), runId, branchId: next.assuranceRuns.find(item => item.id === runId).branchId,
      status: evaluation.status === 'Ready' ? 'Accepted' : 'Conditionally Accepted', architect: architect.trim(),
      signedAt: new Date().toISOString(), notes: notes.trim() });
    return C.model.validateWorkspace(next);
  }
  C.assurance = Object.freeze({ categories, domains, severities, outcomes, acceptanceStatuses, seedRules, seedGates, validate,
    latestRun, latestObservation, activeBaseline, baselineDraft, createBaseline, setBaselineTarget, activateBaseline,
    recordObservation, compare, runValidation, createException, decideException, evaluateAcceptance, recordAcceptance });
})();
