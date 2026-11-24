/* Built-in macOS JavaScript for Automation: allowlist the snapshot fields. */
function project(network, devices, statuses, ssids, organizationId, networkId, generatedAt, ssidCoverage) {
  if (!network || !Array.isArray(devices) || !Array.isArray(statuses) || !Array.isArray(ssids)) throw new Error('Unexpected Meraki response shape.');
  if (network.organizationId !== organizationId) throw new Error('Network does not belong to the requested organization.');
  if (network.id !== networkId) throw new Error('Network response does not match the requested network.');
  return {
    format: 'network-refresh-meraki-snapshot', version: 1, generatedAt: generatedAt, organizationId: organizationId,
    network: { id: network.id, name: network.name, organizationId: network.organizationId },
    devices: devices.map(function (item) { return { serial: item.serial, networkId: item.networkId, model: item.model, name: item.name }; }),
    statuses: statuses.map(function (item) { return { serial: item.serial, status: item.status }; }),
    ssids: ssids.map(function (item) { return { name: item.name, enabled: item.enabled, vlanId: item.vlanId }; }),
    coverage: { statuses: true, ssids: ssidCoverage === 'true' }
  };
}

function run(argv) {
  ObjC.import('Foundation');
  function readJson(path) {
    var value = $.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null);
    if (!value) throw new Error('Could not read Meraki response.');
    return JSON.parse(ObjC.unwrap(value));
  }
  return JSON.stringify(project(readJson(argv[0]), readJson(argv[1]), readJson(argv[2]), readJson(argv[3]), argv[4], argv[5], argv[6], argv[7]));
}
