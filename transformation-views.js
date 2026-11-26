/* Architecture-centred transformation portfolio screens. All imported text is escaped. */
(() => {
  'use strict';
  const C = window.Cockpit;
  const h = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const byId = (items, id) => items.find(item => item.id === id);
  const active = items => items.filter(item => !item.removed);
  const gate = (data, kind, id) => C.transformation.gateOf(data, kind, id);
  const label = item => item?.source?.workstream || item?.source?.task || item?.name || 'Unknown';
  const windowText = item => `${item.source.plannedStart || 'Unknown'} → ${item.source.plannedEnd || 'Unknown'}`;
  const mapTargets = (data, kind, id) => data.transMappings.filter(item => item.ownerKind === kind && item.ownerId === id);
  const domainName = id => C.transformation.DOMAINS.find(item => item.id === id)?.name || id;
  const badge = value => `<span class="count-pill">${h(value)}</span>`;
  const heading = (eyebrow, title, note) => `<div class="page-heading"><div><p class="eyebrow">${h(eyebrow)}</p><h1>${h(title)}</h1><p class="muted">${h(note)}</p></div></div>`;
  const open = (kind, id, text, className = 'text-link') => `<button type="button" class="${className}" data-action="open-trans-item" data-kind="${h(kind)}" data-id="${h(id)}">${h(text)}</button>`;
  function latestIssues(data) {
    const last = data.planImports.at(-1);
    return last ? data.dataQualityIssues.filter(item => item.importId === last.id) : [];
  }
  function transformation(data, ui) {
    const streams = active(data.transStreams), activities = active(data.transActivities), deps = active(data.transDependencies);
    const upcoming = streams.filter(item => item.source.plannedStart && item.source.plannedStart >= new Date().toISOString().slice(0, 10)).sort((a, b) => a.source.plannedStart.localeCompare(b.source.plannedStart)).slice(0, 7);
    const mappedDomains = new Set(data.transMappings.filter(item => item.targetKind === 'Domain' && streams.some(stream => stream.id === item.ownerId)).map(item => item.targetId));
    const latest = data.planImports.at(-1), preview = ui.transPreview;
    const review = C.risk.signals(data);
    return heading('Transformation portfolio', 'Architecture change across the plan', 'Planning data is source context. Architecture gates and mappings are architect controlled.') +
      `<section class="panel risk-overview-link"><div><p class="eyebrow">Architecture intervention</p><h2>${review.filter(item => item.findings.length).length} workstreams have review prompts</h2><p class="muted">Plan windows, missing design links and architect-assessed escalations are brought together without changing the source plan.</p></div><button type="button" class="button button-primary" data-screen="transRisks">Open risk analysis</button></section>` +
      `<div class="metric-grid"><article class="metric"><span>Projects / TAs</span><strong>${active(data.transProjects).length}</strong><p>Source project labels</p></article><article class="metric"><span>Active streams</span><strong>${streams.length}</strong><p>${activities.length} detailed activities</p></article><article class="metric"><span>Mapped domains</span><strong>${mappedDomains.size}</strong><p>Architect mappings</p></article><article class="metric"><span>Open source dependencies</span><strong>${deps.filter(item => !item.targetStreamId).length}</strong><p>Awaiting stream linkage</p></article><article class="metric"><span>TBD activities</span><strong>${activities.filter(item => /^tbd|^tbc|^unknown$/i.test(item.source.planningStatus) || !item.source.planningStatus).length}</strong><p>Source status only</p></article><article class="metric"><span>Quality warnings</span><strong>${latestIssues(data).length}</strong><p>Latest import</p></article></div>` +
      `<section class="panel"><div class="section-head"><div><p class="eyebrow">Local workbook</p><h2>Import transformation plan</h2></div></div><p class="muted">Select either the two-sheet stream/detail plan or the one-sheet “Details” overlapping deployment view. Preview changes before applying. The original workbook is never saved in the app.</p><label class="file-picker">Select workbook <input id="trans-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label>${latest ? `<p class="muted">Last applied: ${h(latest.filename)} · ${h(latest.format || 'Two-sheet plan')} · ${h(latest.importedAt)}</p>` : ''}</section>` +
      (preview ? `<section class="panel"><div class="section-head"><div><p class="eyebrow">Import preview · ${h(preview.filename)} · ${h(preview.format)}</p><h2>Review source changes</h2></div>${badge(`${preview.issues.length} warnings`)}</div><div class="trans-summary">${Object.entries(preview.summary).map(([name, count]) => `<span>${h(name)} <strong>${count}</strong></span>`).join('')}</div><div class="trans-preview-list">${preview.changes.slice(0, 100).map(change => `<div><strong>${h(change.kind)} ${h(change.entityKind)}</strong> · ${h(label(change.item))} <small>${h(change.item.source.area)} · ${h(change.fields.join(', '))}${change.dateChange ? ' · Date change' : ''}${change.dependencyChange ? ' · Dependency change' : ''}${change.statusChange ? ' · Status change' : ''}</small></div>`).join('') || '<p class="muted">No source record changes.</p>'}</div>${preview.changes.length > 100 ? '<p class="muted">First 100 changes shown.</p>' : ''}<details><summary>Data quality warnings (${preview.issues.length})</summary>${preview.issues.slice(0, 100).map(issue => `<p>${h(issue.code)} · ${h(issue.sheet)} row ${h(issue.row)}: ${h(issue.detail)}</p>`).join('') || '<p>No warnings.</p>'}</details><div class="exception-actions"><button type="button" class="button button-primary" data-action="apply-trans-import">Confirm and apply import</button><button type="button" class="button button-small" data-action="cancel-trans-import">Cancel</button></div></section>` : '') +
      `<div class="trans-two"><section class="panel"><div class="section-head"><h2>Upcoming streams</h2>${badge(upcoming.length)}</div>${upcoming.map(item => `<div class="fact-row"><div>${open('Stream', item.id, label(item))}<small>${h(item.source.area)} · ${h(item.source.ta)}</small></div><div>${h(windowText(item))}</div></div>`).join('') || '<p class="muted">No dated upcoming streams.</p>'}</section><section class="panel"><div class="section-head"><h2>Architecture gates</h2></div>${C.transformation.GATES.map(name => `<div class="fact-row"><span>${h(name)}</span><strong>${streams.filter(item => gate(data, 'Stream', item.id) === name).length}</strong></div>`).join('')}</section></div>`;
  }
  function monthList(data) {
    const dates = active(data.transStreams).flatMap(item => [item.source.plannedStart, item.source.plannedEnd]).filter(Boolean).sort();
    if (!dates.length) return [];
    const months = [], cursor = new Date(`${dates[0].slice(0, 7)}-01T00:00:00Z`), end = dates.at(-1).slice(0, 7);
    while (months.length < 48) { const key = cursor.toISOString().slice(0, 7); months.push(key); if (key >= end) break; cursor.setUTCMonth(cursor.getUTCMonth() + 1); }
    return months;
  }
  function transTimeline(data, ui) {
    const mode = ui.transTimelineBy || 'Project / TA', months = monthList(data), streams = active(data.transStreams);
    const groups = new Map();
    for (const item of streams) {
      const labels = mode === 'Project / TA' ? [byId(data.transProjects, item.projectId)?.name || 'Unmapped Project / TA'] :
        mode === 'Architecture Domain' ? mapTargets(data, 'Stream', item.id).filter(map => map.targetKind === 'Domain').map(map => domainName(map.targetId)) : [item.source.area || 'Unknown area'];
      for (const group of labels.length ? labels : ['Unmapped architecture domain']) {
        if (!groups.has(group)) groups.set(group, []);
        groups.get(group).push(item);
      }
    }
    const table = `<section class="panel trans-timeline-scroll"><table class="trans-calendar"><thead><tr><th>Transformation stream</th>${months.map(month => `<th>${h(month)}</th>`).join('')}</tr></thead><tbody>${[...groups].sort(([a], [b]) => a.localeCompare(b)).map(([group, items]) => `<tr class="trans-group-row"><th colspan="${months.length + 1}">${h(group)}</th></tr>${items.map(item => `<tr><th>${open('Stream', item.id, label(item))}<small>${h(item.source.area)}</small></th>${months.map(month => {
      const inWindow = item.source.plannedStart && item.source.plannedEnd && month >= item.source.plannedStart.slice(0, 7) && month <= item.source.plannedEnd.slice(0, 7);
      const marked = item.source.monthMarkers.some(marker => marker.month === month);
      return `<td class="trans-month-cell${inWindow ? ' in-window' : ''}${marked ? ' source-marker' : ''}"><button type="button" data-action="open-trans-item" data-kind="Stream" data-id="${h(item.id)}" title="${h(label(item))} · ${h(month)}${marked ? ' · source marker' : ''}">${inWindow ? '●' : marked ? '◆' : '·'}</button></td>`;
    }).join('')}</tr>`).join('')}`).join('')}</tbody></table></section>`;
    return heading('Transformation portfolio', 'Monthly timeline', 'Select a stream to inspect its architecture context. Source markers remain separate from Start/End dates.') +
      `<div class="toolbar"><label>Group by <select id="trans-timeline-by">${['Project / TA', 'Architecture Domain', 'Location / Area'].map(value => `<option${value === mode ? ' selected' : ''}>${h(value)}</option>`).join('')}</select></label><span class="muted">Up to 48 months shown</span></div>` +
      (months.length ? table : '<section class="panel empty-state"><p>No dated streams yet.</p></section>');
  }
  function transProjects(data, ui) {
    const projects = active(data.transProjects), selected = byId(projects, ui.transProjectId) || projects[0];
    const streams = active(data.transStreams).filter(item => item.projectId === selected?.id);
    const activities = active(data.transActivities).filter(item => streams.some(stream => stream.id === item.streamId));
    const mappings = [...streams.flatMap(item => mapTargets(data, 'Stream', item.id)), ...activities.flatMap(item => mapTargets(data, 'Activity', item.id))];
    const dates = streams.flatMap(item => [item.source.plannedStart, item.source.plannedEnd]).filter(Boolean).sort();
    const domains = new Set(mappings.filter(map => map.targetKind === 'Domain').map(map => domainName(map.targetId)));
    const decisionIds = new Set(mappings.filter(map => map.targetKind === 'Decision').map(map => map.targetId));
    const llds = mappings.filter(map => map.targetKind === 'LLD' || (map.targetKind === 'Source' && byId(data.sources, map.targetId)?.type === 'LLD'));
    const branchIds = new Set(mappings.filter(map => map.targetKind === 'Branch').map(map => map.targetId));
    const validation = [...branchIds].map(id => { const branch = byId(data.branches, id), run = C.assurance.latestRun(data, id); return `${h(branch?.name || id)}: ${h(C.assurance.evaluateAcceptance(data, run?.id).status)}`; });
    return heading('Transformation portfolio', 'Projects / TAs', 'A project groups source streams; readiness comes from architect gates and linked architecture.') +
      `<div class="toolbar"><label>Project / TA <select id="trans-project">${projects.map(item => `<option value="${h(item.id)}"${item.id === selected?.id ? ' selected' : ''}>${h(item.name)}</option>`).join('')}</select></label></div>` +
      (!selected ? '<section class="panel empty-state"><p>No projects imported.</p></section>' : `<div class="metric-grid"><article class="metric"><span>Streams</span><strong>${streams.length}</strong></article><article class="metric"><span>Locations</span><strong>${new Set(streams.map(item => item.source.area)).size}</strong></article><article class="metric"><span>Architecture domains</span><strong>${domains.size}</strong></article><article class="metric"><span>Planned window</span><strong class="metric-label">${h(dates[0] || 'Unknown')} → ${h(dates.at(-1) || 'Unknown')}</strong></article></div><section class="panel"><h2>${h(selected.name)}</h2><p>Domains: ${h([...domains].join(', ') || 'Unmapped')}</p><p>Related decisions: ${[...decisionIds].map(id => h(byId(data.decisions, id)?.code || id)).join(', ') || 'None linked'} · LLD references: ${llds.length}</p><p>Outstanding dependencies: ${active(data.transDependencies).filter(dep => streams.some(stream => stream.id === dep.streamId) && !dep.targetStreamId).length}</p><p>Deployment validation state: ${validation.join(' · ') || 'No branches linked'}</p>${streams.map(item => `<div class="fact-row"><div>${open('Stream', item.id, label(item))}<small>${h(item.source.area)} · ${h(windowText(item))}</small></div><div>${badge(gate(data, 'Stream', item.id))}</div></div>`).join('')}</section>`);
  }
  function transWorkstreams(data, ui) {
    const streams = active(data.transStreams), selected = byId(streams, ui.transStreamId) || streams[0];
    const activities = active(data.transActivities).filter(item => item.streamId === selected?.id);
    const suggestions = active(data.transActivities).filter(item => !item.streamId && item.source.area && item.source.area.toLowerCase() === selected?.source.area.toLowerCase());
    return heading('Transformation portfolio', 'Workstreams', 'High-level source streams and explicitly linked detailed activities.') +
      `<div class="trans-two"><section class="panel"><h2>Streams</h2>${streams.map(item => `<div class="fact-row"><div>${open('Stream', item.id, label(item))}<small>${h(item.source.area)} · ${h(item.source.ta)}</small></div>${badge(gate(data, 'Stream', item.id))}</div>`).join('') || '<p class="muted">Import a plan to begin.</p>'}</section><section class="panel"><h2>${h(label(selected))}</h2>${selected ? `<p>${h(selected.source.scope)} · ${h(windowText(selected))}</p><p>Source category: ${h(selected.source.category || 'Unknown')}</p><p>${open('Stream', selected.id, 'Open architecture detail')}</p><h3>Linked detailed activities</h3>${activities.map(item => `<div class="fact-row"><div>${open('Activity', item.id, label(item))}<small>${h(item.source.phase)} · ${h(item.source.planningStatus)}</small></div>${badge(gate(data, 'Activity', item.id))}</div>`).join('') || '<p class="muted">No detailed activities linked by the architect.</p>'}<h3>Unlinked activities in this area</h3>${suggestions.map(item => `<div class="fact-row">${open('Activity', item.id, label(item))}<small>Review and link explicitly</small></div>`).join('') || '<p class="muted">None.</p>'}` : '<p class="muted">Select a stream.</p>'}</section></div>`;
  }
  function transMatrix(data) {
    const streams = active(data.transStreams), domains = C.transformation.DOMAINS;
    return heading('Transformation portfolio', 'Architecture impact matrix', '● is architect mapped. S is an exact source category suggestion awaiting architect mapping.') +
      `<section class="panel table-panel"><div class="table-scroll"><table class="data-table trans-matrix"><thead><tr><th>Transformation stream</th>${domains.map(domain => `<th>${h(domain.name)}</th>`).join('')}</tr></thead><tbody>${streams.map(stream => { const mapped = new Set(mapTargets(data, 'Stream', stream.id).filter(item => item.targetKind === 'Domain').map(item => item.targetId)); return `<tr><th>${open('Stream', stream.id, label(stream))}<small>${h(stream.source.area)}</small></th>${domains.map(domain => `<td>${mapped.has(domain.id) ? open('Stream', stream.id, '●', 'trans-matrix-hit') : stream.source.sourceDomainId === domain.id ? open('Stream', stream.id, 'S', 'trans-matrix-source') : '·'}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div></section>`;
  }
  function transDependencies(data) {
    const deps = active(data.transDependencies);
    return heading('Transformation portfolio', 'Cross-stream dependencies', 'Source dependency statements remain separate from architect-linked upstream streams and architecture objects.') +
      `<section class="panel"><div class="trans-dependency-list">${deps.map(dep => { const from = byId(data.transStreams, dep.streamId), to = byId(data.transStreams, dep.targetStreamId); return `<div class="trans-dependency"><div>${open('Stream', from.id, label(from))}<small>${h(from.source.area)}</small></div><div class="trans-dependency-arrow">→<small>${h(dep.sourceText)}</small></div><div>${to ? open('Stream', to.id, label(to)) : '<strong>Unresolved target</strong>'}<small>${to ? h(to.source.area) : 'Architect mapping needed'}</small></div><label>Link upstream stream <select data-dependency-id="${h(dep.id)}"><option value="">Unresolved</option>${active(data.transStreams).filter(item => item.id !== from.id).map(item => `<option value="${h(item.id)}"${item.id === dep.targetStreamId ? ' selected' : ''}>${h(label(item))} · ${h(item.source.area)}</option>`).join('')}</select></label></div>`; }).join('') || '<p class="muted">No source dependencies imported.</p>'}</div></section>`;
  }
  function transQuality(data) {
    const issues = latestIssues(data), imports = data.planImports.slice().reverse();
    return heading('Transformation portfolio', 'Data quality', 'Conflicts are flagged for review; source workbook values are never corrected automatically.') +
      `<section class="panel"><div class="section-head"><h2>Latest import warnings</h2>${badge(issues.length)}</div>${issues.map(issue => `<div class="fact-row"><div><strong>${h(issue.code)}</strong><small>${h(issue.sheet)} · row ${h(issue.row)} · ${h(issue.detail)}</small></div>${issue.entityKind === 'Plan' ? '<span class="muted">Review source identity</span>' : open(issue.entityKind, (issue.entityKind === 'Stream' ? data.transStreams : data.transActivities).find(item => item.sourceKey === issue.sourceKey)?.id || '', 'Inspect')}</div>`).join('') || '<p class="muted">No warnings in latest import.</p>'}</section><section class="panel"><h2>Import history</h2>${imports.map(item => `<div class="fact-row"><div><strong>${h(item.filename)}</strong><small>${h(item.importedAt)}</small></div><span>${item.new} new · ${item.changed} changed · ${item.removed} removed · ${item.warningCount} warnings</span></div>`).join('') || '<p class="muted">No workbook imported.</p>'}</section>`;
  }
  function mappingOptions(data) {
    const groups = [
      ['Domain', C.transformation.DOMAINS.map(item => [item.id, item.name])], ['Site', data.sites.map(item => [item.id, item.name])],
      ['Branch', data.branches.map(item => [item.id, item.name])], ['Component', data.components.map(item => [item.id, item.name])],
      ['Branch Pattern', data.branchPatterns.map(item => [item.id, item.name])], ['Decision', data.decisions.map(item => [item.id, `${item.code} · ${item.title}`])],
      ['Dependency', data.dependencies.map(item => [item.id, item.description])], ['Source', data.sources.map(item => [item.id, `${item.type} · ${item.title}`])],
    ];
    return groups.map(([kind, items]) => `<optgroup label="${h(kind)}">${items.map(([id, name]) => `<option value="${h(kind)}:${h(id)}">${h(name)}</option>`).join('')}</optgroup>`).join('') +
      `<optgroup label="References"><option value="HLD:">HLD reference</option><option value="LLD:">LLD reference</option><option value="Validation Requirement:">Validation requirement</option></optgroup>`;
  }
  function mappingName(data, map) {
    if (map.targetKind === 'Domain') return domainName(map.targetId);
    const collections = { Site: 'sites', Branch: 'branches', Component: 'components', 'Branch Pattern': 'branchPatterns', Decision: 'decisions', Dependency: 'dependencies', Source: 'sources' };
    const target = byId(data[collections[map.targetKind]] || [], map.targetId);
    return target?.name || target?.title || target?.description || map.reference;
  }
  function transDetail(data, ui) {
    const kind = ui.transKind === 'Activity' ? 'Activity' : 'Stream', item = byId(kind === 'Stream' ? data.transStreams : data.transActivities, ui.transItemId);
    if (!item) return heading('Transformation portfolio', 'Architecture detail', 'Select a stream or activity first.');
    const maps = mapTargets(data, kind, item.id), source = item.source;
    const suggestedSite = data.sites.find(site => site.name.trim().toLowerCase() === source.area.trim().toLowerCase());
    const dep = kind === 'Stream' ? active(data.transDependencies).filter(value => value.streamId === item.id) : [];
    return heading('Transformation portfolio', label(item), 'Source planning context and architect enrichment are separate.') +
      (kind === 'Stream' && maps.some(map => map.targetKind === 'Component') ? `<div class="toolbar"><button type="button" class="button button-primary" data-action="show-trans-topology" data-id="${h(item.id)}">Highlight affected topology nodes</button></div>` : '') +
      `<div class="trans-two"><section class="panel"><div class="section-head"><div><p class="eyebrow">Source planning data · ${h(source.originalSheet || source.sheet)} row ${source.row}</p><h2>Workbook values</h2></div></div>${Object.entries(source.values).map(([key, value]) => `<div class="fact-row"><span>${h(key)}</span><strong>${h(value || '—')}</strong></div>`).join('')}<p class="muted">Parsed planned window: ${h(windowText(item))}</p>${source.sourceDomainId ? `<p>Source category suggests ${h(domainName(source.sourceDomainId))}; architect mapping is separate.</p>` : ''}${suggestedSite ? `<p>Transformation area matches site ${h(suggestedSite.name)}; link it under Architecture mappings if appropriate.</p>` : ''}${source.monthMarkers?.length ? `<p>Source markers: ${source.monthMarkers.map(marker => `${h(marker.label)}=${h(marker.value)}`).join(' · ')}</p>` : ''}</section>` +
      `<section class="panel"><div class="section-head"><div><p class="eyebrow">Architecture enrichment</p><h2>Gate and mappings</h2></div>${badge(gate(data, kind, item.id))}</div><form id="trans-gate-form" class="assurance-form"><input type="hidden" name="kind" value="${h(kind)}"><input type="hidden" name="id" value="${h(item.id)}"><label>Architecture gate <select name="gate">${C.transformation.GATES.map(value => `<option${value === gate(data, kind, item.id) ? ' selected' : ''}>${h(value)}</option>`).join('')}</select></label><label>Architect note <input name="note" maxlength="500" value="${h(data.transGates.find(value => value.ownerKind === kind && value.ownerId === item.id)?.note || '')}"></label><button type="submit" class="button button-primary">Save gate</button></form><h3>Architecture mappings</h3>${maps.map(map => `<div class="fact-row"><div><strong>${h(map.targetKind)}</strong><small>${h(mappingName(data, map))}</small>${map.targetId ? `<button type="button" class="text-link" data-action="navigate-trans-map" data-id="${h(map.id)}">Open architecture</button>` : ''}</div><button type="button" class="button button-small" data-action="remove-trans-map" data-id="${h(map.id)}">Remove</button></div>`).join('') || '<p class="muted">No architecture objects linked.</p>'}<form id="trans-map-form" class="assurance-form"><input type="hidden" name="kind" value="${h(kind)}"><input type="hidden" name="id" value="${h(item.id)}"><label>Target <select name="target">${mappingOptions(data)}</select></label><label>Reference (for HLD, LLD or validation requirement) <input name="reference" maxlength="300"></label><button type="submit" class="button button-primary">Add mapping</button></form>${kind === 'Activity' ? `<label>Related high-level stream <select id="trans-activity-stream" data-id="${h(item.id)}"><option value="">Unlinked</option>${active(data.transStreams).map(stream => `<option value="${h(stream.id)}"${stream.id === item.streamId ? ' selected' : ''}>${h(label(stream))} · ${h(stream.source.area)}</option>`).join('')}</select></label>` : ''}</section></div>` +
      (kind === 'Stream' ? `<section class="panel"><h2>Dependencies and detailed activities</h2>${dep.map(value => `<div class="fact-row"><span>${h(value.sourceText)}</span>${value.targetStreamId ? open('Stream', value.targetStreamId, label(byId(data.transStreams, value.targetStreamId))) : badge('Unresolved')}</div>`).join('') || '<p class="muted">No source dependencies.</p>'}${active(data.transActivities).filter(value => value.streamId === item.id).map(value => `<div class="fact-row">${open('Activity', value.id, label(value))}<span>${h(value.source.planningStatus)} · ${h(gate(data, 'Activity', value.id))}</span></div>`).join('') || '<p class="muted">No detailed activities linked.</p>'}</section><section class="panel"><div class="section-head"><h2>Architecture risks</h2><button type="button" class="button button-small" data-action="open-risk-stream" data-id="${h(item.id)}">Review interventions</button></div><p>${data.architectureRisks.filter(value => value.ownerKind === 'Stream' && value.ownerId === item.id && value.status !== 'Resolved').length} open assessments linked to this workstream.</p></section>` : '');
  }
  C.transViews = Object.freeze({ transformation, transTimeline, transProjects, transWorkstreams, transMatrix, transDependencies, transQuality, transDetail });
})();
