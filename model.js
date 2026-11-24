/* Pure architecture model. Classic script so file:// works without a build step. */
(() => {
  'use strict';
  const C = window.Cockpit = window.Cockpit || {};
  const states = Object.freeze(['Current', 'Transition', 'Future']);
  const perspectives = Object.freeze(['Design Intent', 'Observed', 'Validated', 'As-Built']);
  const classifications = Object.freeze(['Unknown', 'Observed', 'Client Confirmed', 'Architect Confirmed', 'Inferred', 'Target', 'As-Built']);
  const readinessCategories = Object.freeze(['Physical', 'IP Addressing', 'VLAN', 'VRF', 'SD-WAN VPN', 'Routing', 'Security', 'Management', 'Patching', 'Optics', 'Services']);
  const readinessStatuses = Object.freeze(['Confirmed', 'Pending OM', 'Pending NTT', 'Pending Carrier', 'Architecture Decision Required', 'Unknown']);
  const decisionStatuses = Object.freeze(['Open', 'Proposed', 'Approved', 'Superseded']);
  const domainNames = Object.freeze(['Teraco Core', 'SD-WAN', 'Branch', 'Campus LAN', 'Wireless', 'Security', 'Internet', 'AWS', 'Shared Services', 'DC LAN', 'SDA']);
  const collections = Object.freeze(['domains', 'sites', 'branchPatterns', 'branches', 'devices', 'interfaces', 'circuits', 'vlans', 'vrfs', 'sdwanVpns', 'subnets', 'routingAdjacencies', 'services', 'components', 'componentStates', 'topologyLinks', 'lldReadiness', 'decisions', 'dependencies', 'sources', 'facts', 'evidence', 'validationRules', 'validationResults']);
  const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;

  function fail(message) { throw new Error(message); }
  function requireText(value, field, max = 4000) {
    if (typeof value !== 'string' || value.length > max) fail(`Invalid ${field}.`);
  }
  function requireId(value, field) {
    if (typeof value !== 'string' || !idPattern.test(value)) fail(`Invalid ${field}.`);
  }
  function requireChoice(value, choices, field) {
    if (!choices.includes(value)) fail(`Invalid ${field}.`);
  }
  function requireRef(value, ids, field, optional = false) {
    if (optional && (value === null || value === undefined || value === '')) return;
    requireId(value, field);
    if (!ids.has(value)) fail(`Missing ${field} reference.`);
  }
  function validateWorkspace(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data) || data.schemaVersion !== 1 || data.id !== 'active') fail('Unsupported cockpit backup format.');
    if (!data.programme || typeof data.programme !== 'object') fail('Missing programme.');
    requireId(data.programme.id, 'programme ID');
    requireText(data.programme.name, 'programme name', 200);
    requireText(data.programme.description, 'programme description');
    if (typeof data.programme.isDemo !== 'boolean') fail('Invalid demonstration marker.');
    const allIds = new Set([data.programme.id]);
    const sets = {};
    for (const collection of collections) {
      const items = data[collection];
      if (!Array.isArray(items) || items.length > 10000) fail(`Invalid ${collection} collection.`);
      sets[collection] = new Set();
      for (const item of items) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) fail(`Invalid ${collection} item.`);
        requireId(item.id, `${collection} ID`);
        if (allIds.has(item.id)) fail(`Duplicate ID: ${item.id}.`);
        allIds.add(item.id);
        sets[collection].add(item.id);
      }
    }
    for (const domain of data.domains) requireText(domain.name, 'domain name', 100);
    for (const site of data.sites) { requireText(site.name, 'site name', 160); requireText(site.siteType, 'site type', 80); }
    for (const pattern of data.branchPatterns) { requireText(pattern.name, 'branch pattern', 160); requireText(pattern.description, 'branch pattern description'); }
    for (const branch of data.branches) {
      requireRef(branch.siteId, sets.sites, 'branch site');
      requireRef(branch.patternId, sets.branchPatterns, 'branch pattern');
      requireText(branch.name, 'branch name', 160);
      if (!Array.isArray(branch.deviceIds)) fail('Invalid branch devices.');
      branch.deviceIds.forEach(id => requireRef(id, sets.devices, 'branch device'));
    }
    for (const device of data.devices) {
      requireRef(device.siteId, sets.sites, 'device site');
      requireRef(device.branchId, sets.branches, 'device branch', true);
      requireText(device.name, 'device name', 160);
      requireText(device.role, 'device role', 100);
    }
    for (const component of data.components) {
      requireRef(component.domainId, sets.domains, 'component domain');
      requireRef(component.siteId, sets.sites, 'component site', true);
      requireText(component.name, 'component name', 160);
      requireText(component.type, 'component type', 100);
      requireText(component.description, 'component description');
    }
    const stateKeys = new Set();
    for (const item of data.componentStates) {
      requireRef(item.componentId, sets.components, 'component state');
      requireChoice(item.state, states, 'component time state');
      requireChoice(item.perspective, perspectives, 'component perspective');
      requireChoice(item.classification, classifications, 'component classification');
      requireRef(item.sourceId, sets.sources, 'component source', true);
      const key = `${item.componentId}:${item.state}`;
      if (stateKeys.has(key)) fail('Duplicate component state.');
      stateKeys.add(key);
    }
    for (const link of data.topologyLinks) {
      requireRef(link.fromId, sets.components, 'link source');
      requireRef(link.toId, sets.components, 'link target');
      if (link.fromId === link.toId) fail('Self topology link.');
      requireChoice(link.state, states, 'link state');
      requireChoice(link.classification, classifications, 'link classification');
      requireText(link.label, 'link label', 200);
      requireRef(link.sourceId, sets.sources, 'link source document', true);
    }
    const readinessKeys = new Set();
    for (const item of data.lldReadiness) {
      requireRef(item.siteId, sets.sites, 'LLD site');
      requireChoice(item.state, states, 'LLD state');
      requireChoice(item.category, readinessCategories, 'LLD category');
      requireChoice(item.status, readinessStatuses, 'LLD status');
      requireChoice(item.classification, classifications, 'LLD classification');
      requireText(item.note, 'LLD note', 1000);
      requireRef(item.sourceId, sets.sources, 'LLD source', true);
      const key = `${item.siteId}:${item.state}:${item.category}`;
      if (readinessKeys.has(key)) fail('Duplicate LLD readiness row.');
      readinessKeys.add(key);
    }
    const codes = new Set();
    for (const decision of data.decisions) {
      requireText(decision.code, 'decision ID', 40);
      requireText(decision.title, 'decision title', 200);
      requireRef(decision.domainId, sets.domains, 'decision domain');
      requireChoice(decision.status, decisionStatuses, 'decision status');
      requireText(decision.decision, 'decision text');
      requireText(decision.rationale, 'decision rationale');
      requireRef(decision.supersededDecisionId, sets.decisions, 'superseded decision', true);
      if (decision.supersededDecisionId === decision.id) fail('Decision cannot supersede itself.');
      if (!Array.isArray(decision.affectedComponentIds)) fail('Invalid affected components.');
      decision.affectedComponentIds.forEach(id => requireRef(id, sets.components, 'affected component'));
      requireRef(decision.sourceId, sets.sources, 'decision source', true);
      requireText(decision.sourceLabel, 'decision source label', 300);
      requireText(decision.date, 'decision date', 20);
      requireChoice(decision.classification, classifications, 'decision classification');
      if (codes.has(decision.code)) fail('Duplicate decision ID.');
      codes.add(decision.code);
    }
    for (const dependency of data.dependencies) {
      requireRef(dependency.upstreamId, sets.components, 'upstream component');
      requireRef(dependency.downstreamId, sets.components, 'downstream component');
      if (dependency.upstreamId === dependency.downstreamId) fail('Self dependency.');
      requireChoice(dependency.status, ['Unresolved', 'Resolved'], 'dependency status');
      requireChoice(dependency.state, [...states, 'All'], 'dependency state');
      requireChoice(dependency.classification, classifications, 'dependency classification');
      requireRef(dependency.decisionId, sets.decisions, 'linked decision', true);
      requireText(dependency.description, 'dependency description');
    }
    for (const source of data.sources) { requireText(source.title, 'source title', 200); requireText(source.type, 'source type', 100); requireText(source.date, 'source date', 20); }
    const subjects = { site: sets.sites, branch: sets.branches, device: sets.devices, component: sets.components, subnet: sets.subnets };
    for (const fact of data.facts) {
      if (!subjects[fact.subjectKind]) fail('Invalid fact subject kind.');
      requireRef(fact.subjectId, subjects[fact.subjectKind], 'fact subject');
      requireText(fact.key, 'fact key', 100); requireText(fact.value, 'fact value');
      requireChoice(fact.state, states, 'fact state');
      requireChoice(fact.perspective, perspectives, 'fact perspective');
      requireChoice(fact.classification, classifications, 'fact classification');
      requireRef(fact.sourceId, sets.sources, 'fact source', true);
    }
    for (const item of data.evidence) { requireRef(item.factId, sets.facts, 'evidence fact'); requireRef(item.sourceId, sets.sources, 'evidence source', true); requireText(item.note, 'evidence note'); }
    for (const result of data.validationResults) { requireRef(result.ruleId, sets.validationRules, 'validation rule'); requireRef(result.factId, sets.facts, 'validation fact'); }
    for (const subnet of data.subnets) { requireRef(subnet.siteId, sets.sites, 'subnet site'); requireText(subnet.cidr, 'subnet CIDR', 80); }
    return data;
  }
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const bytes = new Uint8Array(16);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  function visibleComponents(data, state, domainId = null) {
    const ids = new Set(data.componentStates.filter(item => item.state === state).map(item => item.componentId));
    return data.components.filter(item => ids.has(item.id) && (!domainId || item.domainId === domainId));
  }
  function visibleLinks(data, state, components) {
    const ids = new Set(components.map(item => item.id));
    return data.topologyLinks.filter(link => link.state === state && ids.has(link.fromId) && ids.has(link.toId));
  }
  function readinessFor(data, state, siteId = null) { return data.lldReadiness.filter(item => item.state === state && (!siteId || item.siteId === siteId)); }
  function readinessCounts(rows) { return { confirmed: rows.filter(item => item.status === 'Confirmed').length, unknown: rows.filter(item => item.status === 'Unknown').length, total: rows.length }; }
  function updateReadiness(data, id, fields) {
    const next = copy(data);
    const item = next.lldReadiness.find(row => row.id === id);
    if (!item) fail('LLD readiness item not found.');
    Object.assign(item, { status: fields.status, classification: fields.classification, note: fields.note, sourceId: fields.sourceId || null });
    return validateWorkspace(next);
  }
  function upsertDecision(data, fields) {
    const next = copy(data);
    const id = fields.id || newId();
    const item = { ...fields, id, affectedComponentIds: [...new Set(fields.affectedComponentIds)] };
    const index = next.decisions.findIndex(decision => decision.id === id);
    if (index < 0) next.decisions.push(item); else next.decisions[index] = item;
    return { data: validateWorkspace(next), id };
  }
  function updateDependency(data, id, status) {
    const next = copy(data);
    const item = next.dependencies.find(dependency => dependency.id === id);
    if (!item) fail('Dependency not found.');
    item.status = status;
    return validateWorkspace(next);
  }
  C.model = Object.freeze({ states, perspectives, classifications, readinessCategories, readinessStatuses, decisionStatuses, domainNames, collections, validateWorkspace, copy, newId, visibleComponents, visibleLinks, readinessFor, readinessCounts, updateReadiness, upsertDecision, updateDependency });
})();
