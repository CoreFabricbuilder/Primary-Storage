/* File-open browser controller. Persistent writes go through the local storage adapter. */
(() => {
  'use strict';
  const C = window.Cockpit;
  const ui = {
    data: null, screen: 'overview', state: 'Current', domainFilter: null,
    selectedComponentId: null, selectedSiteId: null, selectedDecisionId: null,
    selectedBranchId: null, selectedPatternId: null, newBranch: false, assuranceBranchId: null, selectedRunId: null, selectedBaselineId: null,
    decisionSearch: '', camera: null, topologyController: null,
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
    if (ui.screen === 'branches') { showPhotos(token).catch(failure); updateEvidenceInput(); }
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
    for (const photo of photos) {
      const evidence = ui.data.branchEvidence.find(item => item.type === 'Photograph' && item.photoId === photo.id);
      if (!evidence) continue;
      const card = document.createElement('article'); card.className = 'photo-card';
      const image = document.createElement('img');
      const url = URL.createObjectURL(photo.blob); ui.photoUrls.push(url);
      image.src = url; image.alt = photo.name; image.loading = 'lazy';
      const title = document.createElement('strong'); title.textContent = photo.name;
      const detail = document.createElement('small');
      const target = C.model.branchEvidenceTargets(ui.data, branch.id).find(item => item.kind === evidence.objectKind && item.id === evidence.objectId);
      detail.textContent = `${target?.label || evidence.objectKind} · ${evidence.classification} · ${evidence.source}`;
      card.append(image, title, detail); gallery.append(card);
    }
  }
  function updateEvidenceInput() {
    const input = el('evidence-photo-file');
    const type = el('evidence-type');
    if (!input || !type) return;
    input.required = type.value === 'Photograph';
    input.closest('label').hidden = type.value !== 'Photograph';
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
    ui.selectedComponentId = null; ui.selectedSiteId = null; ui.selectedDecisionId = null; ui.selectedBranchId = null; ui.selectedPatternId = null; ui.newBranch = false;
    ui.assuranceBranchId = null; ui.selectedRunId = null; ui.selectedBaselineId = null;
    render(); status('Restored in this browser'); toast('JSON backup restored.');
  }
  async function saveBranchSummary(form) {
    const values = new FormData(form);
    const next = C.model.updateBranch(ui.data, String(values.get('branchId')), {
      siteCode: String(values.get('siteCode') || '').trim(),
      locationDescription: String(values.get('locationDescription') || '').trim(),
      patternId: String(values.get('patternId') || ''),
      currentStateConfidence: String(values.get('currentStateConfidence') || ''),
      deploymentReadiness: String(values.get('deploymentReadiness') || ''),
      validationStatus: String(values.get('validationStatus') || ''),
    });
    await persist(next, 'Branch summary saved.');
  }
  async function createBranch(form) {
    const values = new FormData(form);
    const result = C.model.createBranch(ui.data, {
      name: String(values.get('name') || '').trim(), siteCode: String(values.get('siteCode') || '').trim(),
      patternId: String(values.get('patternId') || ''),
    });
    ui.selectedBranchId = result.id;
    ui.newBranch = false;
    await persist(result.data, 'Branch created with Unknown architecture values.');
  }
  async function saveAsset(form) {
    const values = new FormData(form);
    const type = form.dataset.assetForm;
    const fields = Object.fromEntries([...values].map(([key, value]) => [key, String(value).trim()]));
    const result = C.model.addBranchAsset(ui.data, fields.branchId, type, fields);
    await persist(result.data, `${type} added to branch.`);
  }
  async function saveAttribute(row) {
    const branch = ui.data.branches.find(item => item.id === ui.selectedBranchId) || ui.data.branches[0];
    const value = field => row.querySelector(`[data-field=${field}]`).value.trim();
    const next = C.model.upsertBranchAttribute(ui.data, {
      branchId: branch.id, category: row.dataset.category, key: row.dataset.key,
      value: value('value'), classification: value('classification'), source: value('source'), note: value('note'),
    });
    await persist(next, `${row.dataset.category} item saved.`);
  }
  async function saveEvidence(form) {
    const values = new FormData(form);
    const branchId = String(values.get('branchId'));
    const [objectKind, objectId] = String(values.get('target') || '').split('|');
    const type = String(values.get('type') || '');
    const file = form.querySelector('#evidence-photo-file').files[0];
    if (type === 'Photograph' && !file) throw new Error('Select a photograph to add.');
    if (type !== 'Photograph' && file) throw new Error('Choose Photograph as the evidence type for an image file.');
    const photoId = file ? C.model.newId() : null;
    const fields = { branchId, type, objectKind, objectId, photoId,
      source: String(values.get('source') || '').trim(), date: String(values.get('date') || ''),
      classification: String(values.get('classification') || ''), confidence: String(values.get('confidence') || ''),
      notes: String(values.get('notes') || '').trim(),
    };
    const result = C.model.upsertBranchEvidence(ui.data, fields);
    if (file) {
      const photo = { id: photoId, branchId, deviceId: ['Device', 'Wireless AP', 'Switch'].includes(objectKind) ? objectId : null,
        name: file.name, type: file.type, blob: file, addedAt: new Date().toISOString(),
        note: fields.notes, sourceLabel: fields.source, classification: fields.classification,
      };
      await C.storage.saveEvidenceWithPhotos(result.data, [photo]);
      ui.data = result.data; status('Saved in this browser'); render(); toast('Photograph evidence saved.');
    } else await persist(result.data, 'Branch evidence saved.');
  }
  async function savePattern(form) {
    const values = new FormData(form);
    const expectations = Object.fromEntries(C.model.expectationKeys.map(key => [key, String(values.get(key) || '').trim() || null]));
    const result = C.model.upsertPattern(ui.data, {
      id: String(values.get('id') || ''), code: String(values.get('code') || '').trim(),
      name: String(values.get('name') || '').trim(), description: String(values.get('description') || '').trim(),
      intendedUse: String(values.get('intendedUse') || '').trim(), expectations,
    });
    ui.selectedPatternId = result.id;
    await persist(result.data, 'Branch pattern saved.');
  }
  async function saveAssuranceObservation(form) {
    const values = new FormData(form);
    const result = C.assurance.recordObservation(ui.data, {
      branchId: String(values.get('branchId') || ''), ruleId: String(values.get('ruleId') || ''),
      perspective: String(values.get('perspective') || ''), value: String(values.get('value') || ''), source: String(values.get('source') || ''),
    });
    await persist(result.data, 'Sourced value saved. Run validation to compare it with Design Intent.');
  }
  async function saveAssuranceException(form) {
    const values = new FormData(form);
    const result = C.assurance.createException(ui.data, String(values.get('resultId') || ''), String(values.get('reason') || ''));
    await persist(result.data, 'Exception recorded for architect review.');
  }
  async function saveAssuranceAcceptance(form) {
    const values = new FormData(form);
    const next = C.assurance.recordAcceptance(ui.data, String(values.get('runId') || ''), String(values.get('architect') || ''), String(values.get('notes') || ''));
    await persist(next, 'Architect acceptance recorded.');
  }
  async function action(button) {
    const id = button.dataset.id;
    switch (button.dataset.action) {
      case 'open-domain': ui.domainFilter = id; ui.selectedComponentId = null; navigate('topology'); break;
      case 'open-decision': case 'select-decision': ui.selectedDecisionId = id; navigate('decisions'); break;
      case 'open-dependency': ui.selectedComponentId = id; navigate('dependencies'); break;
      case 'open-readiness': ui.selectedSiteId = id; navigate('readiness'); break;
      case 'open-branch': ui.selectedBranchId = id; navigate('branches'); break;
      case 'open-assurance': ui.assuranceBranchId = id; ui.selectedRunId = null; navigate('deployment'); break;
      case 'new-branch': ui.newBranch = true; navigate('branches'); break;
      case 'cancel-new-branch': ui.newBranch = false; render(); break;
      case 'select-pattern': ui.selectedPatternId = id; render(); break;
      case 'new-pattern': ui.selectedPatternId = 'new'; render(); break;
      case 'select-run': ui.selectedRunId = id; render(); break;
      case 'select-baseline': ui.selectedBaselineId = id; render(); break;
      case 'create-baseline': {
        const branchId = ui.assuranceBranchId || ui.data.branches[0]?.id;
        const result = C.assurance.createBaseline(ui.data, branchId);
        ui.selectedBaselineId = result.id;
        await persist(result.data, 'Draft baseline created from the branch pattern.'); break;
      }
      case 'activate-baseline': await persist(C.assurance.activateBaseline(ui.data, id), 'Design baseline activated.'); break;
      case 'save-baseline-target': {
        const row = button.closest('[data-baseline-row]');
        const next = C.assurance.setBaselineTarget(ui.data, row.dataset.baselineId, row.dataset.ruleId, row.querySelector('[data-target]').value);
        await persist(next, 'Baseline target saved.'); break;
      }
      case 'run-validation': {
        const branchId = ui.assuranceBranchId || ui.data.branches[0]?.id;
        const result = C.assurance.runValidation(ui.data, branchId);
        ui.selectedRunId = result.id;
        await persist(result.data, 'Deterministic validation complete.'); break;
      }
      case 'decide-exception': {
        const approver = button.closest('[data-exception-id]').querySelector('[data-approver]').value;
        await persist(C.assurance.decideException(ui.data, id, button.dataset.status, approver), `Exception ${button.dataset.status.toLowerCase()}.`); break;
      }
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
      case 'save-attribute': await saveAttribute(button.closest('[data-attribute-row]')); break;
      case 'remove-evidence':
        if (window.confirm('Remove this evidence record and its local photograph, if any?')) {
          const result = C.model.removeBranchEvidence(ui.data, id);
          await C.storage.removeEvidenceWithPhoto(result.data, result.photoId);
          ui.data = result.data; status('Saved in this browser'); render(); toast('Evidence removed.');
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
    if (target.id === 'evidence-type') updateEvidenceInput();
    if (target.id === 'assurance-branch') { ui.assuranceBranchId = target.value; ui.selectedRunId = null; ui.selectedBaselineId = null; render(); }
  });
  document.addEventListener('input', event => {
    if (event.target.id === 'decision-search') { ui.decisionSearch = event.target.value; filterDecisions(); }
  });
  document.addEventListener('submit', event => {
    if (event.target.matches('#decision-form')) { event.preventDefault(); run(() => saveDecision(event.target)); }
    if (event.target.matches('#branch-summary-form')) { event.preventDefault(); run(() => saveBranchSummary(event.target)); }
    if (event.target.matches('#branch-evidence-form')) { event.preventDefault(); run(() => saveEvidence(event.target)); }
    if (event.target.matches('#pattern-form')) { event.preventDefault(); run(() => savePattern(event.target)); }
    if (event.target.matches('#create-branch-form')) { event.preventDefault(); run(() => createBranch(event.target)); }
    if (event.target.matches('[data-asset-form]')) { event.preventDefault(); run(() => saveAsset(event.target)); }
    if (event.target.matches('#assurance-observation-form')) { event.preventDefault(); run(() => saveAssuranceObservation(event.target)); }
    if (event.target.matches('#assurance-exception-form')) { event.preventDefault(); run(() => saveAssuranceException(event.target)); }
    if (event.target.matches('#assurance-acceptance-form')) { event.preventDefault(); run(() => saveAssuranceAcceptance(event.target)); }
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
