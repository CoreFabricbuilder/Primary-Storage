/* File-open browser controller. Persistent writes go through the local storage adapter. */
(() => {
  'use strict';
  const C = window.Cockpit;
  const ui = {
    data: null, screen: 'overview', state: 'Current', domainFilter: null,
    selectedComponentId: null, selectedSiteId: null, selectedDecisionId: null,
    selectedBranchId: null, decisionSearch: '', camera: null, topologyController: null,
    photoUrls: [], renderToken: 0, busy: false,
  };
  const el = id => document.getElementById(id);
  const status = message => { el('save-status').textContent = message; };
  let toastTimer;

  function toast(message, isError = false) {
    const element = el('toast');
    element.textContent = message;
    element.classList.toggle('error', isError);
    element.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove('visible'), 4500);
  }
  function failure(error) {
    console.error(error);
    status('Local storage error');
    toast(error.message || 'An unexpected error occurred.', true);
  }
  function releasePhotoUrls() {
    ui.photoUrls.forEach(url => URL.revokeObjectURL(url));
    ui.photoUrls = [];
  }
  function render() {
    if (!ui.data) return;
    releasePhotoUrls();
    const token = ++ui.renderToken;
    const data = ui.data;
    el('workspace-name').textContent = data.programme.name;
    el('demo-tag').hidden = !data.programme.isDemo;
    el('banner').hidden = !data.programme.isDemo;
    el('banner').textContent = data.programme.isDemo ? 'Synthetic demonstration workspace · all example names and addresses are illustrative.' : '';
    document.querySelectorAll('[data-screen]').forEach(button => {
      const active = button.dataset.screen === ui.screen;
      button.classList.toggle('active', active);
      button.setAttribute('aria-current', active ? 'page' : 'false');
    });
    document.querySelectorAll('[data-state]').forEach(button => {
      button.setAttribute('aria-pressed', button.dataset.state === ui.state ? 'true' : 'false');
    });
    el('content').innerHTML = C.views[ui.screen](data, ui);
    if (ui.screen === 'topology') {
      ui.topologyController = C.topology.mount(el('topology-svg'), data, ui.state, ui.domainFilter, ui.selectedComponentId, id => {
        ui.camera = ui.topologyController.getCamera();
        ui.selectedComponentId = id;
        render();
      }, ui.camera);
    } else ui.topologyController = null;
    if (ui.screen === 'branches') showPhotos(token).catch(failure);
    if (ui.screen === 'decisions' && ui.decisionSearch) filterDecisions();
  }
  function navigate(screen) {
    if (!Object.hasOwn(C.views, screen) || screen === 'h' || screen === 'badge' || screen === 'sourceName') return;
    ui.screen = screen;
    ui.camera = null;
    render();
    el('content').focus({ preventScroll: true });
  }
  async function persist(next, message) {
    C.model.validateWorkspace(next);
    await C.storage.saveWorkspace(next);
    ui.data = next;
    status('Saved in this browser');
    render();
    toast(message);
  }
  function filterDecisions() {
    const query = ui.decisionSearch.trim().toLowerCase();
    document.querySelectorAll('#decision-items [data-search]').forEach(item => { item.hidden = !item.dataset.search.includes(query); });
  }
  async function showPhotos(token) {
    const branch = ui.data.branches.find(item => item.id === ui.selectedBranchId) || ui.data.branches[0];
    const gallery = el('photo-gallery');
    if (!branch || !gallery) return;
    const photos = await C.storage.getPhotos(branch.id);
    if (token !== ui.renderToken || !el('photo-gallery')) return;
    gallery.replaceChildren();
    if (!photos.length) {
      const empty = document.createElement('p'); empty.className = 'muted'; empty.textContent = 'No photographs have been added to this branch.';
      gallery.append(empty); return;
    }
    for (const photo of photos) {
      const card = document.createElement('article'); card.className = 'photo-card';
      const image = document.createElement('img');
      const url = URL.createObjectURL(photo.blob); ui.photoUrls.push(url);
      image.src = url; image.alt = photo.name; image.loading = 'lazy';
      const title = document.createElement('strong'); title.textContent = photo.name;
      const detail = document.createElement('small');
      const device = ui.data.devices.find(item => item.id === photo.deviceId);
      detail.textContent = `${device?.name || 'Branch'} · ${photo.classification} · ${photo.sourceLabel}`;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'text-link';
      button.dataset.action = 'remove-photo'; button.dataset.id = photo.id; button.textContent = 'Remove photograph';
      card.append(image, title, detail, button); gallery.append(card);
    }
  }
  async function exportBackup() {
    status('Preparing JSON backup…');
    const backup = await C.storage.createBackup(ui.data);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `network-refresh-cockpit-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    status('Saved in this browser'); toast('JSON backup downloaded, including local photographs.');
  }
  async function importBackup(file) {
    if (!file) return;
    if (file.size > 150 * 1024 * 1024) throw new Error('Backup exceeds the 150 MB import limit.');
    const backup = C.storage.parseBackup(await file.text());
    if (!window.confirm(`Restore “${backup.workspace.programme.name}” and ${backup.photos.length} photographs? This replaces this browser's current cockpit data.`)) return;
    await C.storage.restoreBackup(backup);
    ui.data = backup.workspace;
    ui.screen = 'overview'; ui.state = 'Current'; ui.domainFilter = null; ui.camera = null;
    ui.selectedComponentId = null; ui.selectedSiteId = null; ui.selectedDecisionId = null; ui.selectedBranchId = null;
    render(); status('Restored in this browser'); toast('JSON backup restored.');
  }
  async function uploadPhotos(files) {
    if (!files.length) return;
    const branch = ui.data.branches.find(item => item.id === ui.selectedBranchId) || ui.data.branches[0];
    if (!branch) throw new Error('Select a branch before adding photographs.');
    const deviceId = el('photo-device')?.value || null;
    const photos = files.map(file => ({
      id: C.model.newId(), branchId: branch.id, deviceId, name: file.name,
      type: file.type, blob: file, addedAt: new Date().toISOString(),
      note: '', sourceLabel: 'User-selected photograph', classification: 'Observed',
    }));
    await C.storage.addPhotos(photos, ui.data);
    status('Photographs saved in this browser'); toast(`${photos.length} photograph${photos.length === 1 ? '' : 's'} saved.`);
    render();
  }
  async function action(button) {
    const id = button.dataset.id;
    switch (button.dataset.action) {
      case 'open-domain': ui.domainFilter = id; ui.selectedComponentId = null; navigate('topology'); break;
      case 'open-decision': case 'select-decision': ui.selectedDecisionId = id; navigate('decisions'); break;
      case 'open-dependency': ui.selectedComponentId = id; navigate('dependencies'); break;
      case 'open-readiness': ui.selectedSiteId = id; navigate('readiness'); break;
      case 'open-branch': ui.selectedBranchId = id; render(); break;
      case 'zoom-in': ui.topologyController?.zoomIn(); break;
      case 'zoom-out': ui.topologyController?.zoomOut(); break;
      case 'zoom-fit': ui.topologyController?.fit(); break;
      case 'new-decision': ui.selectedDecisionId = null; ui.decisionSearch = ''; render(); el('decision-form')?.querySelector('[name=title]')?.focus(); break;
      case 'save-readiness': {
        const row = button.closest('[data-readiness-row]');
        const current = ui.data.lldReadiness.find(item => item.id === id);
        const fields = { status: row.querySelector('[data-field=status]').value, classification: row.querySelector('[data-field=classification]').value, note: row.querySelector('[data-field=note]').value, sourceId: current.sourceId };
        await persist(C.model.updateReadiness(ui.data, id, fields), 'LLD readiness saved.'); break;
      }
      case 'toggle-dependency': {
        const current = ui.data.dependencies.find(item => item.id === id);
        await persist(C.model.updateDependency(ui.data, id, current.status === 'Resolved' ? 'Unresolved' : 'Resolved'), 'Dependency updated.'); break;
      }
      case 'upload-photo': el('photo-file').click(); break;
      case 'remove-photo':
        if (window.confirm('Remove this photograph from this browser?')) {
          await C.storage.removePhoto(id); render(); toast('Photograph removed.');
        }
        break;
    }
  }
  async function saveDecision(form) {
    const values = new FormData(form);
    const fields = {
      id: String(values.get('id') || ''), code: String(values.get('code') || '').trim(),
      title: String(values.get('title') || '').trim(), domainId: String(values.get('domainId') || ''),
      status: String(values.get('status') || ''), date: String(values.get('date') || ''),
      decision: String(values.get('decision') || '').trim(), rationale: String(values.get('rationale') || '').trim(),
      classification: String(values.get('classification') || ''),
      supersededDecisionId: String(values.get('supersededDecisionId') || '') || null,
      affectedComponentIds: values.getAll('affectedComponentIds').map(String),
      sourceId: String(values.get('sourceId') || '') || null,
      sourceLabel: String(values.get('sourceLabel') || '').trim(),
    };
    if (!fields.code || !fields.title) throw new Error('Decision ID and title are required.');
    const result = C.model.upsertDecision(ui.data, fields);
    ui.selectedDecisionId = result.id;
    await persist(result.data, 'Architecture decision saved.');
  }
  function run(task) {
    if (ui.busy) return;
    ui.busy = true;
    Promise.resolve().then(task).catch(failure).finally(() => { ui.busy = false; });
  }
  document.addEventListener('click', event => {
    const screen = event.target.closest('[data-screen]');
    if (screen) { navigate(screen.dataset.screen); return; }
    const state = event.target.closest('[data-state]');
    if (state) { ui.state = state.dataset.state; ui.camera = null; render(); return; }
    const button = event.target.closest('[data-action]');
    if (button) { run(() => action(button)); return; }
    if (event.target.closest('#export-button')) { run(exportBackup); return; }
    if (event.target.closest('#import-button')) el('import-file').click();
  });
  document.addEventListener('change', event => {
    const target = event.target;
    if (target.id === 'domain-filter') { ui.domainFilter = target.value || null; ui.selectedComponentId = null; ui.camera = null; render(); }
    if (target.id === 'readiness-site') { ui.selectedSiteId = target.value; render(); }
    if (target.id === 'dependency-component') { ui.selectedComponentId = target.value; render(); }
    if (target.id === 'import-file') { const file = target.files[0]; target.value = ''; run(() => importBackup(file)); }
    if (target.id === 'photo-file') { const files = [...target.files]; target.value = ''; run(() => uploadPhotos(files)); }
  });
  document.addEventListener('input', event => {
    if (event.target.id === 'decision-search') { ui.decisionSearch = event.target.value; filterDecisions(); }
  });
  document.addEventListener('submit', event => {
    if (event.target.id === 'decision-form') { event.preventDefault(); run(() => saveDecision(event.target)); }
  });
  async function init() {
    try {
      await C.storage.open();
      ui.data = await C.storage.getWorkspace();
      if (!ui.data) { ui.data = C.demo.create(); await C.storage.saveWorkspace(ui.data); }
      status('Saved in this browser'); render();
    } catch (error) {
      failure(error);
      el('content').innerHTML = '<section class="panel empty-state"><h1>Local storage could not be opened</h1><p>Use a current macOS browser with IndexedDB enabled. Browser private mode or file access settings may prevent persistent storage.</p></section>';
    }
  }
  init();
})();
