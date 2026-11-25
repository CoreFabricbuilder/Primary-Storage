/* Read-only architecture scenario comparisons; no design or observation is mutated. */
(() => {
  'use strict';
  const C = window.Cockpit;
  const M = C.model;
  const keys = Object.freeze([
    ['Device quantity', 'Physical', 'wanEdge', 'WAN / SD-WAN'],
    ['WAN transports', 'Logical', 'wanTransports', 'WAN / SD-WAN'],
    ['LAN devices', 'Physical', 'lanSwitches', 'Branch LAN'],
    ['LAN handoff', 'Logical', 'lanHandoff', 'Branch LAN'],
    ['VLANs', 'Logical', 'vlans', 'Segmentation'],
    ['VRFs', 'Logical', 'vrfs', 'Segmentation'],
    ['SD-WAN VPNs', 'Logical', 'sdwanVpns', 'Segmentation'],
    ['Routing', 'Logical', 'routing', 'Routing'],
    ['Power', 'Physical', 'powerFeeds', 'Physical'],
    ['Optics', 'Physical', 'optics', 'Physical'],
    ['Wi-Fi APs', 'Physical', 'merakiAps', 'Wireless'],
    ['Wi-Fi SSIDs', 'Logical', 'wifiSsids', 'Wireless'],
    ['Management', 'Logical', 'management', 'Operations'],
    ['Resilience', 'Physical', 'resilience', 'Physical'],
  ]);
  function latestReport(data, branchId) {
    return (data.currentBranchReports || []).filter(item => item.branchId === branchId).at(-1) || null;
  }
  function reportContext(data, branchId) {
    const report = latestReport(data, branchId);
    if (!report) return null;
    const source = (data.currentReportImports || []).find(item => item.id === report.importId);
    return { report, source: `${source?.fileName || 'Branch report'} · ${report.sourceDate || 'date unknown'} · row ${report.sourceRow || '?'}` };
  }
  function compare(data, branchId, patternId = 'assigned') {
    const branch = data.branches.find(item => item.id === branchId);
    if (!branch) throw new Error('Branch not found.');
    const targetId = patternId === 'assigned' ? branch.patternId : patternId;
    const pattern = data.branchPatterns.find(item => item.id === targetId);
    if (!pattern) throw new Error('Target pattern not found.');
    const model = targetId === branch.patternId ? data : { ...data, branches: data.branches.map(item => item.id === branchId ? { ...item, patternId: targetId } : item) };
    const report = reportContext(data, branchId);
    const rows = M.branchDeltas(model, branchId).map(row => {
      const [, category, key, domain] = keys.find(item => item[0] === row.label);
      const attribute = data.branchAttributes.find(item => item.branchId === branchId && item.category === category && item.key === key && item.value && !['Unknown', 'Target'].includes(item.classification));
      const result = { ...row, domain, source: attribute?.source || '', note: '', classification: attribute?.classification || 'Unknown' };
      if (row.label === 'Wi-Fi APs' && !attribute && report && /^\d+$/.test(report.report.fields?.['Total Aps'] || '')) {
        result.current = report.report.fields['Total Aps'];
        result.classification = 'Observed';
        result.source = report.source;
        result.note = 'Reported AP count; vendor and model are unverified.';
        if (row.target !== 'Unknown' && /^\d+$/.test(row.target)) {
          const difference = Number(row.target) - Number(result.current);
          result.delta = difference > 0 ? `${difference} additional Wi-Fi AP${difference === 1 ? '' : 's'} required` : difference < 0 ? `Review ${-difference} surplus Wi-Fi AP${difference === -1 ? '' : 's'}` : 'Aligned';
        }
      }
      result.outcome = row.target === 'Unknown' ? 'Target unknown' : result.current === 'Unknown' ? 'Current unknown' : result.delta === 'Aligned' ? 'Aligned' : 'Change to review';
      return result;
    });
    const counts = { aligned: rows.filter(item => item.outcome === 'Aligned').length, changes: rows.filter(item => item.outcome === 'Change to review').length, unknown: rows.filter(item => item.outcome.includes('unknown')).length };
    const siteComponents = new Set(data.components.filter(item => item.siteId === branch.siteId).map(item => item.id));
    const decisions = data.decisions.filter(item => item.affectedComponentIds.some(id => siteComponents.has(id)));
    const dependencies = data.dependencies.filter(item => siteComponents.has(item.upstreamId) || siteComponents.has(item.downstreamId));
    return { branch, pattern, rows, counts, report, decisions, dependencies };
  }
  function estate(data, patternId = 'assigned') {
    return data.branches.map(branch => compare(data, branch.id, patternId));
  }
  C.scenario = Object.freeze({ compare, estate, reportContext, domains: Object.freeze([...new Set(keys.map(item => item[3]))]) });
})();
