/* Screen renderers consume the same normalized local architecture model. */
(() => {
  'use strict';
  const C = window.Cockpit;
  const M = C.model;
  const h = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const byId = (items, id) => items.find(item => item.id === id);
  const nameOf = (items, id) => byId(items, id)?.name || 'Unknown';
  const sourceName = (data, id) => byId(data.sources, id)?.title || 'No source recorded';
  const options = (choices, current) => choices.map(value => `<option value="${h(value)}"${value === current ? ' selected' : ''}>${h(value)}</option>`).join('');
  const badge = value => `<span class="badge ${['Confirmed', 'Approved', 'Resolved', 'Architect Confirmed'].includes(value) ? 'good' : ['Open', 'Unresolved', 'Unknown', 'Architecture Decision Required'].includes(value) ? 'attention' : 'neutral'}">${h(value)}</span>`;
  const heading = (eyebrow, title, description, extra = '') => `<div class="page-heading"><div><p class="eyebrow">${h(eyebrow)}</p><h1>${h(title)}</h1><p>${h(description)}</p></div>${extra}</div>`;
  const stateLabel = state => `${state} State`;
  const openDecisions = data => data.decisions.filter(item => item.status === 'Open' || item.status === 'Proposed');
  const stateDependencies = (data, state) => data.dependencies.filter(item => item.state === 'All' || item.state === state);

  function overview(data, ui) {
    const state = ui.state;
    const visible = M.visibleComponents(data, state);
    const rows = M.readinessFor(data, state);
    const totals = M.readinessCounts(rows);
    const unresolved = stateDependencies(data, state).filter(item => item.status === 'Unresolved');
    const decisions = openDecisions(data);
    const mappedDomains = data.domains.filter(domain => visible.some(component => component.domainId === domain.id)).length;
    return heading('Architecture visibility', 'Architecture Overview', 'See what is designed, what is evidenced and what remains unresolved.', `<span class="view-pill">${h(stateLabel(state))}</span>`) +
      `<div class="metric-grid">
        <article class="metric"><span>Domains mapped</span><strong>${mappedDomains}<small> / ${data.domains.length}</small></strong><p>Domains with components in this state</p></article>
        <article class="metric"><span>LLD statuses confirmed</span><strong>${totals.confirmed}<small> / ${totals.total}</small></strong><p>${totals.unknown} unknown categories</p></article>
        <article class="metric"><span>Open decisions</span><strong>${decisions.length}</strong><p>Open or proposed architecture decisions</p></article>
        <article class="metric"><span>Unresolved dependencies</span><strong>${unresolved.length}</strong><p>Component relationships needing clarity</p></article>
      </div>` +
      `<section class="panel"><div class="section-head"><div><p class="eyebrow">Architecture readiness</p><h2>Domains</h2></div><span class="muted">Select a domain to inspect the topology</span></div><div class="domain-grid">${data.domains.map(domain => {
        const components = visible.filter(item => item.domainId === domain.id);
        const siteIds = new Set(components.map(item => item.siteId).filter(Boolean));
        const counts = M.readinessCounts(rows.filter(item => siteIds.has(item.siteId)));
        return `<button type="button" class="domain-card" data-action="open-domain" data-id="${h(domain.id)}"><span class="domain-icon">◈</span><strong>${h(domain.name)}</strong><span>${components.length} ${components.length === 1 ? 'component' : 'components'} in view</span><small>${counts.total ? `${counts.confirmed}/${counts.total} LLD statuses confirmed` : 'No site LLD linked yet'}</small></button>`;
      }).join('')}</div></section>` +
      `<div class="two-column"><section class="panel"><div class="section-head"><div><p class="eyebrow">Design intent</p><h2>Open architecture decisions</h2></div><span class="count-pill">${decisions.length}</span></div>${decisions.length ? decisions.map(item => `<button type="button" class="item-row" data-action="open-decision" data-id="${h(item.id)}"><span><small>${h(item.code)} · ${h(nameOf(data.domains, item.domainId))}</small><strong>${h(item.title)}</strong></span>${badge(item.status)}</button>`).join('') : '<p class="muted">No open architecture decisions.</p>'}</section>
      <section class="panel"><div class="section-head"><div><p class="eyebrow">Dependencies</p><h2>Unresolved relationships</h2></div><span class="count-pill">${unresolved.length}</span></div>${unresolved.length ? unresolved.slice(0, 5).map(item => `<button type="button" class="item-row" data-action="open-dependency" data-id="${h(item.downstreamId)}"><span><small>${h(nameOf(data.components, item.upstreamId))} → ${h(nameOf(data.components, item.downstreamId))}</small><strong>${h(item.description)}</strong></span>${badge(item.status)}</button>`).join('') : '<p class="muted">No unresolved component dependencies.</p>'}</section></div>` +
      `<section class="panel"><div class="section-head"><div><p class="eyebrow">LLD coverage</p><h2>Site readiness</h2></div><span class="muted">${h(stateLabel(state))}</span></div><div class="site-grid">${data.sites.map(site => {
        const counts = M.readinessCounts(M.readinessFor(data, state, site.id));
        return `<button type="button" class="site-card" data-action="open-readiness" data-id="${h(site.id)}"><strong>${h(site.name)}</strong><small>${h(site.siteType)}</small><span>${counts.confirmed} confirmed · ${counts.unknown} unknown · ${counts.total} categories</span></button>`;
      }).join('')}</div></section>`;
  }

  function topology(data, ui) {
    const visible = M.visibleComponents(data, ui.state, ui.domainFilter);
    const selected = visible.find(item => item.id === ui.selectedComponentId) || visible[0];
    const componentState = data.componentStates.find(item => item.componentId === selected?.id && item.state === ui.state);
    const site = byId(data.sites, selected?.siteId);
    const subnets = data.subnets.filter(item => item.siteId === site?.id);
    const decisions = data.decisions.filter(item => item.affectedComponentIds.includes(selected?.id));
    const dependencies = data.dependencies.filter(item => item.upstreamId === selected?.id || item.downstreamId === selected?.id);
    return heading('Logical architecture', 'Topology', 'Pan, zoom and select a component to inspect its design context.', `<span class="view-pill">${h(stateLabel(ui.state))}</span>`) +
      `<div class="toolbar"><label>Domain <select id="domain-filter"><option value="">All domains</option>${data.domains.map(domain => `<option value="${h(domain.id)}"${ui.domainFilter === domain.id ? ' selected' : ''}>${h(domain.name)}</option>`).join('')}</select></label><span class="muted">${visible.length} components · ${M.visibleLinks(data, ui.state, visible).length} connections</span><div class="zoom-controls"><button type="button" data-action="zoom-out" aria-label="Zoom out">−</button><button type="button" data-action="zoom-in" aria-label="Zoom in">+</button><button type="button" data-action="zoom-fit">Fit</button></div></div>` +
      `<div class="topology-layout"><section class="panel graph-panel"><svg id="topology-svg" class="topology-svg" viewBox="-15 -40 1210 640" role="img" aria-label="Interactive logical network topology"></svg>${visible.length ? '' : `<p class="graph-empty">No components are modelled for this domain in ${h(stateLabel(ui.state))}.</p>`}<p class="graph-hint">Drag to pan · Scroll or use the controls to zoom · Select a node</p></section>
      <aside class="panel detail-panel">${selected ? `<p class="eyebrow">Selected component</p><h2>${h(selected.name)}</h2><p>${h(selected.description)}</p><dl><dt>Domain</dt><dd>${h(nameOf(data.domains, selected.domainId))}</dd><dt>Type</dt><dd>${h(selected.type)}</dd><dt>Site</dt><dd>${h(site?.name || 'Programme-wide')}</dd><dt>Perspective</dt><dd>${h(componentState?.perspective || 'Unknown')}</dd><dt>Classification</dt><dd>${h(componentState?.classification || 'Unknown')}</dd><dt>Source</dt><dd>${h(sourceName(data, componentState?.sourceId))}</dd></dl>${subnets.length ? `<div class="detail-block"><h3>Example addressing</h3>${subnets.map(item => `<p><code>${h(item.cidr)}</code> <small>${h(item.purpose)}</small></p>`).join('')}</div>` : ''}<div class="detail-block"><h3>Linked architecture</h3><p>${dependencies.length} dependencies · ${decisions.length} decisions</p>${decisions.map(item => `<p>${badge(item.status)} ${h(item.code)}: ${h(item.title)}</p>`).join('')}</div><button type="button" class="button button-primary" data-action="open-dependency" data-id="${h(selected.id)}">View dependencies</button>` : '<div class="empty-state"><span>◇</span><h2>Select a component</h2><p>Inspect its evidence classification and relationships.</p></div>'}</aside></div>`;
  }

  function readiness(data, ui) {
    const site = byId(data.sites, ui.selectedSiteId) || data.sites[0];
    const rows = M.readinessFor(data, ui.state, site?.id);
    const counts = M.readinessCounts(rows);
    const byCategory = new Map(rows.map(item => [item.category, item]));
    return heading('Design completeness', 'LLD Readiness', 'Review the architecture inputs needed for a usable low-level design.', `<span class="view-pill">${h(stateLabel(ui.state))}</span>`) +
      `<section class="panel readiness-summary"><label>Site <select id="readiness-site">${data.sites.map(item => `<option value="${h(item.id)}"${item.id === site?.id ? ' selected' : ''}>${h(item.name)}</option>`).join('')}</select></label><div><strong>${counts.confirmed} / ${counts.total}</strong><small>statuses confirmed</small></div><div><strong>${counts.unknown}</strong><small>unknown</small></div><p class="muted">Status and evidence classification are separate. Changing a status never confirms evidence automatically.</p></section>` +
      `<section class="panel table-panel"><div class="section-head"><div><p class="eyebrow">${h(site?.siteType || 'Site')}</p><h2>${h(site?.name || 'No site selected')}</h2></div>${badge(stateLabel(ui.state))}</div><div class="table-scroll"><table class="data-table"><thead><tr><th>Category</th><th>LLD status</th><th>Evidence classification</th><th>Architect note / source</th><th></th></tr></thead><tbody>${M.readinessCategories.map(category => {
        const item = byCategory.get(category);
        return item ? `<tr data-readiness-row="${h(item.id)}"><th scope="row">${h(category)}</th><td><select data-field="status" aria-label="${h(category)} status">${options(M.readinessStatuses, item.status)}</select></td><td><select data-field="classification" aria-label="${h(category)} classification">${options(M.classifications, item.classification)}</select></td><td><input data-field="note" aria-label="${h(category)} note" maxlength="1000" value="${h(item.note)}"></td><td><button type="button" class="button button-small" data-action="save-readiness" data-id="${h(item.id)}">Save</button></td></tr>` : `<tr><th scope="row">${h(category)}</th><td colspan="4" class="muted">Not yet modelled</td></tr>`;
      }).join('')}</tbody></table></div></section>`;
  }

  function nextDecisionCode(data) {
    const greatest = Math.max(0, ...data.decisions.map(item => Number(/^ADR-(\d+)$/.exec(item.code)?.[1] || 0)));
    return `ADR-${String(greatest + 1).padStart(3, '0')}`;
  }
  function decisions(data, ui) {
    const selected = byId(data.decisions, ui.selectedDecisionId);
    const draft = selected || { id: '', code: nextDecisionCode(data), title: '', domainId: data.domains[0]?.id || '', status: 'Open', decision: '', rationale: '', supersededDecisionId: null, affectedComponentIds: [], sourceId: null, sourceLabel: '', date: '', classification: 'Unknown' };
    return heading('Design governance', 'Architecture Decisions', 'Record decisions, rationale, affected components and provenance.', '<button type="button" class="button button-primary" data-action="new-decision">New decision</button>') +
      `<div class="decision-layout"><aside class="panel decision-list"><label>Find a decision <input id="decision-search" type="search" placeholder="ID, title or domain" value="${h(ui.decisionSearch || '')}"></label><div id="decision-items">${data.decisions.map(item => `<button type="button" class="decision-item${item.id === selected?.id ? ' active' : ''}" data-action="select-decision" data-id="${h(item.id)}" data-search="${h(`${item.code} ${item.title} ${nameOf(data.domains, item.domainId)}`.toLowerCase())}"><small>${h(item.code)} · ${h(nameOf(data.domains, item.domainId))}</small><strong>${h(item.title)}</strong>${badge(item.status)}</button>`).join('')}</div></aside>
      <section class="panel decision-form-panel"><div class="section-head"><div><p class="eyebrow">${selected ? 'Decision record' : 'New record'}</p><h2>${h(selected?.code || 'New architecture decision')}</h2></div>${badge(draft.classification)}</div><form id="decision-form"><input name="id" type="hidden" value="${h(draft.id)}"><div class="form-grid"><label>ID <input name="code" required maxlength="40" value="${h(draft.code)}"></label><label>Domain <select name="domainId" required>${data.domains.map(domain => `<option value="${h(domain.id)}"${domain.id === draft.domainId ? ' selected' : ''}>${h(domain.name)}</option>`).join('')}</select></label></div>
      <label>Title <input name="title" required maxlength="200" value="${h(draft.title)}" placeholder="What needs to be decided?"></label><div class="form-grid"><label>Status <select name="status">${options(M.decisionStatuses, draft.status)}</select></label><label>Date <input name="date" type="date" value="${h(draft.date)}"></label></div>
      <label>Decision <textarea name="decision" rows="3" maxlength="4000" placeholder="State the decision or leave blank while open.">${h(draft.decision)}</textarea></label><label>Rationale <textarea name="rationale" rows="3" maxlength="4000">${h(draft.rationale)}</textarea></label><div class="form-grid"><label>Evidence classification <select name="classification">${options(M.classifications, draft.classification)}</select></label><label>Superseded decision <select name="supersededDecisionId"><option value="">None</option>${data.decisions.filter(item => item.id !== draft.id).map(item => `<option value="${h(item.id)}"${item.id === draft.supersededDecisionId ? ' selected' : ''}>${h(item.code)} — ${h(item.title)}</option>`).join('')}</select></label></div>
      <label>Source label <input name="sourceLabel" maxlength="300" value="${h(draft.sourceLabel)}" placeholder="Document, workshop or architect validation"></label><label>Source record <select name="sourceId"><option value="">None</option>${data.sources.map(item => `<option value="${h(item.id)}"${item.id === draft.sourceId ? ' selected' : ''}>${h(item.title)}</option>`).join('')}</select></label>
      <fieldset><legend>Affected components</legend><div class="checkbox-grid">${data.components.map(item => `<label><input type="checkbox" name="affectedComponentIds" value="${h(item.id)}"${draft.affectedComponentIds.includes(item.id) ? ' checked' : ''}>${h(item.name)}</label>`).join('')}</div></fieldset><div class="form-footer"><small>Stable record UUID: ${h(draft.id || 'generated on save')}</small><button class="button button-primary" type="submit">Save decision</button></div></form></section></div>`;
  }

  function dependencies(data, ui) {
    const components = M.visibleComponents(data, ui.state);
    const selected = byId(components, ui.selectedComponentId) || components[0];
    const relevant = stateDependencies(data, ui.state);
    const upstream = relevant.filter(item => item.downstreamId === selected?.id);
    const downstream = relevant.filter(item => item.upstreamId === selected?.id);
    const decisions = data.decisions.filter(item => item.affectedComponentIds.includes(selected?.id) || relevant.some(dep => (dep.upstreamId === selected?.id || dep.downstreamId === selected?.id) && dep.decisionId === item.id));
    const unresolved = [...upstream, ...downstream].filter(item => item.status === 'Unresolved');
    const open = decisions.filter(item => item.status === 'Open' || item.status === 'Proposed');
    const dependencyCard = item => `<div class="dependency-card"><strong>${h(nameOf(data.components, item.upstreamId))} → ${h(nameOf(data.components, item.downstreamId))}</strong><p>${h(item.description)}</p>${badge(item.status)} <small>${h(item.classification)}</small><button type="button" class="text-link" data-action="toggle-dependency" data-id="${h(item.id)}">${item.status === 'Resolved' ? 'Reopen' : 'Mark resolved'}</button></div>`;
    return heading('Architecture relationships', 'Dependencies', 'Inspect what each component relies on and what relies on it.', `<span class="view-pill">${h(stateLabel(ui.state))}</span>`) +
      `<section class="panel component-picker"><label>Component <select id="dependency-component">${components.map(item => `<option value="${h(item.id)}"${item.id === selected?.id ? ' selected' : ''}>${h(item.name)}</option>`).join('')}</select></label><p class="muted">${h(selected?.description || 'No component selected.')}</p></section>` + (selected ?
      `<div class="metric-grid"><article class="metric"><span>Upstream</span><strong>${upstream.length}</strong><p>Components this one depends on</p></article><article class="metric"><span>Downstream</span><strong>${downstream.length}</strong><p>Components relying on this one</p></article><article class="metric"><span>Decisions</span><strong>${decisions.length}</strong><p>Linked architecture decisions</p></article><article class="metric"><span>Unresolved</span><strong>${unresolved.length + open.length}</strong><p>Relationships and decisions</p></article></div>
      <div class="two-column"><section class="panel"><div class="section-head"><div><p class="eyebrow">Inputs</p><h2>Upstream dependencies</h2></div><span class="count-pill">${upstream.length}</span></div>${upstream.length ? upstream.map(dependencyCard).join('') : '<p class="muted">No upstream dependencies recorded.</p>'}</section><section class="panel"><div class="section-head"><div><p class="eyebrow">Consumers</p><h2>Downstream dependencies</h2></div><span class="count-pill">${downstream.length}</span></div>${downstream.length ? downstream.map(dependencyCard).join('') : '<p class="muted">No downstream dependencies recorded.</p>'}</section></div>
      <div class="two-column"><section class="panel"><div class="section-head"><div><p class="eyebrow">Decision trail</p><h2>Architecture decisions</h2></div><span class="count-pill">${decisions.length}</span></div>${decisions.length ? decisions.map(item => `<button type="button" class="item-row" data-action="open-decision" data-id="${h(item.id)}"><span><small>${h(item.code)}</small><strong>${h(item.title)}</strong></span>${badge(item.status)}</button>`).join('') : '<p class="muted">No decisions linked.</p>'}</section><section class="panel"><div class="section-head"><div><p class="eyebrow">Items requiring clarity</p><h2>Unresolved items</h2></div><span class="count-pill">${unresolved.length + open.length}</span></div>${unresolved.map(item => `<div class="dependency-card"><strong>${h(nameOf(data.components, item.upstreamId))} → ${h(nameOf(data.components, item.downstreamId))}</strong><p>${h(item.description)}</p></div>`).join('')}${open.map(item => `<button type="button" class="item-row" data-action="open-decision" data-id="${h(item.id)}"><span><small>${h(item.code)} · ${h(item.status)}</small><strong>${h(item.title)}</strong></span></button>`).join('')}${!unresolved.length && !open.length ? '<p class="muted">No unresolved items for this component.</p>' : ''}</section></div>` : '');
  }

  function branches(data, ui) {
    const branch = byId(data.branches, ui.selectedBranchId) || data.branches[0];
    const site = byId(data.sites, branch?.siteId);
    const pattern = byId(data.branchPatterns, branch?.patternId);
    const devices = data.devices.filter(item => branch?.deviceIds.includes(item.id));
    const subnets = data.subnets.filter(item => item.siteId === site?.id);
    const facts = data.facts.filter(item => item.subjectKind === 'branch' && item.subjectId === branch?.id);
    const counts = M.readinessCounts(M.readinessFor(data, ui.state, site?.id));
    return heading('Branch intelligence', 'Branches', 'Review branch patterns, devices, example addressing and local photograph evidence.', `<span class="view-pill">${h(stateLabel(ui.state))}</span>`) +
      `<div class="branch-layout"><aside class="panel branch-list"><p class="eyebrow">Branch estate</p>${data.branches.map(item => `<button type="button" class="branch-item${item.id === branch?.id ? ' active' : ''}" data-action="open-branch" data-id="${h(item.id)}"><strong>${h(item.name)}</strong><small>${h(nameOf(data.sites, item.siteId))}</small></button>`).join('')}</aside><div class="branch-main">${branch ?
      `<section class="panel"><div class="section-head"><div><p class="eyebrow">${h(site?.siteType || 'Branch')}</p><h2>${h(branch.name)}</h2></div>${badge('Synthetic demo')}</div><div class="branch-summary"><div><small>Branch pattern</small><strong>${h(pattern?.name || 'Unknown')}</strong><p>${h(pattern?.description || '')}</p></div><div><small>Example addressing</small>${subnets.map(item => `<strong><code>${h(item.cidr)}</code></strong><p>${h(item.purpose)}</p>`).join('') || '<strong>Unknown</strong>'}</div><div><small>LLD readiness</small><strong>${counts.confirmed} / ${counts.total} statuses confirmed</strong><p>${counts.unknown} unknown in ${h(stateLabel(ui.state))}</p></div></div></section>
      <section class="panel"><div class="section-head"><div><p class="eyebrow">Site inventory</p><h2>Devices</h2></div><span class="count-pill">${devices.length}</span></div><div class="device-grid">${devices.map(item => `<div class="device-card"><strong>${h(item.name)}</strong><span>${h(item.role)}</span><small>${h(item.vendor)}</small></div>`).join('')}</div></section>
      <section class="panel"><div class="section-head"><div><p class="eyebrow">Provenance</p><h2>Architectural facts</h2></div><span class="count-pill">${facts.length}</span></div>${facts.length ? facts.map(item => `<div class="fact-row"><div><small>${h(item.state)} · ${h(item.perspective)}</small><strong>${h(item.key.replaceAll('_', ' '))}: ${h(item.value)}</strong><span>Source: ${h(sourceName(data, item.sourceId))}</span></div>${badge(item.classification)}</div>`).join('') : '<p class="muted">No branch facts recorded yet.</p>'}</section>
      <section class="panel"><div class="section-head"><div><p class="eyebrow">Local evidence</p><h2>Photographs</h2></div></div><p class="muted">Photos stay in this browser profile. They are included in JSON backups; export regularly.</p><div class="photo-toolbar"><label>Associate with <select id="photo-device"><option value="">Branch only</option>${devices.map(item => `<option value="${h(item.id)}">${h(item.name)}</option>`).join('')}</select></label><button type="button" class="button button-primary" data-action="upload-photo">Add photographs</button></div><div id="photo-gallery" class="photo-grid" data-branch="${h(branch.id)}"><p class="muted">Loading photographs…</p></div></section>` : '<section class="panel"><p>No branches are modelled yet.</p></section>'}</div></div>`;
  }
  C.views = Object.freeze({ h, badge, overview, topology, readiness, decisions, dependencies, branches, sourceName });
})();
