/* Catalyst SD-WAN review and cross-domain branch deployment view. */
(() => {
  'use strict';
  const C = window.Cockpit;
  const h = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const badge = v => `<span class="badge ${['Pass', 'Ready for Review'].includes(v) ? 'good' : ['Fail', 'Failed', 'Not Ready', 'Unknown'].includes(v) ? 'attention' : 'neutral'}">${h(v)}</span>`;
  const scopes = data => [...data.branches.map(x => ({ kind: 'Branch', id: x.id, label: `${x.siteCode || x.name} · ${x.name}` })), ...data.sites.filter(x => /campus/i.test(x.siteType)).map(x => ({ kind: 'Campus', id: x.id, label: x.name }))];
  const scopeKey = x => `${x.kind}|${x.id}`;
  function selected(data, ui) { return scopes(data).find(x => scopeKey(x) === ui.sdwanScope) || scopes(data)[0]; }
  function sdwan(data, ui) {
    const scope = selected(data, ui), target = scope && C.sdwan.activeTarget(data, scope.kind, scope.id), run = scope && C.sdwan.latestRun(data, scope.kind, scope.id);
    const results = data.sdwanResults.filter(x => x.runId === run?.id);
    const batches = data.sdwanBatches.filter(x => x.scopeKind === scope?.kind && x.scopeId === scope?.id).slice().reverse();
    const preview = ui.pendingSdwanSnapshot;
    return `<div class="page-heading"><div><p class="eyebrow">Read-only vendor observations</p><h1>Catalyst SD-WAN validation</h1><p>Stage Manager facts, review each observation, then compare against explicit architecture targets.</p></div>${badge(run?.state || 'Unknown')}</div>` +
      `<section class="panel"><h2>Collect and review</h2><p>Use the optional macOS companion to collect a read-only Manager snapshot. Credentials stay in Keychain; the browser receives a projected JSON file. See <code>docs/SDWAN_COMPANION.md</code>.</p><label class="file-picker">Select Catalyst SD-WAN snapshot JSON <input id="sdwan-file" type="file" accept="application/json,.json"></label>${preview ? `<p><strong>Preview:</strong> ${h(preview.manager)} · Site ID ${h(preview.siteId)} · ${h(preview.devices.length)} devices · ${h(preview.generatedAt)}</p><p>Coverage: ${Object.entries(preview.coverage).map(([k,v]) => `${h(k)} ${v ? 'available' : 'unavailable'}`).join(' · ')}</p><form id="sdwan-stage-form" class="assurance-form"><label>Map Site ID to a branch or campus <select name="scope" required><option value="">Select scope</option>${scopes(data).map(x => `<option value="${h(scopeKey(x))}">${h(x.kind)} · ${h(x.label)}</option>`).join('')}</select></label><div class="form-footer"><small>Staging creates candidates. Applying each candidate is a separate review action.</small><button class="button button-primary" type="submit">Stage for review</button></div></form>` : ''}</section>` +
      `<div class="toolbar assurance-toolbar"><label>Review scope <select id="sdwan-scope">${scopes(data).map(x => `<option value="${h(scopeKey(x))}"${scopeKey(x) === scopeKey(scope) ? ' selected' : ''}>${h(x.kind)} · ${h(x.label)}</option>`).join('')}</select></label></div>` +
      `<section class="panel"><h2>Architecture targets</h2><p>Targets are Design Intent. Changes create a new target version; previous validation runs stay tied to their original target.</p><form id="sdwan-target-form"><div class="form-grid">${C.sdwan.specs.map(x => `<label>${h(x.label)} ${x.mandatory ? '· Critical' : ''}<input name="${h(x.key)}" maxlength="500" value="${h(target?.values[x.key] || '')}" placeholder="Unknown"></label>`).join('')}</div><label>Architect source / rationale <input name="source" maxlength="300" required value="${h(target?.source || '')}" placeholder="HLD reference or architect decision"></label><div class="form-footer"><small>Blank targets produce Unknown validation outcomes.</small><button class="button button-primary" type="submit">Save target version</button></div></form></section>` +
      `<section class="panel"><div class="section-head"><div><p class="eyebrow">Deterministic comparison</p><h2>Latest validation</h2></div><button class="button button-primary" type="button" data-action="run-sdwan">Run validation</button></div>${run ? `<p>Run ${h(run.runAt)} · ${badge(run.state)} · target version ${h(run.targetId)}</p><div class="table-scroll"><table class="data-table"><thead><tr><th>Check</th><th>Target</th><th>Observed</th><th>Result</th><th>Provenance</th></tr></thead><tbody>${results.map(r => `<tr><th>${h(C.sdwan.specs.find(x => x.key === r.key)?.label)} ${r.mandatory ? '· Critical' : ''}</th><td>${h(r.expected || 'Unknown')}</td><td>${h(r.observed || 'Unknown')}</td><td>${badge(r.outcome)}</td><td>${h(r.source || r.note)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No run yet. Save targets and apply observations first.</p>'}</section>` +
      `<section class="panel"><h2>Staged observations</h2>${batches.length ? batches.map(b => `<article class="meraki-batch"><h3>Site ID ${h(b.siteId)} · ${h(b.generatedAt)}</h3><p>${h(b.manager)} · ${b.deviceCount} devices · imported ${h(b.importedAt)}</p>${data.sdwanCandidates.filter(x => x.batchId === b.id).map(x => `<div class="meraki-candidate"><div><strong>${h(C.sdwan.specs.find(s => s.key === x.key)?.label)}</strong> ${badge(x.status)}<p>${h(x.value)}</p><small>${h(x.source)} · Observed</small></div>${x.status === 'Pending' ? `<div class="exception-actions"><button class="button button-small" type="button" data-action="apply-sdwan" data-id="${h(x.id)}">Apply as Observed</button><button class="button button-small" type="button" data-action="dismiss-sdwan" data-id="${h(x.id)}">Dismiss</button></div>` : ''}</div>`).join('')}</article>`).join('') : '<p class="muted">No SD-WAN snapshots staged for this scope.</p>'}</section>`;
  }
  function combinedBranch(data, ui) {
    const branch = data.branches.find(x => x.id === ui.combinedBranchId) || data.branches[0];
    if (!branch) return '<p>No branch selected.</p>';
    const sr = C.sdwan.latestRun(data, 'Branch', branch.id);
    const sd = data.sdwanResults.filter(x => x.runId === sr?.id);
    const ar = C.assurance.latestRun(data, branch.id);
    const assurance = data.assuranceResults.filter(x => x.runId === ar?.id);
    const byDomain = name => assurance.filter(x => data.assuranceRules.find(r => r.id === x.ruleId)?.domain === name);
    const meraki = domain => data.merakiCandidates.filter(x => x.branchId === branch.id && x.status === 'Applied' && data.assuranceRules.find(r => r.id === x.ruleId)?.domain === domain);
    const sections = [
      ['Catalyst SD-WAN', sd, data.sdwanObservations.filter(x => x.scopeKind === 'Branch' && x.scopeId === branch.id).length, 'reviewed observations'],
      ['Meraki LAN', byDomain('LAN'), meraki('LAN').length, 'Meraki observations'],
      ['Meraki Wi-Fi', byDomain('Wi-Fi'), meraki('Wi-Fi').length, 'Meraki observations'],
      ['Physical', byDomain('Physical'), data.branchEvidence.filter(x => x.branchId === branch.id).length, 'evidence records'],
      ['Routing', byDomain('Routing'), 0, ''], ['Management', byDomain('Management'), 0, ''],
    ];
    const criticalFail = [...sd, ...assurance].some(x => x.mandatory && x.severity === 'Critical' && x.outcome === 'Fail');
    const criticalUnknown = [...sd, ...assurance].some(x => x.mandatory && x.severity === 'Critical' && x.outcome === 'Unknown');
    const incomplete = !sr || !ar || criticalUnknown;
    const state = criticalFail ? 'Failed' : incomplete ? 'Not Ready' : [...sd, ...assurance].some(x => ['Fail', 'Warning'].includes(x.outcome)) ? 'Needs Review' : 'Ready for Review';
    const merakiCount = data.merakiCandidates.filter(x => x.branchId === branch.id && x.status === 'Applied').length;
    return `<div class="page-heading"><div><p class="eyebrow">Architectural deployment state</p><h1>Combined Branch</h1><p>Catalyst SD-WAN, Meraki and physical architecture in one evidence view. Critical failures block readiness regardless of percentages.</p></div>${badge(state)}</div><div class="toolbar assurance-toolbar"><label>Branch <select id="combined-branch">${data.branches.map(x => `<option value="${h(x.id)}"${x.id === branch.id ? ' selected' : ''}>${h(x.siteCode || x.name)} · ${h(x.name)}</option>`).join('')}</select></label><span class="muted">${merakiCount} Meraki candidates applied · ${sd.length} SD-WAN checks</span></div><div class="domain-grid">${sections.map(([name, rows, count, unit]) => `<section class="panel"><h2>${h(name)}</h2>${unit ? `<p class="muted">${count} ${h(unit)}</p>` : ''}${rows.length ? rows.map(r => `<div class="item-row"><span><strong>${h(r.key ? C.sdwan.specs.find(x => x.key === r.key)?.label : data.assuranceRules.find(x => x.id === r.ruleId)?.name)}</strong><small>${h(r.observed || 'Unknown')} · ${h(r.source || 'No source')}</small></span>${badge(r.outcome)}</div>`).join('') : '<p class="muted">No validation results yet.</p>'}</section>`).join('')}</div>`;
  }
  C.sdwanViews = Object.freeze({ sdwan, combinedBranch });
})();
