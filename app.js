import { starter, kinds, lifecycles, relationTypes, storageKey, copy, validateModel, addElement, updateElement, removeElement, addRelation, removeRelation, metrics } from './model.js';

const icons = { Capability: '◈', Application: '▣', Data: '▤', Technology: '◇' };
const plurals = { Capability: 'Capabilities', Application: 'Applications', Data: 'Data assets', Technology: 'Technologies' };
const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const read = () => { try { const saved = localStorage.getItem(storageKey); return saved ? validateModel(JSON.parse(saved)) : copy(starter); } catch { return copy(starter); } };
let model = read();
let view = 'overview';
let search = '';
let kindFilter = 'All layers';
let selectedId = null;
let toastTimer;

function persist(next) {
  model = next;
  try { localStorage.setItem(storageKey, JSON.stringify(model)); } catch { toast('Browser storage is unavailable. Export a copy of your work.'); }
  render();
}

function toast(message) {
  const node = $('#toast'); node.textContent = message; node.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('show'), 3200);
}

const kindClass = kind => kind.toLowerCase();
const badge = lifecycle => `<span class="badge ${kindClass(lifecycle)}">${escape(lifecycle)}</span>`;
const kindIcon = kind => `<span class="kind-dot ${kindClass(kind)}">${icons[kind]}</span>`;
const nameOf = id => model.elements.find(item => item.id === id)?.name || 'Unknown';
const heading = (eyebrow, title, subtitle, actions = '') => `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p>${subtitle}</p></div><div class="heading-actions">${actions}</div></div>`;

function render() {
  $('#workspace-name').textContent = model.name;
  $('#breadcrumb-current').textContent = ({ overview: 'OVERVIEW', inventory: 'ARCHITECTURE INVENTORY', map: 'RELATIONSHIP MAP' })[view];
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.view === view));
  $('#content').innerHTML = view === 'overview' ? overview() : view === 'inventory' ? inventory() : mapView();
  if (view === 'inventory') { const input = $('#search'); input.value = search; $('#kind-filter').value = kindFilter; }
}

function overview() {
  const m = metrics(model);
  const coverage = m.totalCapabilities ? Math.round(m.covered / m.totalCapabilities * 100) : 0;
  const stats = [['Capability', m.capabilities, 'Business outcomes'], ['Application', m.applications, 'Systems in scope'], ['Data', m.data, 'Information assets'], ['Technology', m.technology, 'Platform components']];
  const unserved = model.elements.filter(item => item.kind === 'Capability' && !model.relations.some(rel => rel.to === item.id && rel.type === 'supports' && model.elements.some(source => source.id === rel.from && source.kind === 'Application' && source.lifecycle === 'Active')));
  return heading('Architecture at a glance', 'Your enterprise, in focus', 'Understand what exists, how it connects, and where to focus next.', '<button class="button button-primary" data-action="add-element">＋ Add element</button>') +
    `<div class="stats">${stats.map(([kind, count, sub]) => `<div class="stat-card"><div class="stat-top"><span class="stat-label">${plurals[kind]}</span><span class="stat-icon ${kindClass(kind)}">${icons[kind]}</span></div><div class="stat-value">${count}</div><div class="stat-sub">${sub}</div></div>`).join('')}</div>` +
    `<div class="section-grid"><section class="panel"><div class="panel-head"><div><h2>Architecture layers</h2><p>Elements across your enterprise model</p></div><button class="text-link" data-view="inventory">View inventory →</button></div>${stats.map(([kind,count]) => `<div class="layer-row"><span class="layer-icon stat-icon ${kindClass(kind)}">${icons[kind]}</span><span class="layer-name">${kind === 'Data' ? 'Data' : plurals[kind]}</span><span class="layer-count">${count} elements</span></div>`).join('')}</section><section class="panel"><div class="panel-head"><div><h2>Capability coverage</h2><p>Supported by active applications</p></div></div><div class="coverage-number">${coverage}% <small>${m.covered} of ${m.totalCapabilities} covered</small></div><div class="progress"><div class="progress-fill" style="width:${coverage}%"></div></div><div class="coverage-foot">Connect active applications to capabilities to track coverage.</div><ul class="alert-list"><li><span>Uncovered capabilities</span><strong>${unserved.length}</strong></li><li><span>Retiring elements</span><strong>${m.retiring}</strong></li><li><span>Relationships mapped</span><strong>${m.relations}</strong></li></ul></section></div>` +
    `<section class="panel recent-panel"><div class="panel-head"><div><h2>Elements to review</h2><p>Uncovered capabilities and retiring systems</p></div><button class="text-link" data-view="map">Explore map →</button></div>${reviewTable([...unserved, ...model.elements.filter(item => item.lifecycle === 'Retiring')].slice(0, 5))}</section>`;
}

