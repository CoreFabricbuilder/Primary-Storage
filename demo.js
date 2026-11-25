/* Synthetic demonstration data only. No customer material belongs in Git. */
(() => {
  'use strict';
  const C = window.Cockpit;
  const { readinessCategories, domainNames, states, expectationKeys } = C.model;
  const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const domains = domainNames.map(name => ({ id: `dom-${slug(name)}`, name }));
  const domainId = name => domains.find(domain => domain.name === name).id;
  const sources = [{ id: 'src-synthetic-workshop', title: 'Synthetic architecture workshop example', type: 'Synthetic demo', date: '2026-11-24', reference: '' }];
  const sourceId = sources[0].id;
  const sites = [
    { id: 'site-teraco', name: 'Teraco Core', siteType: 'Core' },
    { id: 'site-mutual-park', name: 'Mutual Park', siteType: 'Campus' },
    { id: 'site-one-mutual-place', name: 'One Mutual Place', siteType: 'Campus' },
    { id: 'site-branch-north', name: 'Example Branch North', siteType: 'Branch' },
    { id: 'site-branch-south', name: 'Example Branch South', siteType: 'Branch' },
    { id: 'site-branch-pending', name: 'Example Branch Pending', siteType: 'Branch' },
  ];
  const expectations = values => Object.fromEntries(expectationKeys.map(key => [key, values[key] ?? null]));
  const branchPatterns = [
    { id: 'pattern-dual-transport', code: 'BP-SYN-01', name: 'Synthetic resilient branch', description: 'Illustrative dual-transport branch target.', intendedUse: 'Example branch requiring dual SD-WAN transport and local Wi-Fi.', expectations: expectations({ wanEdgeQuantity: '2', wanTransports: 'Internet, MPLS', lanDevices: '2', wifiApQuantity: '2', wifiSsids: 'Corporate, Guest', vlans: '110, 120', vrfs: 'Corporate', sdwanVpns: '10', routing: 'BGP', resilience: 'Dual power and transport', management: 'Out-of-band management', lanHandoff: '802.1Q trunk', power: '2', optics: '10G LR' }) },
    { id: 'pattern-compact', code: 'BP-SYN-02', name: 'Synthetic compact branch', description: 'Illustrative small-site pattern.', intendedUse: 'Example branch with one transport and compact LAN.', expectations: expectations({ wanEdgeQuantity: '1', wanTransports: 'Internet', lanDevices: '1', wifiApQuantity: '1', wifiSsids: 'Corporate', vlans: '110', vrfs: 'Corporate', sdwanVpns: '10', routing: 'Static', resilience: 'UPS', management: 'In-band management', lanHandoff: 'Access port', power: '1', optics: '1G SX' }) },
    { id: 'pattern-campus-edge', code: 'BP-SYN-03', name: 'Synthetic campus edge', description: 'Illustrative larger-site candidate, not a client-approved pattern.', intendedUse: 'Example site whose final target is still subject to architecture review.', expectations: expectations({ wanEdgeQuantity: '2', wanTransports: 'Internet, MPLS', lanDevices: '4', wifiApQuantity: null, routing: 'BGP', resilience: 'Dual path', management: 'Dedicated management' }) },
  ];
  const branches = [
    { id: 'branch-north', name: 'Example Branch North', siteId: 'site-branch-north', siteCode: 'SYN-N01', locationDescription: 'Illustrative northern branch location', patternId: 'pattern-dual-transport', deviceIds: ['device-north-edge', 'device-north-switch', 'device-north-ap'], currentStateConfidence: 'Medium', deploymentReadiness: 'Pending Evidence', validationStatus: 'Pending Architect Review', lastUpdated: '2026-11-24T00:00:00Z' },
    { id: 'branch-south', name: 'Example Branch South', siteId: 'site-branch-south', siteCode: 'SYN-S02', locationDescription: 'Illustrative southern branch location', patternId: 'pattern-compact', deviceIds: ['device-south-edge', 'device-south-switch', 'device-south-ap'], currentStateConfidence: 'Low', deploymentReadiness: 'Unknown', validationStatus: 'Unknown', lastUpdated: '2026-11-24T00:00:00Z' },
    { id: 'branch-pending', name: 'Example Branch Pending', siteId: 'site-branch-pending', siteCode: 'SYN-P03', locationDescription: '', patternId: 'pattern-campus-edge', deviceIds: [], currentStateConfidence: 'Unknown', deploymentReadiness: 'Unknown', validationStatus: 'Unknown', lastUpdated: '' },
  ];
  const branchAttributes = [
    ['branch-north', 'Physical', 'wanEdge', '1', 'Observed'], ['branch-north', 'Physical', 'lanSwitches', '1', 'Observed'],
    ['branch-north', 'Physical', 'merakiAps', '1', 'Observed'], ['branch-north', 'Physical', 'powerFeeds', '1', 'Observed'],
    ['branch-north', 'Logical', 'wanTransports', 'Internet', 'Inferred'], ['branch-north', 'Logical', 'vlans', '110', 'Observed'],
    ['branch-north', 'Logical', 'lanSubnets', '10.101.0.0/24', 'Inferred'], ['branch-north', 'Logical', 'routing', 'Static', 'Inferred'],
    ['branch-north', 'Logical', 'wanCircuits', 'Example carrier A', 'Observed'],
    ['branch-south', 'Physical', 'wanEdge', '1', 'Observed'], ['branch-south', 'Physical', 'merakiAps', '1', 'Observed'],
    ['branch-south', 'Logical', 'wanTransports', 'Internet', 'Observed'],
  ].map(([branchId, category, key, value, classification], index) => ({ id: `ba-syn-${index}`, branchId, category, key, value, classification, source: 'Synthetic workshop example', note: 'Illustrative only; requires real evidence.', updatedAt: '2026-11-24T00:00:00Z' }));
  const branchEvidence = [
    { id: 'be-syn-workshop', branchId: 'branch-north', type: 'Workshop note', objectKind: 'Branch', objectId: 'branch-north', photoId: null, source: 'Synthetic workshop example', date: '2026-11-24', classification: 'Observed', confidence: 'Medium', notes: 'Illustrative note; no customer material.' },
    { id: 'be-syn-observation', branchId: 'branch-south', type: 'Manual observation', objectKind: 'Switch', objectId: 'device-south-switch', photoId: null, source: 'Synthetic manual observation', date: '2026-11-24', classification: 'Observed', confidence: 'Low', notes: 'Illustrative only.' },
  ];
  const devices = [
    { id: 'device-teraco-core', name: 'DEMO-TER-CORE-01', siteId: 'site-teraco', branchId: null, role: 'Core routing', vendor: 'Cisco' },
    { id: 'device-north-edge', name: 'DEMO-NORTH-WAN-01', siteId: 'site-branch-north', branchId: 'branch-north', role: 'Catalyst SD-WAN edge', vendor: 'Cisco' },
    { id: 'device-north-switch', name: 'DEMO-NORTH-LAN-01', siteId: 'site-branch-north', branchId: 'branch-north', role: 'Branch LAN switch', vendor: 'Cisco' },
    { id: 'device-north-ap', name: 'DEMO-NORTH-WIFI-01', siteId: 'site-branch-north', branchId: 'branch-north', role: 'Branch Wi-Fi', vendor: 'Cisco Meraki' },
    { id: 'device-south-edge', name: 'DEMO-SOUTH-WAN-01', siteId: 'site-branch-south', branchId: 'branch-south', role: 'Catalyst SD-WAN edge', vendor: 'Cisco' },
    { id: 'device-south-switch', name: 'DEMO-SOUTH-LAN-01', siteId: 'site-branch-south', branchId: 'branch-south', role: 'Branch LAN switch', vendor: 'Cisco' },
    { id: 'device-south-ap', name: 'DEMO-SOUTH-WIFI-01', siteId: 'site-branch-south', branchId: 'branch-south', role: 'Branch Wi-Fi', vendor: 'Cisco Meraki' },
  ];
  const interfaces = [
    { id: 'if-teraco-uplink', deviceId: 'device-teraco-core', name: 'Example uplink', description: 'Logical example only' },
    { id: 'if-north-wan', deviceId: 'device-north-edge', name: 'WAN transport', description: 'Logical example only' },
    { id: 'if-south-wan', deviceId: 'device-south-edge', name: 'WAN transport', description: 'Logical example only' },
  ];
  const circuits = [
    { id: 'circuit-north-a', siteId: 'site-branch-north', name: 'Example carrier A', provider: 'Example Carrier', type: 'Internet' },
    { id: 'circuit-south-a', siteId: 'site-branch-south', name: 'Example carrier B', provider: 'Example Carrier', type: 'Internet' },
  ];
  const vlans = [
    { id: 'vlan-north-users', siteId: 'site-branch-north', number: 110, name: 'Example users' },
    { id: 'vlan-south-users', siteId: 'site-branch-south', number: 110, name: 'Example users' },
  ];
  const vrfs = [{ id: 'vrf-corporate', name: 'Example corporate VRF' }];
  const sdwanVpns = [{ id: 'vpn-corporate', number: 10, name: 'Example corporate VPN' }];
  const subnets = [
    { id: 'subnet-teraco', siteId: 'site-teraco', cidr: '10.255.0.0/24', purpose: 'Synthetic core management' },
    { id: 'subnet-mutual-park', siteId: 'site-mutual-park', cidr: '10.10.0.0/16', purpose: 'Synthetic campus' },
    { id: 'subnet-one-mutual-place', siteId: 'site-one-mutual-place', cidr: '10.20.0.0/16', purpose: 'Synthetic campus' },
    { id: 'subnet-north', siteId: 'site-branch-north', cidr: '10.101.0.0/24', purpose: 'Synthetic branch' },
    { id: 'subnet-south', siteId: 'site-branch-south', cidr: '10.102.0.0/24', purpose: 'Synthetic branch' },
  ];
  const routingAdjacencies = [{ id: 'adj-example-core', fromDeviceId: 'device-teraco-core', toDeviceId: 'device-north-edge', protocol: 'BGP', note: 'Illustrative only' }];
  const services = [{ id: 'service-shared', name: 'Shared Services', domainId: domainId('Shared Services') }];
  const components = [
    ['teraco', 'Teraco Core', 'Teraco Core', 'site-teraco', 'Core', 'Illustrative network core and interconnect point.', 420, 150],
    ['internet', 'Internet', 'Internet', null, 'External', 'Illustrative internet connectivity.', 60, 150],
    ['aws', 'AWS', 'AWS', null, 'Cloud', 'Illustrative cloud connectivity.', 620, 35],
    ['core-firewall', 'Core Firewall', 'Security', 'site-teraco', 'Security', 'Illustrative internal security boundary.', 620, 150],
    ['perimeter-firewall', 'Perimeter Firewall', 'Security', 'site-teraco', 'Security', 'Illustrative internet perimeter.', 240, 150],
    ['catalyst-sdwan', 'Catalyst SD-WAN', 'SD-WAN', 'site-teraco', 'SD-WAN', 'Illustrative target transport fabric.', 610, 300],
    ['mutual-park', 'Mutual Park', 'Campus LAN', 'site-mutual-park', 'Campus', 'Illustrative campus architecture.', 610, 470],
    ['one-mutual-place', 'One Mutual Place', 'Campus LAN', 'site-one-mutual-place', 'Campus', 'Illustrative campus architecture.', 810, 470],
    ['branch-estate', 'Branch Estate', 'Branch', null, 'Estate', 'Logical grouping for example branches.', 810, 300],
    ['shared-services', 'Shared Services', 'Shared Services', 'site-teraco', 'Services', 'Illustrative shared network services.', 820, 150],
    ['branch-north', 'Example Branch North', 'Branch', 'site-branch-north', 'Branch', 'Synthetic branch using 10.101.0.0/24.', 1010, 240],
    ['branch-south', 'Example Branch South', 'Branch', 'site-branch-south', 'Branch', 'Synthetic branch using 10.102.0.0/24.', 1010, 370],
  ].map(([key, name, domain, siteId, type, description, x, y]) => ({ id: `comp-${key}`, name, domainId: domainId(domain), siteId, type, description, x, y }));
  const componentStates = components.flatMap(component => states.filter(state => !(component.id === 'comp-catalyst-sdwan' && state === 'Current')).map(state => ({
    id: `cs-${component.id}-${state.toLowerCase()}`, componentId: component.id, state,
    perspective: 'Design Intent', classification: state === 'Current' ? 'Inferred' : 'Target', sourceId,
  })));
  const edgeSets = {
    Current: [['internet', 'perimeter-firewall'], ['perimeter-firewall', 'teraco'], ['teraco', 'core-firewall'], ['core-firewall', 'shared-services'], ['teraco', 'aws'], ['teraco', 'branch-estate'], ['branch-estate', 'branch-north'], ['branch-estate', 'branch-south'], ['teraco', 'mutual-park'], ['teraco', 'one-mutual-place']],
    Transition: [['internet', 'perimeter-firewall'], ['perimeter-firewall', 'teraco'], ['teraco', 'core-firewall'], ['core-firewall', 'shared-services'], ['teraco', 'aws'], ['teraco', 'catalyst-sdwan'], ['catalyst-sdwan', 'branch-estate'], ['branch-estate', 'branch-north'], ['branch-estate', 'branch-south'], ['catalyst-sdwan', 'mutual-park'], ['catalyst-sdwan', 'one-mutual-place']],
    Future: [['internet', 'perimeter-firewall'], ['perimeter-firewall', 'teraco'], ['teraco', 'core-firewall'], ['core-firewall', 'shared-services'], ['teraco', 'aws'], ['teraco', 'catalyst-sdwan'], ['catalyst-sdwan', 'branch-estate'], ['branch-estate', 'branch-north'], ['branch-estate', 'branch-south'], ['catalyst-sdwan', 'mutual-park'], ['catalyst-sdwan', 'one-mutual-place'], ['shared-services', 'aws']],
  };
  const topologyLinks = states.flatMap(state => edgeSets[state].map(([from, to], index) => ({
    id: `link-${state.toLowerCase()}-${index}`, fromId: `comp-${from}`, toId: `comp-${to}`, state,
    label: `${from.replaceAll('-', ' ')} to ${to.replaceAll('-', ' ')}`, classification: state === 'Current' ? 'Inferred' : 'Target', sourceId,
  })));
  const lldReadiness = sites.flatMap((site, siteIndex) => states.flatMap(state => readinessCategories.map((category, categoryIndex) => {
    let status = 'Unknown';
    if (state === 'Current') {
      if (category === 'Physical' && siteIndex < 4) status = 'Confirmed';
      else if (category === 'IP Addressing') status = 'Pending NTT';
      else if (category === 'VLAN' && siteIndex < 3) status = 'Confirmed';
      else if (category === 'SD-WAN VPN') status = 'Architecture Decision Required';
      else if (category === 'Routing') status = 'Pending OM';
      else if (category === 'Patching' || category === 'Optics') status = 'Pending Carrier';
    } else if (state === 'Transition' && categoryIndex < 2) status = 'Pending NTT';
    return { id: `lld-${site.id}-${state.toLowerCase()}-${categoryIndex}`, siteId: site.id, state, category, status,
      classification: 'Inferred', note: 'Synthetic example status; verify with an actual LLD or architect.', sourceId };
  })));
  const decisions = [
    { id: 'dec-sdwan-handoff', code: 'ADR-001', title: 'Confirm SD-WAN core handoff', domainId: domainId('SD-WAN'), status: 'Open', decision: '', rationale: 'Transition topology needs an agreed handoff and validation source.', supersededDecisionId: null, affectedComponentIds: ['comp-teraco', 'comp-catalyst-sdwan', 'comp-branch-estate'], sourceId, sourceLabel: 'Synthetic architecture workshop example', date: '', classification: 'Unknown' },
    { id: 'dec-firewall', code: 'ADR-002', title: 'Confirm firewall service boundary', domainId: domainId('Security'), status: 'Proposed', decision: 'Separate perimeter and core firewall boundaries in the target design.', rationale: 'Keep internet and shared service policy domains explicit.', supersededDecisionId: null, affectedComponentIds: ['comp-core-firewall', 'comp-perimeter-firewall'], sourceId, sourceLabel: 'Synthetic architecture workshop example', date: '', classification: 'Target' },
    { id: 'dec-legacy-subnet', code: 'ADR-000', title: 'Legacy shared branch subnet', domainId: domainId('Branch'), status: 'Superseded', decision: 'Use one subnet for example branches.', rationale: 'Superseded synthetic option.', supersededDecisionId: null, affectedComponentIds: [], sourceId, sourceLabel: 'Synthetic architecture workshop example', date: '2026-11-20', classification: 'Inferred' },
    { id: 'dec-branch-subnets', code: 'ADR-003', title: 'Use distinct example branch subnets', domainId: domainId('Branch'), status: 'Approved', decision: 'Use 10.101.0.0/24 and 10.102.0.0/24 for synthetic branch examples.', rationale: 'Keeps examples separate and dependencies visible.', supersededDecisionId: 'dec-legacy-subnet', affectedComponentIds: ['comp-branch-north', 'comp-branch-south'], sourceId, sourceLabel: 'Synthetic architecture workshop example', date: '2026-11-24', classification: 'Target' },
  ];
  const dependencies = [
    ['sdwan-branch', 'comp-catalyst-sdwan', 'comp-branch-estate', 'Unresolved', 'Branch transport depends on the SD-WAN core handoff.', 'dec-sdwan-handoff', 'Transition'],
    ['firewall-shared', 'comp-core-firewall', 'comp-shared-services', 'Unresolved', 'Shared service reachability depends on the core firewall boundary.', 'dec-firewall', 'All'],
    ['teraco-mutual', 'comp-teraco', 'comp-mutual-park', 'Unresolved', 'Mutual Park campus uplink depends on core routing.', null, 'All'],
    ['teraco-omp', 'comp-teraco', 'comp-one-mutual-place', 'Resolved', 'Example campus core path is represented.', null, 'All'],
    ['estate-north', 'comp-branch-estate', 'comp-branch-north', 'Unresolved', 'Example Branch North inherits the branch transport design.', 'dec-sdwan-handoff', 'All'],
    ['estate-south', 'comp-branch-estate', 'comp-branch-south', 'Resolved', 'Example Branch South is mapped to the estate.', null, 'All'],
  ].map(([key, upstreamId, downstreamId, status, description, decisionId, state]) => ({ id: `dep-${key}`, upstreamId, downstreamId, status, description, decisionId, state, classification: 'Inferred' }));
  const facts = [
    { id: 'fact-north-subnet', subjectKind: 'branch', subjectId: 'branch-north', key: 'example_subnet', value: '10.101.0.0/24', state: 'Future', perspective: 'Design Intent', classification: 'Target', sourceId },
    { id: 'fact-south-subnet', subjectKind: 'branch', subjectId: 'branch-south', key: 'example_subnet', value: '10.102.0.0/24', state: 'Future', perspective: 'Design Intent', classification: 'Target', sourceId },
    { id: 'fact-teraco-path', subjectKind: 'component', subjectId: 'comp-teraco', key: 'core_path', value: 'Illustrative core interconnect', state: 'Current', perspective: 'Design Intent', classification: 'Inferred', sourceId },
  ];
  const evidence = [
    { id: 'evidence-north', factId: 'fact-north-subnet', sourceId, note: 'RFC1918 synthetic example only.' },
    { id: 'evidence-south', factId: 'fact-south-subnet', sourceId, note: 'RFC1918 synthetic example only.' },
  ];
  const validationRules = [{ id: 'rule-source-required', name: 'Architectural facts require a source', description: 'A non-Unknown fact should identify provenance.' }];
  const validationResults = [{ id: 'result-teraco-source', ruleId: 'rule-source-required', factId: 'fact-teraco-path', outcome: 'Pass', note: 'Synthetic source is identified.' }];
  const assuranceRules = C.assurance.seedRules();
  const acceptanceGates = C.assurance.seedGates();
  const baselineValues = (patternId, extras = {}) => {
    const pattern = branchPatterns.find(item => item.id === patternId);
    return Object.fromEntries(assuranceRules.map(rule => [rule.id, extras[rule.code] ?? (rule.patternKey ? pattern.expectations[rule.patternKey] : null)]));
  };
  const assuranceBaselines = [
    { id: 'baseline-syn-north', branchId: 'branch-north', name: 'Synthetic resilient branch baseline', status: 'Active', source: 'Synthetic design workshop example', createdAt: '2026-11-24T00:00:00Z', values: baselineValues('pattern-dual-transport', {
      'LAN-SW-MODEL': 'Cisco Catalyst 9200', 'LAN-UPLINK-MODE': 'LACP', 'LAN-NATIVE-VLAN': '999', 'LAN-POE': 'Required',
      'LAN-MGMT-CONFIG': 'Dedicated management VRF', 'WIFI-AP-MODEL': 'Meraki MR46', 'WIFI-VLAN-MAP': 'Corporate:110, Guest:120',
      'WIFI-RF-PROFILE': 'Branch Standard', 'WIFI-MGMT-STATE': 'Online', 'SDW-COLOURS': 'biz-internet, mpls', 'SDW-SERVICE-SIDE': 'Up',
    }) },
    { id: 'baseline-syn-south', branchId: 'branch-south', name: 'Synthetic compact branch baseline', status: 'Active', source: 'Synthetic design workshop example', createdAt: '2026-11-24T00:00:00Z', values: baselineValues('pattern-compact') },
  ];
  const assuranceObservations = [
    ['branch-north', 'LAN-SW-COUNT', 'Observed', '1', 'Synthetic manual inventory'],
    ['branch-north', 'LAN-SW-MODEL', 'Observed', 'Cisco Catalyst 9200', 'Synthetic manual inventory'],
    ['branch-north', 'LAN-ALLOWED-VLANS', 'Observed', '110', 'Synthetic manual configuration review'],
    ['branch-north', 'WIFI-AP-COUNT', 'Observed', '1', 'Synthetic Meraki observation'],
    ['branch-north', 'WIFI-AP-MODEL', 'Observed', 'Meraki MR46', 'Synthetic Meraki observation'],
    ['branch-north', 'SDW-EDGE-COUNT', 'Observed', '1', 'Synthetic SD-WAN observation'],
    ['branch-north', 'SDW-TRANSPORTS', 'Observed', 'Internet', 'Synthetic SD-WAN observation'],
    ['branch-north', 'SDW-EDGE-COUNT', 'As-Built', '1', 'Synthetic as-built note'],
    ['branch-south', 'LAN-SW-COUNT', 'Observed', '1', 'Synthetic manual inventory'],
  ].map(([branchId, code, perspective, value, source], index) => ({ id: `assurance-observation-syn-${index}`, branchId,
    ruleId: `rule-${code.toLowerCase()}`, perspective, classification: perspective, value, source, recordedAt: '2026-11-24T00:00:00Z' }));
  const workspace = {
    schemaVersion: 6, id: 'active', programme: { id: 'programme-demo', name: 'Network Refresh — Synthetic Demo', description: 'Illustrative architecture; replace with validated programme evidence.', isDemo: true },
    domains, sites, branchPatterns, branches, branchAttributes, branchEvidence, devices, interfaces, circuits, vlans, vrfs, sdwanVpns, subnets, routingAdjacencies, services,
    components, componentStates, topologyLinks, lldReadiness, decisions, dependencies, sources, facts, evidence, validationRules, validationResults,
    assuranceRules, assuranceObservations, assuranceBaselines, assuranceRuns: [], assuranceResults: [], assuranceExceptions: [], acceptanceGates, acceptanceRecords: [],
    merakiBatches: [], merakiCandidates: [],
    sdwanBatches: [], sdwanCandidates: [], sdwanObservations: [], sdwanTargets: [], sdwanRuns: [], sdwanResults: [],
    transProgrammes: [], transProjects: [], transStreams: [], transActivities: [], transDependencies: [], transMilestones: [], transMappings: [], transGates: [], planImports: [], importChanges: [], dataQualityIssues: [],
  };
  const syntheticMerakiSnapshot = {
    format: C.meraki.FORMAT, version: 1, generatedAt: '2026-11-24T00:00:00Z', organizationId: 'org-synthetic',
    network: { id: 'L_synthetic_north', name: 'Synthetic Branch North', organizationId: 'org-synthetic' },
    devices: [
      { serial: 'SYN-MS-01', networkId: 'L_synthetic_north', model: 'MS120-8', name: 'Synthetic switch' },
      { serial: 'SYN-MR-01', networkId: 'L_synthetic_north', model: 'MR46', name: 'Synthetic AP' },
    ],
    statuses: [{ serial: 'SYN-MS-01', status: 'online' }, { serial: 'SYN-MR-01', status: 'online' }],
    ssids: [{ number: 0, name: 'Corporate', enabled: true, vlanId: 110 }],
    coverage: { statuses: true, ssids: true },
  };
  const syntheticPlan = {
    filename: 'Synthetic transformation example.xlsx', sheets: {
      'Planned High Level Streams': [
        { sheet: 'Planned High Level Streams', row: 2, values: { Location: 'Example Branch North', Workstream: 'Branch Rollout', TA: 'TA-BRANCH', Category: 'Branch', Detail: 'WAN, LAN and Wi-Fi refresh', Start: '2027-01-10', End: '2027-03-25', Dependency: 'Teraco Core ready', 'Jan 2027': '●', 'Feb 2027': '●', 'Mar 2027': '●' } },
        { sheet: 'Planned High Level Streams', row: 3, values: { Location: 'Teraco', Workstream: 'Core Connectivity', TA: 'TA-CORE', Category: 'Teraco Core', Detail: 'Core handoff and routing', Start: '2026-12-01', End: '2027-02-28', Dependency: '', 'Dec 2026': '●', 'Jan 2027': '●', 'Feb 2027': '●' } },
        { sheet: 'Planned High Level Streams', row: 4, values: { Location: 'Example Branch South', Workstream: 'Branch Rollout', TA: 'TA-BRANCH', Category: 'Branch', Detail: 'Second branch deployment', Start: '2027-04-01', End: '2027-05-31', Dependency: 'Example Branch North validation', 'Apr 2027': '●', 'May 2027': '●' } },
      ],
      'Detailed Plan': [
        { sheet: 'Detailed Plan', row: 2, values: { 'Programme Area': 'Example Branch North', Phase: 'Design', Task: 'Complete branch LLD', 'Source Schedule': 'SYN-01', Resources: 'Synthetic architecture team', 'Source Category': 'Design', Start: '2027-01-10', End: '2027-01-31', 'Planning Status': 'TBD', 'Source Line': 'SYN-001', Notes: 'Illustrative only' } },
        { sheet: 'Detailed Plan', row: 3, values: { 'Programme Area': 'Example Branch North', Phase: 'Deployment', Task: 'Validate branch connectivity', 'Source Schedule': 'SYN-02', Resources: 'Synthetic network team', 'Source Category': 'Validation', Start: '2027-03-01', End: '2027-03-25', 'Planning Status': 'Planned', 'Source Line': 'SYN-002', Notes: '' } },
        { sheet: 'Detailed Plan', row: 4, values: { 'Programme Area': 'Teraco', Phase: 'Design', Task: 'Confirm core handoff', 'Source Schedule': 'SYN-03', Resources: 'Synthetic architecture team', 'Source Category': 'Design', Start: '2026-12-01', End: '2026-12-20', 'Planning Status': 'Planned', 'Source Line': 'SYN-003', Notes: '' } },
      ],
    },
  };
  C.demo = Object.freeze({ create: () => {
    const data = C.assurance.runValidation(C.model.validateWorkspace(C.model.copy(workspace)), 'branch-north').data;
    let result = C.meraki.stageSnapshot(data, syntheticMerakiSnapshot, 'branch-north').data;
    result = C.transformation.applyImport(result, C.transformation.previewImport(result, syntheticPlan));
    const north = result.transStreams.find(item => item.source.area === 'Example Branch North');
    const core = result.transStreams.find(item => item.source.area === 'Teraco');
    const activity = result.transActivities.find(item => item.source.task === 'Complete branch LLD');
    result = C.transformation.linkActivity(result, activity.id, north.id);
    result = C.transformation.setGate(result, 'Stream', core.id, 'Architecture Defined', 'Synthetic architecture review example.');
    result = C.transformation.addMapping(result, 'Stream', north.id, 'Domain', 'catalyst-sd-wan');
    result = C.transformation.addMapping(result, 'Stream', north.id, 'Domain', 'branch-lan');
    result = C.transformation.addMapping(result, 'Stream', north.id, 'Domain', 'meraki-wi-fi');
    result = C.transformation.addMapping(result, 'Stream', north.id, 'Branch', 'branch-north');
    result = C.transformation.addMapping(result, 'Stream', north.id, 'Component', 'comp-branch-north');
    result = C.transformation.addMapping(result, 'Stream', north.id, 'Branch Pattern', 'pattern-dual-transport');
    result = C.transformation.addMapping(result, 'Stream', north.id, 'Decision', 'dec-sdwan-handoff');
    result = C.transformation.addMapping(result, 'Stream', north.id, 'LLD', null, 'Synthetic branch LLD reference');
    result = C.transformation.linkDependency(result, result.transDependencies.find(item => item.streamId === north.id).id, core.id);
    return result;
  } });
})();
