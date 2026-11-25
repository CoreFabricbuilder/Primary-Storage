/* Architecture paths, explicit segmentation provenance and immutable deployment drift. */
(() => {
  'use strict';
  const C = window.Cockpit;
  const segmentCollections = Object.freeze({ VRF: 'vrfs', 'SD-WAN VPN': 'sdwanVpns', VLAN: 'vlans', Subnet: 'subnets' });
  const targetCollections = Object.freeze({ Site: 'sites', Device: 'devices', Interface: 'interfaces', 'Routing Adjacency': 'routingAdjacencies', Service: 'services', Component: 'components', Decision: 'decisions' });
  const driftClasses = Object.freeze(['No Change', 'Expected Change', 'Approved Change', 'Unexplained Drift']);
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const text = (value, max, label) => check(typeof value === 'string' && value.length <= max, `Invalid ${label}.`);
  const date = value => typeof value === 'string' && !Number.isNaN(Date.parse(value));
  const ref = (data, collection, id) => data[collection]?.some(item => item.id === id);
  const segmentId = (kind, id) => `${kind}:${id}`;
  function createFlow(data, fields) {
    check(ref(data, 'components', fields.fromId) && ref(data, 'components', fields.toId) && fields.fromId !== fields.toId, 'Choose distinct architecture components.');
    check(['All', ...C.model.states].includes(fields.state), 'Invalid flow time state.');
    check(['Target', 'Inferred', 'Architect Confirmed'].includes(fields.classification), 'Select a flow classification.');
    text(fields.name, 160, 'flow name'); text(fields.source, 300, 'flow source');
    check(fields.name.trim() && fields.source.trim(), 'A flow needs a name and source.');
    const next = C.model.copy(data), id = C.model.newId();
    next.serviceFlows.push({ id, name: fields.name.trim(), fromId: fields.fromId, toId: fields.toId, state: fields.state, classification: fields.classification, source: fields.source.trim() });
    return { data: C.model.validateWorkspace(next), id };
  }
  function flowPath(data, flow, state) {
    check(C.model.states.includes(state), 'Invalid architecture state.');
    if (!flow || !['All', state].includes(flow.state)) return null;
    const nodes = C.model.visibleComponents(data, state);
    const nodeIds = new Set(nodes.map(x => x.id));
    if (!nodeIds.has(flow.fromId) || !nodeIds.has(flow.toId)) return null;
    const links = C.model.visibleLinks(data, state, nodes);
    const neighbours = new Map(nodes.map(x => [x.id, []]));
    for (const link of links) {
      neighbours.get(link.fromId).push({ id: link.toId, linkId: link.id });
      neighbours.get(link.toId).push({ id: link.fromId, linkId: link.id });
    }
    const queue = [flow.fromId], seen = new Map([[flow.fromId, null]]);
    for (let i = 0; i < queue.length && !seen.has(flow.toId); i++) {
      for (const next of neighbours.get(queue[i])) {
        if (!seen.has(next.id)) { seen.set(next.id, { fromId: queue[i], linkId: next.linkId }); queue.push(next.id); }
      }
    }
    if (!seen.has(flow.toId)) return null;
    const path = [], linkIds = [];
    for (let id = flow.toId; id !== flow.fromId; id = seen.get(id).fromId) { path.push(id); linkIds.push(seen.get(id).linkId); }
    path.push(flow.fromId); path.reverse(); linkIds.reverse();
    const pathLinks = linkIds.map(id => links.find(x => x.id === id));
    return { nodeIds: path, linkIds, classification: flow.classification === 'Inferred' || pathLinks.some(x => x.classification === 'Inferred') ? 'Inferred' : flow.classification,
      source: flow.source, links: pathLinks };
  }
  function addSegmentationLink(data, fields) {
    const collection = segmentCollections[fields.segmentKind], targetCollection = targetCollections[fields.targetKind];
    check(collection && ref(data, collection, fields.segmentId) && targetCollection && ref(data, targetCollection, fields.targetId), 'Choose a valid segment and related object.');
    check(C.model.classifications.includes(fields.classification) && fields.classification !== 'Unknown', 'Classify the segmentation link.');
    text(fields.source, 300, 'segment source'); check(fields.source.trim(), 'A segmentation link needs a source.');
    check(!data.segmentationLinks.some(x => x.segmentKind === fields.segmentKind && x.segmentId === fields.segmentId && x.targetKind === fields.targetKind && x.targetId === fields.targetId), 'Segmentation link already exists.');
    const next = C.model.copy(data), id = C.model.newId();
    next.segmentationLinks.push({ id, segmentKind: fields.segmentKind, segmentId: fields.segmentId, targetKind: fields.targetKind, targetId: fields.targetId, classification: fields.classification, source: fields.source.trim() });
    return { data: C.model.validateWorkspace(next), id };
  }
  function segmentationMatches(data, query, kind = 'All') {
    const term = String(query || '').trim().toLowerCase();
    return Object.entries(segmentCollections).filter(([name]) => kind === 'All' || kind === name).flatMap(([name, collection]) => data[collection].filter(item => `${item.name || ''} ${item.number ?? ''} ${item.cidr || ''}`.toLowerCase().includes(term)).map(item => ({ kind: name, item })));
  }
  function segmentContext(data, kind, id) {
    const collection = segmentCollections[kind], item = data[collection]?.find(x => x.id === id);
    check(item, 'Segment not found.');
    const links = data.segmentationLinks.filter(x => x.segmentKind === kind && x.segmentId === id);
    const direct = targetKind => new Set(links.filter(x => x.targetKind === targetKind).map(x => x.targetId));
    const siteIds = new Set(item.siteId ? [item.siteId] : [...direct('Site')]);
    for (const device of data.devices) if (direct('Device').has(device.id)) siteIds.add(device.siteId);
    for (const iface of data.interfaces) if (direct('Interface').has(iface.id)) siteIds.add(data.devices.find(x => x.id === iface.deviceId)?.siteId);
    for (const component of data.components) if (direct('Component').has(component.id) && component.siteId) siteIds.add(component.siteId);
    const devices = data.devices.filter(x => siteIds.has(x.siteId) || direct('Device').has(x.id));
    const deviceIds = new Set(devices.map(x => x.id));
    const interfaces = data.interfaces.filter(x => deviceIds.has(x.deviceId) || direct('Interface').has(x.id));
    const routing = data.routingAdjacencies.filter(x => deviceIds.has(x.fromDeviceId) || deviceIds.has(x.toDeviceId) || direct('Routing Adjacency').has(x.id));
    const components = data.components.filter(x => siteIds.has(x.siteId) || direct('Component').has(x.id));
    const componentIds = new Set(components.map(x => x.id));
    return { item, links, sites: data.sites.filter(x => siteIds.has(x.id)), branches: data.branches.filter(x => siteIds.has(x.siteId)), devices, interfaces, routing,
      services: data.services.filter(x => direct('Service').has(x.id)), decisions: data.decisions.filter(x => direct('Decision').has(x.id) || x.affectedComponentIds.some(cid => componentIds.has(cid))),
      direct };
  }
  function impact(data, componentId, state) {
    const component = data.components.find(x => x.id === componentId);
    check(component && C.model.states.includes(state), 'Select an architecture component and state.');
    const visible = new Set(C.model.visibleComponents(data, state).map(x => x.id));
    const deps = data.dependencies.filter(x => (x.state === 'All' || x.state === state) && visible.has(x.upstreamId) && visible.has(x.downstreamId));
    const downstreamIds = new Set(), queue = [componentId];
    for (let i = 0; i < queue.length; i++) for (const dep of deps.filter(x => x.upstreamId === queue[i])) {
      if (dep.downstreamId !== componentId && !downstreamIds.has(dep.downstreamId)) { downstreamIds.add(dep.downstreamId); queue.push(dep.downstreamId); }
    }
    const affectedIds = new Set([componentId, ...downstreamIds]);
    const affected = data.components.filter(x => affectedIds.has(x.id));
    const siteIds = new Set(affected.map(x => x.siteId).filter(Boolean));
    const deviceIds = new Set(data.devices.filter(x => siteIds.has(x.siteId)).map(x => x.id));
    const directDeps = deps.filter(x => x.upstreamId === componentId || x.downstreamId === componentId);
    const securityDomain = new Set(data.domains.filter(x => x.name === 'Security').map(x => x.id));
    const security = directDeps.filter(x => [x.upstreamId, x.downstreamId].some(id => securityDomain.has(data.components.find(c => c.id === id)?.domainId)));
    const adjacentSecurity = data.topologyLinks.filter(x => x.state === state && (x.fromId === componentId || x.toId === componentId) && [x.fromId, x.toId].some(id => securityDomain.has(data.components.find(c => c.id === id)?.domainId)));
    const segmentLinks = data.segmentationLinks.filter(x => (x.targetKind === 'Component' && affectedIds.has(x.targetId)) || (x.targetKind === 'Site' && siteIds.has(x.targetId)));
    const segments = [...data.vlans.map(item => ({ ...item, kind: 'VLAN' })), ...data.subnets.map(item => ({ ...item, kind: 'Subnet' }))].filter(x => siteIds.has(x.siteId));
    const factIds = new Set(data.facts.filter(x => x.subjectKind === 'component' && affectedIds.has(x.subjectId)).map(x => x.id));
    return { component, affected, dependencies: directDeps, sites: data.sites.filter(x => siteIds.has(x.id)),
      services: data.services.filter(x => affected.some(c => c.domainId === x.domainId)),
      routing: data.routingAdjacencies.filter(x => deviceIds.has(x.fromDeviceId) || deviceIds.has(x.toDeviceId)),
      segmentLinks, segments, security, adjacentSecurity,
      decisions: data.decisions.filter(x => x.affectedComponentIds.some(id => affectedIds.has(id)) || directDeps.some(d => d.decisionId === x.id)),
      evidence: data.evidence.filter(x => factIds.has(x.factId)),
      branchEvidence: data.branchEvidence.filter(x => data.branches.some(b => b.id === x.branchId && siteIds.has(b.siteId))),
      lld: data.lldReadiness.filter(x => siteIds.has(x.siteId) && x.state === state && x.status !== 'Confirmed') };
  }
  function createBaseline(data, acceptanceId, architect, note) {
    const acceptance = data.acceptanceRecords.find(x => x.id === acceptanceId);
    check(acceptance && ['Accepted', 'Conditionally Accepted'].includes(acceptance.status) && C.assurance.evaluateAcceptance(data, acceptance.runId).gateOutcome === 'PASSED', 'Select an accepted deployment with passing gates.');
    check(!data.deploymentBaselines.some(x => x.acceptanceId === acceptanceId), 'This acceptance already has an As-Built baseline.');
    text(architect, 160, 'architect'); text(note, 1000, 'baseline note'); check(architect.trim() && note.trim(), 'Architect and acceptance rationale are required.');
    const run = data.assuranceRuns.find(x => x.id === acceptance.runId);
    const items = data.assuranceResults.filter(x => x.runId === run.id && x.observationId && x.observed).map(x => ({ kind: 'Assurance', key: x.ruleId, value: x.observed, source: data.assuranceObservations.find(o => o.id === x.observationId)?.source || '', observationId: x.observationId }));
    const latestSdwan = [...data.sdwanRuns].reverse().find(x => x.scopeKind === 'Branch' && x.scopeId === acceptance.branchId && Date.parse(x.runAt) <= Date.parse(acceptance.signedAt));
    if (latestSdwan) {
      check(latestSdwan.state === 'Ready for Review', 'SD-WAN validation at acceptance must be ready for review.');
      items.push(...data.sdwanResults.filter(x => x.runId === latestSdwan.id && x.observationId && x.observed).map(x => ({ kind: 'SD-WAN', key: x.key, value: x.observed, source: x.source, observationId: x.observationId })));
    }
    check(items.length, 'Acceptance has no sourced observations to baseline.');
    const next = C.model.copy(data), id = C.model.newId();
    next.deploymentBaselines.push({ id, branchId: acceptance.branchId, acceptanceId, assuranceRunId: run.id, sdwanRunId: latestSdwan?.id || null,
      architect: architect.trim(), note: note.trim(), createdAt: new Date().toISOString(), items });
    return { data: C.model.validateWorkspace(next), id };
  }
  function baselineItemId(item) { return `${item.kind}:${item.key}`; }
  function driftRows(data, baselineId) {
    const baseline = data.deploymentBaselines.find(x => x.id === baselineId);
    check(baseline, 'As-Built baseline not found.');
    const acceptanceTime = data.acceptanceRecords.find(x => x.id === baseline.acceptanceId).signedAt;
    return baseline.items.map(item => {
      const list = item.kind === 'Assurance' ? data.assuranceObservations.filter(x => x.branchId === baseline.branchId && x.ruleId === item.key && x.perspective === 'Observed') : data.sdwanObservations.filter(x => x.scopeKind === 'Branch' && x.scopeId === baseline.branchId && x.key === item.key);
      const observation = list.filter(x => Date.parse(x.recordedAt) > Date.parse(acceptanceTime)).sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt)).at(-1) || null;
      if (!observation) return { item, observation: null, classification: null, review: null };
      const rule = item.kind === 'Assurance' ? data.assuranceRules.find(x => x.id === item.key) : C.sdwan.specs.find(x => x.key === item.key);
      const same = C.assurance.compare(rule, item.value, observation).outcome === 'Pass';
      const review = [...data.driftReviews].reverse().find(x => x.baselineId === baselineId && x.itemKey === baselineItemId(item) && x.observationId === observation.id) || null;
      return { item, observation, classification: same ? 'No Change' : review?.classification || 'Unexplained Drift', review };
    });
  }
  function reviewDrift(data, fields) {
    check(['Expected Change', 'Approved Change'].includes(fields.classification), 'Select a change classification.');
    const row = driftRows(data, fields.baselineId).find(x => baselineItemId(x.item) === fields.itemKey && x.observation?.id === fields.observationId);
    check(row && row.classification !== 'No Change', 'Select a changed current observation.');
    const decision = data.decisions.find(x => x.id === fields.decisionId);
    check(decision && (fields.classification !== 'Approved Change' || decision.status === 'Approved'), 'Approved Change requires an approved architecture decision.');
    text(fields.architect, 160, 'architect'); text(fields.rationale, 1000, 'drift rationale');
    check(fields.architect.trim() && fields.rationale.trim(), 'Architect and rationale are required.');
    const next = C.model.copy(data);
    next.driftReviews.push({ id: C.model.newId(), baselineId: fields.baselineId, itemKey: fields.itemKey, observationId: fields.observationId,
      classification: fields.classification, decisionId: decision.id, decisionStatus: decision.status, architect: fields.architect.trim(), rationale: fields.rationale.trim(), reviewedAt: new Date().toISOString() });
    return C.model.validateWorkspace(next);
  }
  function validate(data) {
    for (const flow of data.serviceFlows) {
      check(ref(data, 'components', flow.fromId) && ref(data, 'components', flow.toId) && flow.fromId !== flow.toId && ['All', ...C.model.states].includes(flow.state), 'Invalid service flow endpoints.');
      check(['Target', 'Inferred', 'Architect Confirmed'].includes(flow.classification), 'Invalid service flow classification.');
      text(flow.name, 160, 'flow name'); text(flow.source, 300, 'flow source'); check(flow.name.trim() && flow.source.trim(), 'Flow source is required.');
    }
    const linkKeys = new Set();
    for (const link of data.segmentationLinks) {
      check(segmentCollections[link.segmentKind] && ref(data, segmentCollections[link.segmentKind], link.segmentId) && targetCollections[link.targetKind] && ref(data, targetCollections[link.targetKind], link.targetId), 'Invalid segmentation association.');
      check(C.model.classifications.includes(link.classification) && link.classification !== 'Unknown', 'Invalid segmentation classification.');
      text(link.source, 300, 'segmentation source'); check(link.source.trim(), 'Segmentation source is required.');
      const key = `${segmentId(link.segmentKind, link.segmentId)}:${link.targetKind}:${link.targetId}`;
      check(!linkKeys.has(key), 'Duplicate segmentation association.'); linkKeys.add(key);
    }
    for (const b of data.deploymentBaselines) {
      const a = data.acceptanceRecords.find(x => x.id === b.acceptanceId);
      check(a && a.branchId === b.branchId && a.runId === b.assuranceRunId && date(a.signedAt) && date(b.createdAt) && Date.parse(b.createdAt) >= Date.parse(a.signedAt), 'Invalid As-Built baseline acceptance.');
      text(b.architect, 160, 'baseline architect'); text(b.note, 1000, 'baseline note'); check(b.architect.trim() && b.note.trim(), 'Baseline architect and rationale required.');
      if (b.sdwanRunId) check(data.sdwanRuns.some(x => x.id === b.sdwanRunId && x.scopeKind === 'Branch' && x.scopeId === b.branchId && Date.parse(x.runAt) <= Date.parse(a.signedAt)), 'Invalid SD-WAN baseline run.');
      check(Array.isArray(b.items) && b.items.length > 0 && b.items.length <= 1000, 'Invalid As-Built baseline items.');
      const keys = new Set();
      for (const item of b.items) {
        check(['Assurance', 'SD-WAN'].includes(item.kind) && typeof item.key === 'string' && typeof item.value === 'string' && item.value && typeof item.source === 'string' && item.source, 'Invalid As-Built baseline item.');
        check(!keys.has(baselineItemId(item)), 'Duplicate As-Built baseline item.'); keys.add(baselineItemId(item));
        const result = item.kind === 'Assurance' ? data.assuranceResults.find(x => x.runId === b.assuranceRunId && x.ruleId === item.key && x.observationId === item.observationId && x.observed === item.value) : data.sdwanResults.find(x => x.runId === b.sdwanRunId && x.key === item.key && x.observationId === item.observationId && x.observed === item.value);
        check(result && (item.kind === 'SD-WAN' ? result.source : data.assuranceObservations.find(x => x.id === item.observationId)?.source) === item.source, 'Baseline item does not match accepted observation.');
      }
    }
    for (const r of data.driftReviews) {
      const b = data.deploymentBaselines.find(x => x.id === r.baselineId), item = b?.items.find(x => baselineItemId(x) === r.itemKey), decision = data.decisions.find(x => x.id === r.decisionId);
      check(b && item && ['Expected Change', 'Approved Change'].includes(r.classification) && decision && ['Proposed', 'Approved', 'Superseded'].includes(r.decisionStatus), 'Invalid drift review.');
      check(r.classification !== 'Approved Change' || r.decisionStatus === 'Approved', 'Approved drift lacks approved decision snapshot.');
      const observation = item.kind === 'Assurance' ? data.assuranceObservations.find(x => x.id === r.observationId && x.branchId === b.branchId && x.ruleId === item.key && x.perspective === 'Observed') : data.sdwanObservations.find(x => x.id === r.observationId && x.scopeKind === 'Branch' && x.scopeId === b.branchId && x.key === item.key);
      const acceptedAt = data.acceptanceRecords.find(x => x.id === b.acceptanceId)?.signedAt;
      check(observation && Date.parse(observation.recordedAt) > Date.parse(acceptedAt) && date(r.reviewedAt), 'Drift review observation is invalid.');
      const rule = item.kind === 'Assurance' ? data.assuranceRules.find(x => x.id === item.key) : C.sdwan.specs.find(x => x.key === item.key);
      check(C.assurance.compare(rule, item.value, observation).outcome !== 'Pass', 'No Change does not need a drift review.');
      text(r.architect, 160, 'drift architect'); text(r.rationale, 1000, 'drift rationale'); check(r.architect.trim() && r.rationale.trim(), 'Drift review needs rationale.');
    }
    return data;
  }
  C.intelligence = Object.freeze({ segmentCollections, targetCollections, driftClasses, createFlow, flowPath, addSegmentationLink, segmentationMatches, segmentContext, impact, createBaseline, driftRows, reviewDrift, validate, baselineItemId });
})();