function reviewTable(items) {
  if (!items.length) return '<div class="empty-state"><div class="empty-icon">✦</div><strong>Nothing needs attention</strong>Your capability coverage is complete and there are no retiring elements.</div>';
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>ELEMENT</th><th>LAYER</th><th>OWNER</th><th>STATUS</th></tr></thead><tbody>${items.map(item => `<tr><td class="name-cell"><div class="table-name">${kindIcon(item.kind)}${escape(item.name)}</div></td><td>${escape(item.kind)}</td><td>${escape(item.owner) || '<span class="muted">Unassigned</span>'}</td><td>${badge(item.lifecycle)}</td></tr>`).join('')}</tbody></table></div>`;
}

function inventory() {
  const term = search.trim().toLowerCase();
  const items = model.elements.filter(item => (kindFilter === 'All layers' || item.kind === kindFilter) && (!term || [item.name, item.owner, item.description].some(value => value.toLowerCase().includes(term))));
  return heading('Architecture inventory', 'All elements', 'A single view of the capabilities, systems, data, and technology that shape your enterprise.', '<button class="button button-quiet" data-action="import">↥ Import JSON</button><button class="button button-primary" data-action="add-element">＋ Add element</button>') +
    `<div class="toolbar"><label class="search">⌕ <input id="search" type="search" aria-label="Search elements" placeholder="Search elements or owners..."></label><select id="kind-filter" class="filter" aria-label="Filter by layer"><option>All layers</option>${kinds.map(kind => `<option>${kind}</option>`).join('')}</select><span class="muted" style="font-size:11px">${items.length} of ${model.elements.length} elements</span></div>` +
    `<div class="panel table-panel">${items.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>ELEMENT</th><th>LAYER</th><th>OWNER</th><th>LIFECYCLE</th><th>RELATIONS</th><th>ACTIONS</th></tr></thead><tbody>${items.map(item => `<tr><td class="name-cell"><div class="table-name">${kindIcon(item.kind)}<span title="${escape(item.description)}">${escape(item.name)}</span></div></td><td>${escape(item.kind)}</td><td>${escape(item.owner) || '<span class="muted">Unassigned</span>'}</td><td>${badge(item.lifecycle)}</td><td>${model.relations.filter(rel => rel.from === item.id || rel.to === item.id).length}</td><td><div class="table-actions"><button class="button button-small" data-action="edit-element" data-id="${escape(item.id)}">Edit</button><button class="button button-small button-danger" data-action="delete-element" data-id="${escape(item.id)}">Delete</button></div></td></tr>`).join('')}</tbody></table></div>` : `<div class="empty-state"><div class="empty-icon">◇</div><strong>No elements found</strong>Try a different search or add a new element.</div>`}</div>`;
}

function mapView() {
  const selected = model.elements.find(item => item.id === selectedId);
  const connected = selected ? model.relations.filter(rel => rel.from === selected.id || rel.to === selected.id) : [];
  return heading('Relationship map', 'See how it all connects', 'Select an element to inspect the relationships that bring your architecture together.', '<button class="button button-primary" data-action="add-relation">＋ Add relationship</button>') +
    `<div class="map-layout"><section class="panel map-panel"><div class="map-grid">${kinds.map(kind => `<div><h2 class="map-column-title">${kind === 'Data' ? 'Data' : plurals[kind]}</h2>${model.elements.filter(item => item.kind === kind).map(item => `<button class="map-card ${kindClass(kind)} ${item.id === selectedId ? 'selected' : ''}" data-action="select-element" data-id="${escape(item.id)}"><strong>${escape(item.name)}</strong><small>${escape(item.owner) || 'Unassigned'}</small></button>`).join('') || '<p class="muted" style="font-size:11px">No elements yet</p>'}</div>`).join('')}</div><p class="map-footer">${model.elements.length} elements · ${model.relations.length} relationships</p></section><aside class="panel detail-panel">${selected ? `<p class="eyebrow">${escape(selected.kind)} · ${escape(selected.lifecycle)}</p><h3>${escape(selected.name)}</h3><p>${escape(selected.description) || 'No description added.'}</p><p><strong>Owner:</strong> ${escape(selected.owner) || 'Unassigned'}</p><div class="panel-head" style="margin:22px 0 0"><h2>Connections (${connected.length})</h2></div>${connected.length ? `<ul class="relation-list">${connected.map(rel => `<li><span>${rel.from === selected.id ? `→ ${escape(rel.type)} <strong>${escape(nameOf(rel.to))}</strong>` : `← <strong>${escape(nameOf(rel.from))}</strong> ${escape(rel.type)}`}</span><button data-action="delete-relation" data-id="${escape(rel.id)}" aria-label="Remove relationship">Remove</button></li>`).join('')}</ul>` : '<p>No relationships yet. Add one to connect this element.</p>'}<button class="button button-small" data-action="edit-element" data-id="${escape(selected.id)}">Edit element</button>` : '<div class="empty-state"><div class="empty-icon">◇</div><strong>Choose an element</strong>Select any card to view its details and connections.</div>'}</aside></div>`;
}

function openElement(id = null) {
  const item = model.elements.find(value => value.id === id);
  const form = $('#element-form'); form.reset();
  form.elements.kind.innerHTML = kinds.map(kind => `<option>${kind}</option>`).join('');
  form.elements.lifecycle.innerHTML = lifecycles.map(status => `<option>${status}</option>`).join('');
  for (const field of ['id','name','kind','lifecycle','owner','description']) form.elements[field].value = item?.[field] || (field === 'lifecycle' ? 'Active' : '');
  $('#element-eyebrow').textContent = item ? 'EDIT ELEMENT' : 'NEW ELEMENT';
  $('#element-title').textContent = item ? 'Edit element' : 'Add an element';
  $('#element-dialog').showModal(); form.elements.name.focus();
}

function openRelation() {
  if (model.elements.length < 2) { toast('Add at least two elements before connecting them.'); return; }
  const options = model.elements.map(item => `<option value="${escape(item.id)}">${escape(item.name)} · ${escape(item.kind)}</option>`).join('');
  const form = $('#relation-form'); form.elements.from.innerHTML = options; form.elements.to.innerHTML = options;
  form.elements.type.innerHTML = relationTypes.map(type => `<option>${type}</option>`).join('');
  if (selectedId) form.elements.from.value = selectedId;
  form.elements.to.selectedIndex = model.elements.findIndex(item => item.id !== form.elements.from.value);
  $('#relation-error').textContent = '';
  $('#relation-dialog').showModal();
}

document.addEventListener('click', event => {
  const target = event.target.closest('[data-view], [data-action], .close-dialog');
  if (!target) return;
  if (target.classList.contains('close-dialog')) { target.closest('dialog').close(); return; }
  if (target.dataset.view) { view = target.dataset.view; render(); return; }
  const { action, id } = target.dataset;
  if (action === 'add-element') openElement();
  if (action === 'edit-element') openElement(id);
  if (action === 'delete-element') { const item = model.elements.find(value => value.id === id); if (item && confirm(`Delete “${item.name}” and its relationships?`)) { persist(removeElement(model, id)); toast('Element removed.'); } }
  if (action === 'add-relation') openRelation();
  if (action === 'select-element') { selectedId = id; render(); }
  if (action === 'delete-relation') { persist(removeRelation(model, id)); toast('Relationship removed.'); }
  if (action === 'import') $('#import-file').click();
});

$('#element-form').addEventListener('submit', event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  const { id, ...fields } = data; fields.name = fields.name.trim(); fields.owner = fields.owner.trim(); fields.description = fields.description.trim();
  try { persist(id ? updateElement(model, id, fields) : addElement(model, fields)); $('#element-dialog').close(); toast(id ? 'Element updated.' : 'Element added.'); } catch (error) { toast(error.message); }
});

$('#relation-form').addEventListener('submit', event => {
  event.preventDefault();
  const fields = Object.fromEntries(new FormData(event.currentTarget));
  try { persist(addRelation(model, fields)); $('#relation-dialog').close(); toast('Relationship added.'); } catch (error) { $('#relation-error').textContent = error.message; }
});

$('#content').addEventListener('input', event => { if (event.target.id === 'search') { const cursor = event.target.selectionStart; search = event.target.value; render(); $('#search').focus(); $('#search').setSelectionRange(cursor, cursor); } });
$('#content').addEventListener('change', event => { if (event.target.id === 'kind-filter') { kindFilter = event.target.value; render(); } });

$('#export-button').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = 'enterprise-architecture.json'; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000); toast('Workspace exported.');
});

$('#import-file').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try { const incoming = validateModel(JSON.parse(await file.text())); if (confirm(`Replace this workspace with “${incoming.name}” from ${file.name}?`)) { selectedId = null; persist(incoming); toast('Workspace imported.'); } }
  catch (error) { toast(`Import failed: ${error.message}`); }
  event.target.value = '';
});

render();
