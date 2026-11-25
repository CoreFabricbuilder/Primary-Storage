/* Project only allowlisted read-only Manager fields into a credential-free snapshot. */
function run(argv) {
  ObjC.import('Foundation');
  const [directory, siteId, manager, generatedAt] = argv;
  const read = name => {
    const value = $.NSString.stringWithContentsOfFileEncodingError(directory + '/' + name + '.json', $.NSUTF8StringEncoding, null);
    if (!value) throw new Error('Could not read Manager response.');
    return JSON.parse(ObjC.unwrap(value));
  };
  const raw = Object.fromEntries(['inventory', 'control', 'omp', 'bfd', 'interfaces', 'wan', 'tloc', 'alarms'].map(n => [n, read(n)]));
  const list = name => {
    const value = raw[name];
    if (value.unavailable) return [];
    if (value.pageInfo?.moreEntries || value.moreEntries) throw new Error('Paginated Manager response; snapshot withheld.');
    const data = Array.isArray(value) ? value : value.data;
    if (!Array.isArray(data) || data.length > 10000) throw new Error('Unexpected Manager response.');
    return data;
  };
  const value = (o, ...keys) => {
    for (const key of keys) if (o[key] !== undefined && o[key] !== null) return String(o[key]).slice(0, 160);
    return '';
  };
  const sameSite = o => value(o, 'site-id', 'siteId', 'site_id') === siteId;
  const inventoryAtSite = list('inventory').filter(sameSite);
  if (inventoryAtSite.some(o => !value(o, 'device-type', 'deviceType', 'personality'))) throw new Error('Inventory lacks device type; cannot safely count WAN Edges.');
  const devices = inventoryAtSite.filter(o => /^(vedge|cedge)$/i.test(value(o, 'device-type', 'deviceType', 'personality'))).map(o => ({
    id: value(o, 'uuid', 'deviceId', 'serialNumber', 'system-ip'),
    hostName: value(o, 'host-name', 'hostName'), systemIp: value(o, 'system-ip', 'systemIp'),
    siteId: value(o, 'site-id', 'siteId'), status: value(o, 'reachability', 'status'),
    model: value(o, 'deviceModel', 'model'), template: value(o, 'template', 'templateName'),
    configGroup: value(o, 'configGroupName', 'config-group-name'), policyGroup: value(o, 'policyGroupName'),
  }));
  const ips = new Set(devices.map(d => d.systemIp));
  const relevant = name => list(name).filter(o => sameSite(o) || ips.has(value(o, 'vdevice-name', 'system-ip', 'systemIp', 'deviceId')));
  const sessions = (name, kind) => relevant(name).map(o => ({ systemIp: value(o, 'vdevice-name', 'system-ip', 'systemIp'), peer: value(o, 'peer-system-ip', 'peer', 'peerSystemIp'), state: value(o, 'state', 'status'), color: kind === 'control' || kind === 'bfd' ? value(o, 'local-color', 'color') : '' }));
  const interfaces = relevant('interfaces').map(o => ({ systemIp: value(o, 'vdevice-name', 'system-ip', 'systemIp'), name: value(o, 'ifname', 'interface', 'name'), vpnId: value(o, 'vpn-id', 'vpnId'), status: value(o, 'if-oper-status', 'ifOperStatus', 'state'), side: value(o, 'side') }));
  const wanInterfaces = relevant('wan').map(o => ({ systemIp: value(o, 'vdevice-name', 'system-ip', 'systemIp'), name: value(o, 'interface', 'ifname', 'name'), color: value(o, 'color', 'local-color'), status: value(o, 'if-oper-status', 'state', 'status') }));
  const tlocRows = raw.tloc.unavailable ? [] : relevant('tloc');
  const tlocs = tlocRows.map(o => ({ systemIp: value(o, 'system-ip', 'systemIp', 'vdevice-name'), color: value(o, 'color', 'local-color'), encapsulation: value(o, 'encap', 'encapsulation'), state: value(o, 'state', 'status') }));
  const allAlarms = list('alarms');
  const alarmAttributionComplete = allAlarms.every(o => value(o, 'site-id', 'siteId') || value(o, 'vdevice-name', 'system-ip', 'systemIp', 'deviceId'));
  const alarms = relevant('alarms').map(o => ({ id: value(o, 'uuid', 'id'), severity: value(o, 'severity', 'severity_level'), state: value(o, 'state', 'status') }));
  const coverage = {
    inventory: true, control: !raw.control.unavailable, omp: !raw.omp.unavailable, bfd: !raw.bfd.unavailable,
    interfaces: !raw.interfaces.unavailable, wan: !raw.wan.unavailable, tlocs: !raw.tloc.unavailable, alarms: !raw.alarms.unavailable && alarmAttributionComplete,
    associations: devices.length > 0 && devices.every(d => d.configGroup || d.template),
    policy: devices.length > 0 && devices.every(d => d.policyGroup),
  };
  return JSON.stringify({ format: 'network-refresh-sdwan-snapshot', version: 1, generatedAt, manager, siteId,
    devices, controlConnections: sessions('control', 'control'), ompPeers: sessions('omp', 'omp'),
    bfdSessions: sessions('bfd', 'bfd'), interfaces, wanInterfaces, tlocs, alarms, coverage });
}
