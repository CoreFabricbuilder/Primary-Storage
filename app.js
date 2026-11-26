/* File-open browser controller. Persistent writes go through the local storage adapter. */
(() => {
  'use strict';
  const C = window.Cockpit;
  const ui = {
    data: null, screen: 'overview', state: 'Current', domainFilter: null,
    selectedComponentId: null, selectedSiteId: null, selectedDecisionId: null,
    estateRegion: null, estatePage: 0, estateNodeId: null,
    selectedBranchId: null, selectedPatternId: null, newBranch: false, assuranceBranchId: null, selectedRunId: null, selectedBaselineId: null,
    merakiBranchId: null, pendingMerakiSnapshot: null,
    sdwanScope: null, pendingSdwanSnapshot: null, combinedBranchId: null,
    flowId: null, segmentKind: 'All', segmentQuery: '', segmentSelection: null, segmentTargetKind: 'Site', impactComponentId: null,
    scenarioBranchId: null, scenarioPatternId: 'assigned', scenarioState: 'Transition', scenarioFilter: 'All',
    driftBranchId: null, driftBaselineId: null,
    transPreview: null, transTimelineBy: 'Project / TA', transProjectId: null, transStreamId: null, transKind: 'Stream', transItemId: null, transHighlightIds: [],
    riskStreamId: null, riskId: null, riskWindow: 'All',
    currentReportPreview: null,
    selectedLibraryDocumentId: null, librarySearch: '',
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
      if (C.currentReportViews.useEstateTopology(data, ui)) {
        const graph = C.currentReport.estateGraph(data, ui.estateRegion, ui.estatePage);
        ui.topologyController = C.topology.mount(el('topology-svg'), graph, 'Current', null, ui.estateNodeId, id => {
          const region = graph.regions.find(item => item.id === id);
          if (region) { ui.estateRegion = region.label; ui.estatePage = 0; ui.estateNodeId = null; ui.camera = null; }
          else { ui.estateNodeId = id; ui.camera = ui.topologyController.getCamera(); }
          render();
        }, ui.camera);
      } else ui.topologyController = C.topology.mount(el('topology-svg'), data, ui.state, ui.domainFilter, ui.selectedComponentId, id => {
        ui.camera = ui.topologyController.getCamera();
        ui.selectedComponentId = id;
        render();
      }, ui.camera, ui.transHighlightIds);
    } else if (ui.screen === 'serviceFlows') {
      const flow = data.serviceFlows.find(item => item.id === ui.flowId) || data.serviceFlows[0];
      const path = flow ? C.intelligence.flowPath(data, flow, ui.state) : null;
      ui.topologyController = C.topology.mount(el('flow-svg'), data, ui.state, null, null, id => {
        ui.impactComponentId = id; navigate('impact');
      }, ui.camera, path?.nodeIds || [], path?.linkIds || []);
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
    status('Saved in this browser'); toast('JSON backup downloaded, including local documents and photographs.');
  }
  async function importBackup(file) {
    if (!file) return;
    if (file.size > 250 * 1024 * 1024) throw new Error('Backup exceeds the 250 MB import limit.');
    const backup = C.storage.parseBackup(await file.text());
    if (!window.confirm(`Restore “${backup.workspace.programme.name}”, ${backup.documents.length} local documents and ${backup.photos.length} photographs? This replaces this browser's current cockpit data.`)) return;
    await C.storage.restoreBackup(backup);
    ui.data = backup.workspace;
    ui.screen = 'overview'; ui.state = 'Current'; ui.domainFilter = null; ui.camera = null;
    ui.selectedComponentId = null; ui.selectedSiteId = null; ui.selectedDecisionId = null; ui.selectedBranchId = null; ui.selectedPatternId = null; ui.newBranch = false;
    ui.estateRegion = null; ui.estatePage = 0; ui.estateNodeId = null;
    ui.assuranceBranchId = null; ui.selectedRunId = null; ui.selectedBaselineId = null;
    ui.sdwanScope = null; ui.pendingSdwanSnapshot = null; ui.combinedBranchId = null;
    ui.flowId = null; ui.segmentKind = 'All'; ui.segmentQuery = ''; ui.segmentSelection = null; ui.segmentTargetKind = 'Site'; ui.impactComponentId = null;
    ui.scenarioBranchId = null; ui.scenarioPatternId = 'assigned'; ui.scenarioState = 'Transition'; ui.scenarioFilter = 'All';
    ui.driftBranchId = null; ui.driftBaselineId = null;
    ui.transPreview = null; ui.currentReportPreview = null; ui.transProjectId = null; ui.transStreamId = null; ui.transItemId = null; ui.transHighlightIds = [];
    ui.riskStreamId = null; ui.riskId = null; ui.riskWindow = 'All';
    ui.selectedLibraryDocumentId = null; ui.librarySearch = '';
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
  async function saveTransGate(form) {
    const values = new FormData(form);
    await persist(C.transformation.setGate(ui.data, String(values.get('kind')), String(values.get('id')), String(values.get('gate')), String(values.get('note') || '')), 'Architecture gate saved.');
  }
  async function saveTransMapping(form) {
    const values = new FormData(form);
    const [kind, targetId] = String(values.get('target') || '').split(':');
    await persist(C.transformation.addMapping(ui.data, String(values.get('kind')), String(values.get('id')), kind, targetId || null, String(values.get('reference') || '')), 'Architecture mapping saved.');
  }
  async function action(button) {
    const id = button.dataset.id;
    switch (button.dataset.action) {
      case 'open-domain': ui.domainFilter = id; ui.selectedComponentId = null; ui.transHighlightIds = []; navigate('topology'); break;
      case 'open-decision': case 'select-decision': ui.selectedDecisionId = id; navigate('decisions'); break;
      case 'open-dependency': ui.selectedComponentId = id; navigate('dependencies'); break;
      case 'open-readiness': ui.selectedSiteId = id; navigate('readiness'); break;
      case 'open-branch': ui.selectedBranchId = id; navigate('branches'); break;
      case 'estate-previous-page': ui.estatePage = Math.max(0, ui.estatePage - 1); ui.estateNodeId = null; ui.camera = null; render(); break;
      case 'estate-next-page': ui.estatePage++; ui.estateNodeId = null; ui.camera = null; render(); break;
      case 'open-library-document': ui.selectedLibraryDocumentId = id; navigate('library'); break;
      case 'download-library-document': {
        const item = ui.data.libraryDocuments.find(entry => entry.id === id && entry.storage === 'Local');
        const file = await C.storage.getDocument(id);
        if (!item || !file) throw new Error('Local document is missing from browser storage.');
        const url = URL.createObjectURL(file.blob), anchor = document.createElement('a');
        anchor.href = url; anchor.download = item.fileName; document.body.append(anchor); anchor.click(); anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000); break;
      }
      case 'unlink-library-document': await persist(C.library.unlink(ui.data, id), 'Document association removed.'); break;
      case 'remove-library-document': {
        if (!window.confirm('Remove this library entry, its architecture links, and its local file if uploaded?')) break;
        const result = C.library.remove(ui.data, id);
        if (result.local) await C.storage.removeDocumentWithFile(result.data, id);
        else await C.storage.saveWorkspace(result.data);
        ui.data = result.data; ui.selectedLibraryDocumentId = null; status('Saved in this browser'); render(); toast('Document removed from library.'); break;
      }
      case 'open-library-object': {
        const kind = button.dataset.kind;
        if (kind === 'Branch') { ui.selectedBranchId = id; navigate('branches'); }
        else if (kind === 'Component') { ui.selectedComponentId = id; ui.domainFilter = null; navigate('topology'); }
        else if (kind === 'Decision') { ui.selectedDecisionId = id; navigate('decisions'); }
        else if (kind === 'Branch Pattern') { ui.selectedPatternId = id; navigate('patterns'); }
        else if (kind === 'Domain') { ui.domainFilter = id; navigate('topology'); }
        else if (kind === 'Site') { ui.selectedSiteId = id; navigate('readiness'); }
        else if (kind === 'Dependency') { ui.selectedComponentId = ui.data.dependencies.find(item => item.id === id)?.upstreamId; navigate('dependencies'); }
        else if (kind === 'Device' || kind === 'Interface' || kind === 'Circuit') {
          const device = kind === 'Interface' ? ui.data.devices.find(item => item.id === ui.data.interfaces.find(entry => entry.id === id)?.deviceId) : kind === 'Device' ? ui.data.devices.find(item => item.id === id) : null;
          const branch = ui.data.branches.find(item => item.id === device?.branchId || (kind === 'Circuit' && item.siteId === ui.data.circuits.find(entry => entry.id === id)?.siteId));
          if (branch) { ui.selectedBranchId = branch.id; navigate('branches'); }
          else { ui.selectedSiteId = device?.siteId || ui.data.circuits.find(item => item.id === id)?.siteId; navigate('readiness'); }
        } else navigate('overview');
        break;
      }
      case 'scenario-select-branch': ui.scenarioBranchId = id; render(); break;
      case 'open-assurance': ui.assuranceBranchId = id; ui.selectedRunId = null; navigate('deployment'); break;
      case 'open-trans-item':
        if (!id || !['Stream', 'Activity'].includes(button.dataset.kind)) break;
        ui.transKind = button.dataset.kind; ui.transItemId = id;
        if (ui.transKind === 'Stream') ui.transStreamId = id;
        navigate('transDetail'); break;
      case 'select-risk-stream': ui.riskStreamId = id; ui.riskId = null; render(); break;
      case 'open-risk-stream': ui.riskStreamId = id; ui.riskId = null; navigate('transRisks'); break;
      case 'select-risk-record': {
        const item = ui.data.architectureRisks.find(value => value.id === id);
        if (!item) throw new Error('Architecture risk not found.');
        ui.riskStreamId = item.ownerId; ui.riskId = id; render(); break;
      }
      case 'new-risk': ui.riskId = null; render(); break;
      case 'show-trans-topology': {
        ui.transHighlightIds = ui.data.transMappings.filter(item => item.ownerKind === 'Stream' && item.ownerId === id && item.targetKind === 'Component').map(item => item.targetId);
        if (!ui.transHighlightIds.length) throw new Error('Map a topology component to this stream first.');
        ui.selectedComponentId = ui.transHighlightIds[0]; ui.domainFilter = null; navigate('topology'); break;
      }
      case 'apply-trans-import': {
        if (!ui.transPreview) throw new Error('Select a workbook to preview first.');
        const next = C.transformation.applyImport(ui.data, ui.transPreview);
        ui.transPreview = null; await persist(next, 'Transformation plan imported after review.'); break;
      }
      case 'cancel-trans-import': ui.transPreview = null; render(); break;
      case 'remove-trans-map': await persist(C.transformation.removeMapping(ui.data, id), 'Architecture mapping removed.'); break;
      case 'navigate-trans-map': {
        const map = ui.data.transMappings.find(item => item.id === id);
        if (!map) throw new Error('Architecture mapping not found.');
        switch (map.targetKind) {
          case 'Domain': ui.domainFilter = ui.data.domains.find(item => item.name === C.transformation.DOMAINS.find(domain => domain.id === map.targetId)?.parent)?.id || null; navigate('topology'); break;
          case 'Component': ui.selectedComponentId = map.targetId; navigate('topology'); break;
          case 'Site': ui.selectedSiteId = map.targetId; navigate('readiness'); break;
          case 'Branch': ui.selectedBranchId = map.targetId; navigate('branches'); break;
          case 'Branch Pattern': ui.selectedPatternId = map.targetId; navigate('patterns'); break;
          case 'Decision': ui.selectedDecisionId = map.targetId; navigate('decisions'); break;
          case 'Dependency': ui.selectedComponentId = ui.data.dependencies.find(item => item.id === map.targetId)?.fromId || null; navigate('dependencies'); break;
          case 'Source': toast('Source reference: ' + (ui.data.sources.find(item => item.id === map.targetId)?.title || 'Unknown')); break;
        }
        break;
      }
      case 'apply-meraki': await persist(C.meraki.applyCandidate(ui.data, id), 'Meraki candidate recorded as Observed. Run validation separately.'); break;
      case 'dismiss-meraki': await persist(C.meraki.dismissCandidate(ui.data, id), 'Meraki candidate dismissed.'); break;
      case 'apply-sdwan': await persist(C.sdwan.applyCandidate(ui.data, id), 'SD-WAN candidate recorded as Observed.'); break;
      case 'dismiss-sdwan': await persist(C.sdwan.dismissCandidate(ui.data, id), 'SD-WAN candidate dismissed.'); break;
      case 'run-sdwan': {
        const [kind, scopeId] = (ui.sdwanScope || `Branch|${ui.data.branches[0]?.id}`).split('|');
        await persist(C.sdwan.runValidation(ui.data, kind, scopeId).data, 'SD-WAN validation recorded.'); break;
      }
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
    if (target.id === 'estate-region') { ui.estateRegion = target.value || null; ui.estatePage = 0; ui.estateNodeId = null; ui.camera = null; render(); }
    if (target.id === 'readiness-site') { ui.selectedSiteId = target.value; render(); }
    if (target.id === 'dependency-component') { ui.selectedComponentId = target.value; render(); }
    if (target.id === 'import-file') { const file = target.files[0]; target.value = ''; run(() => importBackup(file)); }
    if (target.id === 'current-report-file') {
      const file = target.files[0]; target.value = '';
      if (file) run(async () => {
        ui.currentReportPreview = null;
        if (file.size > C.currentReport.MAX_BYTES) throw new Error('Branch report exceeds 5 MB.');
        const parsed = C.currentReport.parse(C.currentReport.decode(await file.arrayBuffer()), file.name);
        ui.currentReportPreview = { ...C.currentReport.plan(ui.data, parsed, { programmeName: ui.data.programme.isDemo ? 'Network Refresh' : ui.data.programme.name }), reviewed: false };
        render(); toast('Branch report loaded. Review matching and warnings before import.');
      });
    }
    if (target.id === 'evidence-type') updateEvidenceInput();
    if (target.id === 'assurance-branch') { ui.assuranceBranchId = target.value; ui.selectedRunId = null; ui.selectedBaselineId = null; render(); }
    if (target.id === 'meraki-branch') { ui.merakiBranchId = target.value; render(); }
    if (target.id === 'sdwan-scope') { ui.sdwanScope = target.value; render(); }
    if (target.id === 'combined-branch') { ui.combinedBranchId = target.value; render(); }
    if (target.id === 'flow-select') { ui.flowId = target.value; ui.camera = null; render(); }
    if (target.id === 'segment-select') { ui.segmentSelection = target.value; render(); }
    if (target.id === 'segment-target-kind') { ui.segmentTargetKind = target.value; render(); }
    if (target.id === 'impact-component') { ui.impactComponentId = target.value; render(); }
    if (target.id === 'scenario-branch') { ui.scenarioBranchId = target.value; render(); }
    if (target.id === 'scenario-pattern') { ui.scenarioPatternId = target.value; render(); }
    if (target.id === 'scenario-state') { ui.scenarioState = target.value; render(); }
    if (target.id === 'scenario-filter') { ui.scenarioFilter = target.value; render(); }
    if (target.id === 'drift-branch') { ui.driftBranchId = target.value; ui.driftBaselineId = null; render(); }
    if (target.id === 'drift-baseline') { ui.driftBaselineId = target.value; render(); }
    if (target.id === 'sdwan-file') {
      const file = target.files[0]; target.value = '';
      if (file) run(async () => {
        ui.pendingSdwanSnapshot = null;
        if (file.size > C.sdwan.MAX_SNAPSHOT_BYTES) throw new Error('SD-WAN snapshot exceeds 30 MB.');
        ui.pendingSdwanSnapshot = C.sdwan.parseSnapshot(await file.text());
        render(); toast('SD-WAN snapshot loaded for review.');
      });
    }
    if (target.id === 'meraki-file') {
      const file = target.files[0]; target.value = '';
      if (file) run(async () => {
        ui.pendingMerakiSnapshot = null;
        if (file.size > C.meraki.MAX_SNAPSHOT_BYTES) throw new Error('Meraki snapshot exceeds 30 MB.');
        ui.pendingMerakiSnapshot = C.meraki.parseSnapshot(await file.text());
        render(); toast('Meraki snapshot loaded for review.');
      });
    }
    if (target.id === 'trans-file') {
      const file = target.files[0]; target.value = '';
      if (file) run(async () => {
        ui.transPreview = null;
        if (file.size > 25 * 1024 * 1024) throw new Error('Workbook exceeds 25 MB.');
        const parsed = C.transformation.parseWorkbook(await file.arrayBuffer(), file.name);
        ui.transPreview = C.transformation.previewImport(ui.data, parsed);
        render(); toast('Workbook mapped locally. Review changes before applying.');
      });
    }
    if (target.id === 'trans-timeline-by') { ui.transTimelineBy = target.value; render(); }
    if (target.id === 'risk-window') { ui.riskWindow = target.value; render(); }
    if (target.id === 'trans-project') { ui.transProjectId = target.value; render(); }
    if (target.id === 'trans-activity-stream') { run(() => persist(C.transformation.linkActivity(ui.data, target.dataset.id, target.value), 'Activity linked to stream.')); }
    if (target.matches('[data-dependency-id]')) { run(() => persist(C.transformation.linkDependency(ui.data, target.dataset.dependencyId, target.value), 'Stream dependency linked.')); }
  });
  document.addEventListener('input', event => {
    if (event.target.id === 'decision-search') { ui.decisionSearch = event.target.value; filterDecisions(); }
    if (event.target.id === 'library-search') {
      ui.librarySearch = event.target.value;
      const query = ui.librarySearch.toLowerCase();
      document.querySelectorAll('#library-results [data-action="open-library-document"]').forEach(button => {
        const item = ui.data.libraryDocuments.find(entry => entry.id === button.dataset.id);
        button.hidden = !`${item.title} ${item.sourceLabel} ${item.note}`.toLowerCase().includes(query);
      });
    }
  });
  document.addEventListener('submit', event => {
    if (event.target.matches('#risk-form')) {
      event.preventDefault(); const values = Object.fromEntries(new FormData(event.target));
      run(async () => { const result = C.risk.upsert(ui.data, values); ui.riskId = result.id; ui.riskStreamId = String(values.ownerId); await persist(result.data, 'Architecture intervention assessment saved.'); });
    }
    if (event.target.matches('#library-upload-form')) {
      event.preventDefault(); const files = [...event.target.elements.files.files], sourceLabel = String(new FormData(event.target).get('sourceLabel') || '');
      run(async () => {
        const result = C.library.addLocal(ui.data, files, sourceLabel);
        await C.storage.saveDocumentsWithFiles(result.data, result.files);
        ui.data = result.data; ui.selectedLibraryDocumentId = result.files[0].id;
        status('Saved in this browser'); render(); toast(`${result.files.length} documents saved locally.`);
      });
    }
    if (event.target.matches('#library-link-form')) {
      event.preventDefault(); const values = Object.fromEntries(new FormData(event.target));
      run(async () => { const result = C.library.addExternal(ui.data, values); ui.selectedLibraryDocumentId = result.id; await persist(result.data, 'Secured document reference saved.'); });
    }
    if (event.target.matches('#library-association-form')) {
      event.preventDefault(); const values = new FormData(event.target);
      const [kind, id] = String(values.get('target') || '').split('|');
      run(() => persist(C.library.link(ui.data, String(values.get('documentId')), kind, id, String(values.get('note') || '')), 'Document linked to architecture object.'));
    }
    if (event.target.matches('#current-report-form')) {
      event.preventDefault(); const values = new FormData(event.target);
      run(async () => {
        const preview = ui.currentReportPreview;
        if (!preview) throw new Error('Select a branch report first.');
        const options = { mode: String(values.get('mode')), sourceDate: String(values.get('sourceDate')), programmeName: String(values.get('programmeName')).trim() };
        const changed = options.mode !== preview.mode || options.sourceDate !== preview.sourceDate || options.programmeName !== preview.programmeName;
        if (changed || !preview.reviewed) {
          ui.currentReportPreview = { ...C.currentReport.plan(ui.data, preview.parsed, options), reviewed: true };
          render(); toast('Import options reviewed. Check the row preview, then apply.'); return;
        }
        if (preview.mode === 'new' && !window.confirm('Replace this browser workspace, local documents and photographs with the reviewed Current State branch report? Export JSON first if you need the existing data.')) return;
        const result = C.currentReport.apply(ui.data, preview);
        if (preview.mode === 'new') await C.storage.replaceWorkspace(result.data);
        else await C.storage.saveWorkspace(result.data);
        ui.data = result.data; ui.currentReportPreview = null; ui.state = 'Current'; ui.screen = 'currentEstate';
        status('Saved in this browser'); render(); toast(`${result.changed} Current State branch observations saved.`);
      });
    }
    if (event.target.matches('#decision-form')) { event.preventDefault(); run(() => saveDecision(event.target)); }
    if (event.target.matches('#branch-summary-form')) { event.preventDefault(); run(() => saveBranchSummary(event.target)); }
    if (event.target.matches('#branch-evidence-form')) { event.preventDefault(); run(() => saveEvidence(event.target)); }
    if (event.target.matches('#pattern-form')) { event.preventDefault(); run(() => savePattern(event.target)); }
    if (event.target.matches('#create-branch-form')) { event.preventDefault(); run(() => createBranch(event.target)); }
    if (event.target.matches('[data-asset-form]')) { event.preventDefault(); run(() => saveAsset(event.target)); }
    if (event.target.matches('#assurance-observation-form')) { event.preventDefault(); run(() => saveAssuranceObservation(event.target)); }
    if (event.target.matches('#assurance-exception-form')) { event.preventDefault(); run(() => saveAssuranceException(event.target)); }
    if (event.target.matches('#assurance-acceptance-form')) { event.preventDefault(); run(() => saveAssuranceAcceptance(event.target)); }
    if (event.target.matches('#meraki-stage-form')) {
      event.preventDefault();
      const branchId = String(new FormData(event.target).get('branchId') || '');
      run(async () => {
        if (!ui.pendingMerakiSnapshot) throw new Error('Select a snapshot first.');
        const result = C.meraki.stageSnapshot(ui.data, ui.pendingMerakiSnapshot, branchId);
        ui.pendingMerakiSnapshot = null; ui.merakiBranchId = branchId;
        await persist(result.data, `${result.count} Meraki candidates staged for review.`);
      });
    }
    if (event.target.matches('#sdwan-stage-form')) {
      event.preventDefault();
      const [kind, scopeId] = String(new FormData(event.target).get('scope') || '').split('|');
      run(async () => {
        if (!ui.pendingSdwanSnapshot) throw new Error('Select a snapshot first.');
        const result = C.sdwan.stageSnapshot(ui.data, ui.pendingSdwanSnapshot, kind, scopeId);
        ui.pendingSdwanSnapshot = null; ui.sdwanScope = `${kind}|${scopeId}`;
        await persist(result.data, `${result.count} SD-WAN candidates staged for review.`);
      });
    }
    if (event.target.matches('#sdwan-target-form')) {
      event.preventDefault();
      const [kind, scopeId] = (ui.sdwanScope || `Branch|${ui.data.branches[0]?.id}`).split('|');
      const values = Object.fromEntries(new FormData(event.target));
      run(() => persist(C.sdwan.saveTarget(ui.data, kind, scopeId, values, String(values.source || '')), 'SD-WAN target version saved.'));
    }
    if (event.target.matches('#flow-form')) {
      event.preventDefault(); const values = Object.fromEntries(new FormData(event.target));
      run(async () => { const result = C.intelligence.createFlow(ui.data, values); ui.flowId = result.id; await persist(result.data, 'Logical service flow saved.'); });
    }
    if (event.target.matches('#segment-search-form')) {
      event.preventDefault(); const values = new FormData(event.target);
      ui.segmentKind = String(values.get('kind') || 'All'); ui.segmentQuery = String(values.get('query') || '').trim(); ui.segmentSelection = null; render();
    }
    if (event.target.matches('#segment-link-form')) {
      event.preventDefault(); const values = Object.fromEntries(new FormData(event.target));
      run(() => persist(C.intelligence.addSegmentationLink(ui.data, values).data, 'Sourced segmentation link added.'));
    }
    if (event.target.matches('#deployment-baseline-form')) {
      event.preventDefault(); const values = new FormData(event.target);
      run(async () => { const result = C.intelligence.createBaseline(ui.data, String(values.get('acceptanceId') || ''), String(values.get('architect') || '').trim(), String(values.get('note') || '').trim()); ui.driftBaselineId = result.id; await persist(result.data, 'Accepted deployment marked as an As-Built Baseline.'); });
    }
    if (event.target.matches('.drift-review-form')) {
      event.preventDefault(); const form = event.target, values = new FormData(form);
      run(() => persist(C.intelligence.reviewDrift(ui.data, { baselineId: form.dataset.baselineId, itemKey: form.dataset.itemKey, observationId: form.dataset.observationId,
        classification: String(values.get('classification') || ''), decisionId: String(values.get('decisionId') || ''), architect: String(values.get('architect') || '').trim(), rationale: String(values.get('rationale') || '').trim() }), 'Drift review recorded. Baseline unchanged.'));
    }
    if (event.target.matches('#trans-gate-form')) { event.preventDefault(); run(() => saveTransGate(event.target)); }
    if (event.target.matches('#trans-map-form')) { event.preventDefault(); run(() => saveTransMapping(event.target)); }
  });
  async function init() {
    try {
      await C.storage.open();
      ui.data = await C.storage.getWorkspace();
      if (!ui.data) { ui.data = C.demo.create(); await C.storage.saveWorkspace(ui.data); }
      status('Saved in this browser'); render();
    } catch (error) {
      failure(error);
      const message = String(error?.message || 'Unknown startup error.');
      const schemaIssue = /workspace schema|schema \d+/.test(message);
      const title = schemaIssue ? 'This app copy cannot read the saved workspace' : 'Workspace could not be opened';
      const advice = schemaIssue
        ? 'Open the latest complete app download in this Chrome profile. Do not clear browser data; the saved workspace has not been replaced.'
        : 'The details below identify the startup failure. If Chrome storage is blocked, use a normal browser window with local storage enabled. Do not clear browser data while troubleshooting.';
      status(schemaIssue ? 'Workspace version mismatch' : 'Workspace startup error');
      el('content').innerHTML = '<section class="panel empty-state"><h1 id="startup-title"></h1><p id="startup-advice"></p><p><strong>Error:</strong> <span id="startup-detail"></span></p></section>';
      el('startup-title').textContent = title;
      el('startup-advice').textContent = advice;
      el('startup-detail').textContent = message;
    }
  }
  init();
})();
