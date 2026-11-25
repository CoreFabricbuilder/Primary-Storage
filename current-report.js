/* User-selected, pre-SD-WAN branch report. No network or filesystem access. */
(() => {
  'use strict';
  const C = window.Cockpit;
  const FIELDS = Object.freeze(['Location UID', 'Identity', 'Services', 'Business Unit', 'PFA Top-25', 'PGM Region', 'Location', 'Branch Setup', 'Address', 'Postal Code', 'Region', 'Latitude', 'Logitude', 'Telephone', 'Connectivity', 'Primary Connectivity Type', 'Primary Connectivity', 'Primary Bandwidth', 'Secondary Connectivity Type', 'Secondary Connectivity', 'Secondary Bandwidth', 'Total Switches', 'Total Aps', 'Used Macs', 'Subnet', 'PLOC Status']);
  const MAX_BYTES = 5 * 1024 * 1024;
  const MAX_ROWS = 300;
  const dateValid = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  function decode(buffer) {
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength > MAX_BYTES) throw new Error('Select a CSV under 5 MB.');
    const bytes = new Uint8Array(buffer);
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes);
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { return new TextDecoder('windows-1252').decode(bytes); }
  }
  function cells(text) {
    const rows = []; let row = [], cell = '', quoted = false, afterQuote = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') { quoted = false; afterQuote = true; }
        else cell += ch;
      } else if (ch === '"' && !cell.trim() && !afterQuote) { quoted = true; cell = ''; }
      else if (ch === ';') { row.push(cell.trim()); cell = ''; afterQuote = false; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
        if (rows.length > MAX_ROWS + 1) throw new Error('Report exceeds 300 branch rows.');
        row = []; cell = ''; afterQuote = false;
      } else if (afterQuote && !/\s/.test(ch)) throw new Error('Malformed quoted CSV cell.');
      else cell += ch;
    }
    if (quoted) throw new Error('Unclosed quoted CSV cell.');
    row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
    return rows;
  }
  function warnings(fields) {
    const result = [];
    const subnet = fields.Subnet;
    if (!subnet) result.push('Subnet missing');
    else if (subnet.includes(',')) result.push('Multiple subnets in one cell; review manually');
    else if (!/^\d{1,3}(?:\.\d{1,3}){3}\s*\/\s*\d{1,2}$/.test(subnet)) result.push('Subnet is not a single IPv4 CIDR; review manually');
    else if (/\s/.test(subnet)) result.push('Subnet has whitespace; original value retained');
    for (const key of ['Total Switches', 'Total Aps', 'Used Macs']) if (fields[key] && !/^\d+$/.test(fields[key])) result.push(`${key} is not numeric`);
    if (!fields['Total Switches'] || !fields['Total Aps']) result.push('Device count missing');
    if (!fields['Secondary Connectivity Type'] && !fields['Secondary Connectivity']) result.push('Secondary connectivity missing');
    return result;
  }
  function parse(text, fileName) {
    if (typeof text !== 'string' || text.length > MAX_BYTES || !fileName || fileName.length > 200 || !/\.csv$/i.test(fileName)) throw new Error('Select a branch report CSV under 5 MB.');
    const all = cells(text.replace(/^\uFEFF/, ''));
    if (all.length < 2) throw new Error('The report has no branch rows.');
    const header = all.shift().map(value => value.trim());
    if (header.length !== FIELDS.length || header.some((value, index) => value !== FIELDS[index])) throw new Error('Unexpected branch report columns. Use the 26-column Location Branch Report format.');
    const seen = new Set();
    const rows = all.map((values, index) => {
      if (values.length !== FIELDS.length) throw new Error(`CSV row ${index + 2} has ${values.length} columns; expected 26.`);
      const fields = Object.fromEntries(FIELDS.map((name, column) => [name, values[column]]));
      const uid = fields['Location UID'];
      if (!uid || !fields.Location || uid.length > 80 || fields.Location.length > 160) throw new Error(`CSV row ${index + 2} needs a valid Location UID and Location.`);
      if (seen.has(uid)) throw new Error(`Duplicate Location UID on CSV row ${index + 2}.`);
      seen.add(uid);
      if (values.some(value => value.length > 2000)) throw new Error(`CSV row ${index + 2} contains an oversized value.`);
      return { sourceRow: index + 2, uid, fields, warnings: warnings(fields) };
    });
    const nameDate = /(?:^|\D)(\d{2})-(\d{2})-(\d{4})(?:\D|$)/.exec(fileName);
    const sourceDate = nameDate ? `${nameDate[3]}-${nameDate[2]}-${nameDate[1]}` : '';
    return { fileName, sourceDate: dateValid(sourceDate) ? sourceDate : '', rows };
  }
  function unassignedPattern(code = 'BP-UNASSIGNED') {
    return { id: C.model.newId(), code, name: 'Unassigned (current report)', description: 'No target pattern has been selected.', intendedUse: 'Current State import only', expectations: Object.fromEntries(C.model.expectationKeys.map(key => [key, null])) };
  }
  function emptyWorkspace(name) {
    const data = { id: 'active', schemaVersion: 8, programme: { id: 'programme-local', name: (name || '').trim() || 'Network Refresh', description: 'Local architecture workspace', isDemo: false } };
    for (const key of C.model.collections) data[key] = [];
    data.domains = C.model.domainNames.map((domain, index) => ({ id: `domain-${index + 1}`, name: domain }));
    data.branchPatterns.push(unassignedPattern());
    data.assuranceRules = C.assurance.seedRules();
    data.acceptanceGates = C.assurance.seedGates();
    return C.model.validateWorkspace(data);
  }
  function latest(data, branchId) {
    return data.currentBranchReports.filter(item => item.branchId === branchId).at(-1) || null;
  }
  function estateSummary(data) {
    const records = data.branches.map(branch => ({ branch, report: latest(data, branch.id) })).filter(item => item.report);
    const counts = key => {
      const values = new Map();
      for (const { report } of records) {
        const value = report.fields[key]?.trim() || 'Unknown';
        values.set(value, (values.get(value) || 0) + 1);
      }
      return [...values].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    };
    const quantity = key => records.reduce((result, { report }) => {
      const raw = report.fields[key]?.trim() || '';
      if (/^\d+$/.test(raw) && Number.isSafeInteger(Number(raw))) { result.total += Number(raw); result.covered++; }
      return result;
    }, { total: 0, covered: 0 });
    const issueRows = records.map(item => ({ ...item, issues: warnings(item.report.fields) })).filter(item => item.issues.length).sort((a, b) => b.issues.length - a.issues.length || a.branch.name.localeCompare(b.branch.name));
    const hasTarget = branch => {
      const pattern = data.branchPatterns.find(item => item.id === branch.patternId);
      return !!pattern && C.model.expectationKeys.some(key => pattern.expectations[key] !== null);
    };
    const branchSites = new Set(records.map(item => item.branch.siteId));
    const importNames = new Map(data.currentReportImports.map(item => [item.id, item.fileName]));
    const sourceNames = [...new Set(records.map(item => importNames.get(item.report.importId)).filter(Boolean))];
    return {
      totalBranches: data.branches.length, records, reportDate: records.map(item => item.report.sourceDate).filter(Boolean).sort().at(-1) || '', sourceNames,
      primaryCovered: records.filter(({ report }) => report.fields['Primary Connectivity Type'] || report.fields['Primary Connectivity']).length,
      secondaryCovered: records.filter(({ report }) => report.fields['Secondary Connectivity Type'] || report.fields['Secondary Connectivity']).length,
      primaryTypes: counts('Primary Connectivity Type'), regions: counts('Region'),
      switches: quantity('Total Switches'), aps: quantity('Total Aps'), issueRows,
      branchesWithTarget: records.filter(({ branch }) => hasTarget(branch)).length,
      assessedSites: new Set(data.lldReadiness.filter(item => item.state === 'Current' && item.status !== 'Unknown' && branchSites.has(item.siteId)).map(item => item.siteId)).size,
      modelledSites: new Set(data.components.map(item => item.siteId).filter(id => branchSites.has(id))).size,
    };
  }
  function match(data, row) {
    const uidMatches = data.branches.filter(branch => branch.siteCode === row.uid);
    if (uidMatches.length > 1) throw new Error('More than one existing branch has the same Location UID. Resolve this before import.');
    if (uidMatches.length) return { branch: uidMatches[0], method: 'uid' };
    const nameMatches = data.branches.filter(branch => !branch.siteCode && branch.name.trim().toLocaleLowerCase() === row.fields.Location.trim().toLocaleLowerCase());
    if (nameMatches.length === 1) return { branch: nameMatches[0], method: 'name' };
    return { branch: null, method: 'new' };
  }
  function plan(data, parsed, options = {}) {
    const mode = options.mode || (data.programme.isDemo ? 'new' : 'merge');
    if (!['new', 'merge'].includes(mode)) throw new Error('Choose a valid import mode.');
    const sourceDate = options.sourceDate || parsed.sourceDate;
    if (!dateValid(sourceDate)) throw new Error('Enter the report date in YYYY-MM-DD format.');
    const base = mode === 'new' ? emptyWorkspace(options.programmeName) : data;
    const items = parsed.rows.map(row => {
      const { branch, method } = match(base, row);
      const previous = branch && latest(base, branch.id);
      const same = previous && previous.sourceDate === sourceDate && JSON.stringify(previous.fields) === JSON.stringify(row.fields);
      return { row, branchId: branch?.id || null, method, status: !branch ? 'New branch' : same ? 'Unchanged' : 'New observation' };
    });
    const matchedIds = new Set();
    for (const item of items) if (item.branchId) {
      if (matchedIds.has(item.branchId)) throw new Error('Multiple report rows match one existing branch. Resolve the Location UID or name before import.');
      matchedIds.add(item.branchId);
    }
    const counts = { newBranches: items.filter(item => item.status === 'New branch').length, matched: items.filter(item => item.branchId).length, unchanged: items.filter(item => item.status === 'Unchanged').length, warnings: items.reduce((sum, item) => sum + item.row.warnings.length, 0), nameLinks: items.filter(item => item.method === 'name').length };
    return { parsed, mode, sourceDate, programmeName: options.programmeName || '', items, counts };
  }
  function apply(data, preview) {
    const refreshed = plan(data, preview.parsed, preview);
    const next = preview.mode === 'new' ? emptyWorkspace(preview.programmeName) : C.model.copy(data);
    let pattern = next.branchPatterns.find(item => item.code === 'BP-UNASSIGNED' && C.model.expectationKeys.every(key => item.expectations[key] === null));
    if (!pattern && refreshed.counts.newBranches) {
      const codes = new Set(next.branchPatterns.map(item => item.code));
      const code = ['BP-UNASSIGNED', 'BP-REPORT-UNASSIGNED'].find(value => !codes.has(value));
      if (!code) throw new Error('No unassigned pattern code is available.');
      pattern = unassignedPattern(code); next.branchPatterns.push(pattern);
    }
    const batchId = C.model.newId(), now = new Date().toISOString();
    let changed = 0;
    for (const item of refreshed.items) {
      const row = item.row;
      let branch = item.branchId ? next.branches.find(entry => entry.id === item.branchId) : null;
      if (!branch) {
        const siteId = C.model.newId(), branchId = C.model.newId();
        next.sites.push({ id: siteId, name: row.fields.Location, siteType: 'Branch' });
        branch = { id: branchId, name: row.fields.Location, siteId, siteCode: row.uid, locationDescription: '', patternId: pattern.id, deviceIds: [], currentStateConfidence: 'Unknown', deploymentReadiness: 'Unknown', validationStatus: 'Unknown', lastUpdated: now };
        next.branches.push(branch);
        for (const state of C.model.states) for (const category of C.model.readinessCategories) next.lldReadiness.push({ id: C.model.newId(), siteId, state, category, status: 'Unknown', classification: 'Unknown', note: '', sourceId: null });
      } else if (item.method === 'name') branch.siteCode = row.uid;
      if (item.status === 'Unchanged') continue;
      next.currentBranchReports.push({ id: C.model.newId(), branchId: branch.id, importId: batchId, uid: row.uid, sourceRow: row.sourceRow, sourceDate: refreshed.sourceDate, state: 'Current', perspective: 'Observed', classification: 'Observed', fields: row.fields });
      changed++;
    }
    if (changed) next.currentReportImports.push({ id: batchId, fileName: preview.parsed.fileName, sourceDate: refreshed.sourceDate, importedAt: now, rowCount: preview.parsed.rows.length, changedCount: changed });
    return { data: C.model.validateWorkspace(next), counts: refreshed.counts, changed };
  }
  function validate(data) {
    const branches = new Set(data.branches.map(item => item.id));
    const batches = new Map(data.currentReportImports.map(item => [item.id, item]));
    const pairs = new Set();
    for (const batch of batches.values()) {
      if (typeof batch.fileName !== 'string' || batch.fileName.length > 200 || !dateValid(batch.sourceDate) || typeof batch.importedAt !== 'string' || !Number.isInteger(batch.rowCount) || batch.rowCount < 1 || batch.rowCount > MAX_ROWS || !Number.isInteger(batch.changedCount) || batch.changedCount < 1 || batch.changedCount > batch.rowCount) throw new Error('Invalid current report import.');
    }
    for (const item of data.currentBranchReports) {
      if (!branches.has(item.branchId) || !batches.has(item.importId) || !item.uid || item.uid.length > 80 || !Number.isInteger(item.sourceRow) || item.sourceRow < 2 || item.sourceDate !== batches.get(item.importId).sourceDate || item.state !== 'Current' || item.perspective !== 'Observed' || item.classification !== 'Observed') throw new Error('Invalid current branch report reference.');
      if (!item.fields || Object.keys(item.fields).length !== FIELDS.length || FIELDS.some(key => typeof item.fields[key] !== 'string' || item.fields[key].length > 2000) || item.fields['Location UID'] !== item.uid) throw new Error('Invalid current branch report fields.');
      const key = `${item.importId}:${item.uid}`; if (pairs.has(key)) throw new Error('Duplicate current branch report row.'); pairs.add(key);
    }
  }
  C.currentReport = Object.freeze({ FIELDS, MAX_BYTES, decode, parse, plan, apply, validate, latest, estateSummary, emptyWorkspace, warnings });
})();
