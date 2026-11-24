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
  const physicalItems = Object.freeze([['cabinet', 'Cabinet'], ['wanEdge', 'WAN Edge'], ['lanSwitches', 'LAN switches'], ['merakiSwitches', 'Meraki switches'], ['merakiAps', 'Meraki access points'], ['carrierNte', 'Carrier equipment / NTE'], ['ups', 'UPS'], ['powerFeeds', 'Power feeds'], ['patchPanels', 'Patch panels'], ['optics', 'Optics'], ['rackSpace', 'Available rack space'], ['resilience', 'Physical resilience']]);
  const logicalItems = Object.freeze([['vlans', 'VLANs'], ['vrfs', 'VRFs'], ['sdwanVpns', 'SD-WAN VPN IDs'], ['lanSubnets', 'LAN subnets'], ['transitSubnets', 'Transit subnets'], ['wanCircuits', 'WAN circuits'], ['routing', 'Routing protocol'], ['asn', 'ASN'], ['wanTransports', 'SD-WAN transports'], ['management', 'Management connectivity'], ['wifiSsids', 'Wi-Fi SSIDs'], ['lanHandoff', 'LAN handoff']]);
  const expectationKeys = Object.freeze(['wanEdgeQuantity', 'wanTransports', 'lanDevices', 'wifiApQuantity', 'wifiSsids', 'vlans', 'vrfs', 'sdwanVpns', 'routing', 'resilience', 'management', 'lanHandoff', 'power', 'optics']);
  const confidenceLevels = Object.freeze(['Unknown', 'Low', 'Medium', 'High']);
  const deploymentStatuses = Object.freeze(['Unknown', 'Pending Evidence', 'Architecture Decision Required', 'Ready for Review']);
  const validationStatuses = Object.freeze(['Unknown', 'Not Started', 'Pending Architect Review', 'Architect Confirmed', 'As-Built']);
  const evidenceTypes = Object.freeze(['Photograph', 'Document reference', 'Workshop note', 'Configuration reference', 'Spreadsheet reference', 'Manual observation']);
  const evidenceObjectKinds = Object.freeze(['Branch', 'Cabinet', 'Device', 'Interface', 'Circuit', 'Wireless AP', 'Switch']);
  const collections = Object.freeze(['domains', 'sites', 'branchPatterns', 'branches', 'branchAttributes', 'branchEvidence', 'devices', 'interfaces', 'circuits', 'vlans', 'vrfs', 'sdwanVpns', 'subnets', 'routingAdjacencies', 'services', 'components', 'componentStates', 'topologyLinks', 'lldReadiness', 'decisions', 'dependencies', 'sources', 'facts', 'evidence', 'validationRules', 'validationResults', 'assuranceRules', 'assuranceObservations', 'assuranceBaselines', 'assuranceRuns', 'assuranceResults', 'assuranceExceptions', 'acceptanceGates', 'acceptanceRecords']);
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
    if (!data || typeof data !== 'object' || Array.isArray(data) || data.schemaVersion !== 3 || data.id !== 'active') fail('Unsupported cockpit workspace schema.');
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
    const patternCodes = new Set();
    for (const pattern of data.branchPatterns) {
      requireText(pattern.code, 'pattern ID', 40); requireText(pattern.name, 'branch pattern', 160);
      requireText(pattern.description, 'branch pattern description'); requireText(pattern.intendedUse, 'pattern intended use', 500);
      if (!pattern.code.trim() || patternCodes.has(pattern.code)) fail('Missing or duplicate pattern ID.');
      patternCodes.add(pattern.code);
      if (!pattern.expectations || typeof pattern.expectations !== 'object' || Array.isArray(pattern.expectations)) fail('Invalid pattern expectations.');
      for (const key of expectationKeys) {
        const value = pattern.expectations[key];
        if (value !== null) requireText(value, `pattern ${key}`, 300);
        if (value === '') fail(`Use null for unknown pattern ${key}.`);
      }
      for (const key of ['wanEdgeQuantity', 'lanDevices', 'wifiApQuantity']) {
        const value = pattern.expectations[key];
        if (value !== null && !/^(0|[1-9][0-9]{0,3})$/.test(value)) fail(`Invalid pattern ${key}.`);
      }
    }
    for (const branch of data.branches) {
      requireRef(branch.siteId, sets.sites, 'branch site');
      requireRef(branch.patternId, sets.branchPatterns, 'branch pattern');
      requireText(branch.name, 'branch name', 160);
      requireText(branch.siteCode, 'branch site code', 80);
      requireText(branch.locationDescription, 'branch location', 500);
      requireChoice(branch.currentStateConfidence, confidenceLevels, 'branch current confidence');
      requireChoice(branch.deploymentReadiness, deploymentStatuses, 'branch deployment readiness');
      requireChoice(branch.validationStatus, validationStatuses, 'branch validation status');
      requireText(branch.lastUpdated, 'branch last updated', 40);
      if (!Array.isArray(branch.deviceIds)) fail('Invalid branch devices.');
      branch.deviceIds.forEach(id => {
        requireRef(id, sets.devices, 'branch device');
        const device = data.devices.find(item => item.id === id);
        if (device.branchId !== branch.id || device.siteId !== branch.siteId) fail('Branch device association is inconsistent.');
      });
    }
    const attributeKeys = new Set();
    for (const item of data.branchAttributes) {
      requireRef(item.branchId, sets.branches, 'attribute branch');
      requireChoice(item.category, ['Physical', 'Logical'], 'attribute category');
      const keys = item.category === 'Physical' ? physicalItems : logicalItems;
      if (!keys.some(([key]) => key === item.key)) fail('Invalid branch attribute key.');
      requireText(item.value, 'branch attribute value', 500);
      requireChoice(item.classification, classifications, 'branch attribute classification');
      requireText(item.source, 'branch attribute source', 200);
      requireText(item.note, 'branch attribute note', 1000);
      requireText(item.updatedAt, 'branch attribute timestamp', 40);
      if (item.value && item.classification === 'Unknown') fail('Classify a recorded branch value.');
      if (item.value && !item.source.trim()) fail('Record provenance for a branch value.');
      const key = `${item.branchId}:${item.category}:${item.key}`;
      if (attributeKeys.has(key)) fail('Duplicate branch attribute.');
      attributeKeys.add(key);
    }
    const linkedPhotoIds = new Set();
    for (const item of data.branchEvidence) {
      requireRef(item.branchId, sets.branches, 'evidence branch');
      requireChoice(item.type, evidenceTypes, 'branch evidence type');
      requireChoice(item.objectKind, evidenceObjectKinds, 'evidence object kind');
      requireChoice(item.classification, classifications, 'branch evidence classification');
      requireChoice(item.confidence, confidenceLevels, 'branch evidence confidence');
      requireText(item.source, 'branch evidence source', 200);
      requireText(item.date, 'branch evidence date', 20);
      requireText(item.notes, 'branch evidence notes', 1000);
      if (!item.source.trim()) fail('Evidence source is required.');
      if (item.date && !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) fail('Invalid evidence date.');
      const branch = data.branches.find(entry => entry.id === item.branchId);
      requireId(item.objectId, 'evidence object');
      if ((item.objectKind === 'Branch' || item.objectKind === 'Cabinet') && item.objectId !== branch.id) fail('Evidence object does not match branch.');
      if (['Device', 'Wireless AP', 'Switch'].includes(item.objectKind)) {
        if (!branch.deviceIds.includes(item.objectId)) fail('Evidence device does not belong to branch.');
        const device = data.devices.find(entry => entry.id === item.objectId);
        if (item.objectKind === 'Wireless AP' && !/wi-fi|wireless|access point/i.test(device.role)) fail('Evidence device is not a wireless AP.');
        if (item.objectKind === 'Switch' && !/switch/i.test(device.role)) fail('Evidence device is not a switch.');
      }
      if (item.objectKind === 'Interface' && !data.interfaces.some(entry => entry.id === item.objectId && branch.deviceIds.includes(entry.deviceId))) fail('Evidence interface does not belong to branch.');
      if (item.objectKind === 'Circuit' && !data.circuits.some(entry => entry.id === item.objectId && entry.siteId === branch.siteId)) fail('Evidence circuit does not belong to branch.');
      if (item.type === 'Photograph') {
        requireId(item.photoId, 'evidence photo');
        if (linkedPhotoIds.has(item.photoId)) fail('Photograph linked to multiple evidence records.');
        linkedPhotoIds.add(item.photoId);
      }
      else if (item.photoId !== null) fail('Only photograph evidence may link a photo.');
    }
    for (const device of data.devices) {
      requireRef(device.siteId, sets.sites, 'device site');
      requireRef(device.branchId, sets.branches, 'device branch', true);
      requireText(device.name, 'device name', 160);
      requireText(device.role, 'device role', 100);
      requireText(device.vendor, 'device vendor', 100);
    }
    for (const item of data.interfaces) {
      requireRef(item.deviceId, sets.devices, 'interface device');
      requireText(item.name, 'interface name', 160); requireText(item.description, 'interface description', 500);
    }
    for (const item of data.circuits) {
      requireRef(item.siteId, sets.sites, 'circuit site');
      requireText(item.name, 'circuit name', 160); requireText(item.provider, 'circuit provider', 160); requireText(item.type, 'circuit type', 100);
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
    if (!C.assurance) fail('Assurance model is unavailable.');
    C.assurance.validate(data);
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
  function migrateWorkspace(data, legacyPhotos = []) {
    if (data?.schemaVersion === 3) return validateWorkspace(data);
    if (!data || ![1, 2].includes(data.schemaVersion) || !Array.isArray(data.branches) || !Array.isArray(data.branchPatterns)) fail('Unsupported cockpit workspace schema.');
    const next = copy(data);
    if (next.schemaVersion === 1) {
      next.schemaVersion = 2;
      next.branchAttributes = [];
      next.branchEvidence = [];
      next.branchPatterns = next.branchPatterns.map((pattern, index) => ({
      ...pattern, code: `BP-LEGACY-${String(index + 1).padStart(2, '0')}`,
      intendedUse: pattern.description || '',
      expectations: Object.fromEntries(expectationKeys.map(key => [key, null])),
      }));
      if (next.programme.isDemo && C.demo?.create) {
        for (const pattern of C.demo.create().branchPatterns) {
          const index = next.branchPatterns.findIndex(item => item.id === pattern.id);
          if (index >= 0) next.branchPatterns[index] = pattern;
          else next.branchPatterns.push(pattern);
        }
      }
      next.branches = next.branches.map(branch => ({ ...branch,
      siteCode: '', locationDescription: '', currentStateConfidence: 'Unknown',
      deploymentReadiness: 'Unknown', validationStatus: 'Unknown', lastUpdated: '',
      }));
      for (const photo of legacyPhotos) {
        if (!next.branches.some(branch => branch.id === photo.branchId)) continue;
        next.branchEvidence.push({ id: newId(), branchId: photo.branchId, type: 'Photograph',
        objectKind: photo.deviceId ? 'Device' : 'Branch', objectId: photo.deviceId || photo.branchId,
        photoId: photo.id, source: photo.sourceLabel || 'User-selected photograph',
        date: /^\d{4}-\d{2}-\d{2}/.test(photo.addedAt || '') ? photo.addedAt.slice(0, 10) : '',
        classification: classifications.includes(photo.classification) ? photo.classification : 'Observed',
        confidence: 'Unknown', notes: photo.note || '',
        });
      }
    }
    next.schemaVersion = 3;
    next.assuranceRules = C.assurance.seedRules();
    next.acceptanceGates = C.assurance.seedGates();
    next.assuranceObservations = [];
    next.assuranceBaselines = [];
    next.assuranceRuns = [];
    next.assuranceResults = [];
    next.assuranceExceptions = [];
    next.acceptanceRecords = [];
    return validateWorkspace(next);
  }
  function updateBranch(data, branchId, fields) {
    const next = copy(data);
    const branch = next.branches.find(item => item.id === branchId);
    if (!branch) fail('Branch not found.');
    Object.assign(branch, fields, { lastUpdated: new Date().toISOString() });
    return validateWorkspace(next);
  }
  function createBranch(data, fields) {
    if (!fields.name?.trim()) fail('Branch name is required.');
    const next = copy(data);
    const branchId = newId(), siteId = newId();
    next.sites.push({ id: siteId, name: fields.name, siteType: 'Branch' });
    next.branches.push({ id: branchId, name: fields.name, siteId, siteCode: fields.siteCode,
      locationDescription: '', patternId: fields.patternId, deviceIds: [],
      currentStateConfidence: 'Unknown', deploymentReadiness: 'Unknown', validationStatus: 'Unknown', lastUpdated: new Date().toISOString(),
    });
    for (const state of states) for (const category of readinessCategories) {
      next.lldReadiness.push({ id: newId(), siteId, state, category, status: 'Unknown', classification: 'Unknown', note: '', sourceId: null });
    }
    return { data: validateWorkspace(next), id: branchId };
  }
  function addBranchAsset(data, branchId, type, fields) {
    const next = copy(data);
    const branch = next.branches.find(item => item.id === branchId);
    if (!branch) fail('Branch not found.');
    if (type === 'Subnet' ? !fields.cidr?.trim() : !fields.name?.trim()) fail('Asset name or CIDR is required.');
    const id = newId();
    if (type === 'Device') {
      next.devices.push({ id, siteId: branch.siteId, branchId, name: fields.name, role: fields.role, vendor: fields.vendor });
      branch.deviceIds.push(id);
    } else if (type === 'Interface') {
      if (!branch.deviceIds.includes(fields.deviceId)) fail('Interface device does not belong to branch.');
      next.interfaces.push({ id, deviceId: fields.deviceId, name: fields.name, description: fields.description });
    } else if (type === 'Circuit') {
      next.circuits.push({ id, siteId: branch.siteId, name: fields.name, provider: fields.provider, type: fields.circuitType });
    } else if (type === 'Subnet') {
      next.subnets.push({ id, siteId: branch.siteId, cidr: fields.cidr, purpose: fields.purpose });
    } else fail('Unsupported branch asset type.');
    branch.lastUpdated = new Date().toISOString();
    return { data: validateWorkspace(next), id };
  }
  function upsertBranchAttribute(data, fields) {
    const next = copy(data);
    const index = next.branchAttributes.findIndex(item => item.branchId === fields.branchId && item.category === fields.category && item.key === fields.key);
    if (!fields.value.trim() && fields.classification === 'Unknown') {
      if (index >= 0) next.branchAttributes.splice(index, 1);
    } else {
      const item = { id: index >= 0 ? next.branchAttributes[index].id : newId(), ...fields, updatedAt: new Date().toISOString() };
      if (index >= 0) next.branchAttributes[index] = item; else next.branchAttributes.push(item);
    }
    const branch = next.branches.find(item => item.id === fields.branchId);
    if (branch) branch.lastUpdated = new Date().toISOString();
    return validateWorkspace(next);
  }
  function upsertBranchEvidence(data, fields) {
    const next = copy(data);
    const id = fields.id || newId();
    next.branchEvidence.push({ ...fields, id });
    const branch = next.branches.find(item => item.id === fields.branchId);
    if (branch) branch.lastUpdated = new Date().toISOString();
    return { data: validateWorkspace(next), id };
  }
  function removeBranchEvidence(data, id) {
    const next = copy(data);
    const index = next.branchEvidence.findIndex(item => item.id === id);
    if (index < 0) fail('Branch evidence not found.');
    const [removed] = next.branchEvidence.splice(index, 1);
    next.branches.find(item => item.id === removed.branchId).lastUpdated = new Date().toISOString();
    return { data: validateWorkspace(next), photoId: removed.photoId };
  }
  function upsertPattern(data, fields) {
    const next = copy(data);
    const id = fields.id || newId();
    const item = { ...fields, id };
    const index = next.branchPatterns.findIndex(pattern => pattern.id === id);
    if (index >= 0) next.branchPatterns[index] = item; else next.branchPatterns.push(item);
    return { data: validateWorkspace(next), id };
  }
  function branchTarget(data, branchId) {
    const branch = data.branches.find(item => item.id === branchId);
    return data.branchPatterns.find(item => item.id === branch?.patternId) || null;
  }
  function branchEvidenceTargets(data, branchId) {
    const branch = data.branches.find(item => item.id === branchId);
    if (!branch) return [];
    const targets = [{ kind: 'Branch', id: branch.id, label: 'Branch' }, { kind: 'Cabinet', id: branch.id, label: 'Cabinet' }];
    for (const device of data.devices.filter(item => branch.deviceIds.includes(item.id))) {
      targets.push({ kind: 'Device', id: device.id, label: `Device · ${device.name}` });
      if (/wi-fi|wireless|access point/i.test(device.role)) targets.push({ kind: 'Wireless AP', id: device.id, label: `Wireless AP · ${device.name}` });
      if (/switch/i.test(device.role)) targets.push({ kind: 'Switch', id: device.id, label: `Switch · ${device.name}` });
    }
    for (const item of data.interfaces.filter(entry => branch.deviceIds.includes(entry.deviceId))) targets.push({ kind: 'Interface', id: item.id, label: `Interface · ${item.name}` });
    for (const item of data.circuits.filter(entry => entry.siteId === branch.siteId)) targets.push({ kind: 'Circuit', id: item.id, label: `Circuit · ${item.name}` });
    return targets;
  }
  function branchDeltas(data, branchId) {
    const pattern = branchTarget(data, branchId);
    const mappings = [
      ['Device quantity', 'wanEdgeQuantity', 'Physical', 'wanEdge', 'WAN Edge'],
      ['WAN transports', 'wanTransports', 'Logical', 'wanTransports'],
      ['LAN devices', 'lanDevices', 'Physical', 'lanSwitches', 'LAN device'],
      ['LAN handoff', 'lanHandoff', 'Logical', 'lanHandoff'],
      ['VLANs', 'vlans', 'Logical', 'vlans'],
      ['VRFs', 'vrfs', 'Logical', 'vrfs'],
      ['SD-WAN VPNs', 'sdwanVpns', 'Logical', 'sdwanVpns'],
      ['Routing', 'routing', 'Logical', 'routing'],
      ['Power', 'power', 'Physical', 'powerFeeds'],
      ['Optics', 'optics', 'Physical', 'optics'],
      ['Wi-Fi APs', 'wifiApQuantity', 'Physical', 'merakiAps', 'Wi-Fi AP'],
      ['Wi-Fi SSIDs', 'wifiSsids', 'Logical', 'wifiSsids'],
      ['Management', 'management', 'Logical', 'management'],
      ['Resilience', 'resilience', 'Physical', 'resilience'],
    ];
    return mappings.map(([label, targetKey, category, key, quantityLabel]) => {
      const attr = data.branchAttributes.find(item => item.branchId === branchId && item.category === category && item.key === key);
      const current = attr?.value && !['Unknown', 'Target'].includes(attr.classification) ? attr.value : null;
      const target = pattern?.expectations[targetKey] || null;
      let delta = 'Unknown';
      if (current !== null && target !== null) {
        if (quantityLabel && /^\d+$/.test(current) && /^\d+$/.test(target)) {
          const difference = Number(target) - Number(current);
          delta = difference > 0 ? `${difference} additional ${quantityLabel}${difference === 1 ? '' : 's'} required` : difference < 0 ? `Review ${-difference} surplus ${quantityLabel}${difference === -1 ? '' : 's'}` : 'Aligned';
        } else if (current.trim().toLowerCase() === target.trim().toLowerCase()) delta = 'Aligned';
        else if (['wanTransports', 'vlans', 'vrfs', 'sdwanVpns', 'wifiSsids'].includes(targetKey)) {
          const present = new Set(current.split(/[,;]/).map(value => value.trim().toLowerCase()).filter(Boolean));
          const missing = target.split(/[,;]/).map(value => value.trim()).filter(value => value && !present.has(value.toLowerCase()));
          delta = missing.length ? `Add ${missing.join(', ')}` : 'Review difference';
        } else delta = 'Review difference';
      }
      return { label, current: current || 'Unknown', target: target || 'Unknown', delta, classification: attr?.classification || 'Unknown' };
    });
  }
  function branchEstateRow(data, branchId, state = 'Current') {
    const branch = data.branches.find(item => item.id === branchId);
    if (!branch) fail('Branch not found.');
    const attrs = data.branchAttributes.filter(item => item.branchId === branchId && item.value && item.classification !== 'Unknown');
    const summarize = (items, expectedCount = 0) => {
      const kinds = [...new Set(items.map(item => item.classification))];
      if (kinds.length === 0) return 'Unknown';
      const value = kinds.length === 1 ? kinds[0] : 'Mixed';
      return expectedCount && items.length < expectedCount ? `${value} · Partial` : value;
    };
    const keys = (...names) => attrs.filter(item => names.includes(item.key));
    const evidence = data.branchEvidence.filter(item => item.branchId === branchId);
    const lld = readinessFor(data, state, branch.siteId);
    const lldStatuses = [...new Set(lld.map(item => item.status))];
    return {
      branchId, name: branch.name, siteCode: branch.siteCode,
      Physical: summarize(attrs.filter(item => item.category === 'Physical'), physicalItems.length),
      Circuits: summarize(keys('wanCircuits', 'wanTransports'), 2),
      'IP Addressing': summarize(keys('lanSubnets', 'transitSubnets'), 2),
      Routing: summarize(keys('routing', 'asn'), 2),
      VLAN: summarize(keys('vlans')),
      VRF: summarize(keys('vrfs')),
      'SD-WAN': summarize(keys('sdwanVpns', 'wanEdge', 'wanTransports'), 3),
      LAN: summarize(keys('lanSwitches', 'merakiSwitches', 'lanHandoff'), 3),
      'Wi-Fi': summarize(keys('merakiAps', 'wifiSsids'), 2),
      Evidence: summarize(evidence),
      LLD: lldStatuses.length === 0 ? 'Unknown' : lldStatuses.length === 1 ? lldStatuses[0] : 'Mixed',
      Deployment: branch.deploymentReadiness,
    };
  }
  C.model = Object.freeze({ states, perspectives, classifications, readinessCategories, readinessStatuses, decisionStatuses, domainNames, collections,
    physicalItems, logicalItems, expectationKeys, confidenceLevels, deploymentStatuses, validationStatuses, evidenceTypes, evidenceObjectKinds,
    validateWorkspace, migrateWorkspace, copy, newId, visibleComponents, visibleLinks, readinessFor, readinessCounts, updateReadiness, upsertDecision, updateDependency,
    updateBranch, createBranch, addBranchAsset, upsertBranchAttribute, upsertBranchEvidence, removeBranchEvidence, upsertPattern, branchTarget, branchEvidenceTargets, branchDeltas, branchEstateRow });
})();
