/* Document metadata and architecture links. Files remain in local IndexedDB. */
(() => {
  'use strict';
  const C = window.Cockpit;
  const kinds = Object.freeze({ Programme: 'programme', Domain: 'domains', Site: 'sites', Branch: 'branches', Component: 'components', Device: 'devices', Interface: 'interfaces', Circuit: 'circuits', Decision: 'decisions', Dependency: 'dependencies', 'Branch Pattern': 'branchPatterns' });
  const MAX_FILE_BYTES = 25 * 1024 * 1024;
  const extensions = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'csv', 'png', 'jpg', 'jpeg', 'webp', 'vsdx']);
  const fail = message => { throw new Error(message); };
  function safeUrl(value) {
    let url;
    try { url = new URL(value); } catch { fail('Enter a valid HTTPS document URL.'); }
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.hash || value.length > 2000) fail('Use an HTTPS document URL without embedded credentials or fragments.');
    for (const key of url.searchParams.keys()) if (/(token|secret|password|signature|sig|auth|key|code|jwt|sastoken)/i.test(key)) fail('Document URL appears to contain a credential. Use a normal permission-controlled OneDrive link.');
    return url.href;
  }
  function validateFile(file) {
    const extension = String(file?.name || '').split('.').at(-1).toLowerCase();
    if (!extensions.has(extension) || !file || file.size < 1 || file.size > MAX_FILE_BYTES || file.name.length > 200 || /[\\/]/.test(file.name) || !(file instanceof Blob)) fail('Choose a supported document up to 25 MB (PDF, Office, text, CSV, image or Visio).');
    return file;
  }
  function validate(data, sets) {
    for (const item of data.libraryDocuments) {
      if (!['Local', 'External'].includes(item.storage) || typeof item.title !== 'string' || !item.title.trim() || item.title.length > 200 || typeof item.note !== 'string' || item.note.length > 1000 || typeof item.sourceLabel !== 'string' || item.sourceLabel.length > 200 || typeof item.addedAt !== 'string' || Number.isNaN(Date.parse(item.addedAt)) || !C.model.classifications.includes(item.classification)) fail('Invalid library document metadata.');
      if (item.storage === 'Local') {
        if (typeof item.fileName !== 'string' || item.fileName.length > 200 || /[\\/]/.test(item.fileName) || !extensions.has(item.fileName.split('.').at(-1).toLowerCase()) || !Number.isInteger(item.size) || item.size < 1 || item.size > MAX_FILE_BYTES || typeof item.mimeType !== 'string' || item.mimeType.length > 120 || item.remoteUrl !== null) fail('Invalid local document metadata.');
      } else if (item.fileName !== null || item.size !== null || item.mimeType !== null || safeUrl(item.remoteUrl) !== item.remoteUrl) fail('Invalid external document reference.');
    }
    const pairs = new Set();
    for (const link of data.documentLinks) {
      if (!sets.libraryDocuments.has(link.documentId) || !Object.hasOwn(kinds, link.objectKind) || typeof link.note !== 'string' || link.note.length > 500) fail('Invalid document association.');
      const target = link.objectKind === 'Programme' ? data.programme.id === link.objectId : sets[kinds[link.objectKind]].has(link.objectId);
      if (!target) fail('Document association refers to a missing architecture object.');
      const key = `${link.documentId}|${link.objectKind}|${link.objectId}`;
      if (pairs.has(key)) fail('Duplicate document association.');
      pairs.add(key);
    }
  }
  function addLocal(data, files, sourceLabel = '') {
    if (!files.length || files.length > 30) fail('Select 1 to 30 documents at a time.');
    if (data.libraryDocuments.filter(item => item.storage === 'Local').reduce((sum, item) => sum + item.size, 0) + files.reduce((sum, file) => sum + file.size, 0) > 75 * 1024 * 1024) fail('Local document storage is limited to 75 MB per workspace. Use OneDrive links for larger libraries.');
    const next = C.model.copy(data), records = [];
    for (const file of files) {
      validateFile(file);
      const id = C.model.newId();
      const record = { id, title: file.name, storage: 'Local', fileName: file.name, mimeType: file.type || 'application/octet-stream', size: file.size, remoteUrl: null, note: '', sourceLabel: sourceLabel.trim(), classification: 'Observed', addedAt: new Date().toISOString() };
      next.libraryDocuments.push(record);
      records.push({ id, blob: file, name: file.name, type: record.mimeType, size: file.size });
    }
    return { data: C.model.validateWorkspace(next), files: records };
  }
  function addExternal(data, fields) {
    const next = C.model.copy(data);
    const item = { id: C.model.newId(), title: String(fields.title || '').trim(), storage: 'External', fileName: null, mimeType: null, size: null, remoteUrl: safeUrl(String(fields.remoteUrl || '').trim()), note: String(fields.note || '').trim(), sourceLabel: String(fields.sourceLabel || '').trim(), classification: 'Observed', addedAt: new Date().toISOString() };
    next.libraryDocuments.push(item);
    return { data: C.model.validateWorkspace(next), id: item.id };
  }
  function link(data, documentId, objectKind, objectId, note = '') {
    const next = C.model.copy(data);
    next.documentLinks.push({ id: C.model.newId(), documentId, objectKind, objectId, note: note.trim() });
    return C.model.validateWorkspace(next);
  }
  function unlink(data, linkId) {
    const next = C.model.copy(data), before = next.documentLinks.length;
    next.documentLinks = next.documentLinks.filter(item => item.id !== linkId);
    if (before === next.documentLinks.length) fail('Document association not found.');
    return C.model.validateWorkspace(next);
  }
  function remove(data, documentId) {
    const next = C.model.copy(data), item = next.libraryDocuments.find(entry => entry.id === documentId);
    if (!item) fail('Document not found.');
    next.libraryDocuments = next.libraryDocuments.filter(entry => entry.id !== documentId);
    next.documentLinks = next.documentLinks.filter(entry => entry.documentId !== documentId);
    return { data: C.model.validateWorkspace(next), local: item.storage === 'Local' };
  }
  function targets(data) {
    return [{ kind: 'Programme', id: data.programme.id, label: data.programme.name }, ...Object.entries(kinds).filter(([kind]) => kind !== 'Programme').flatMap(([kind, collection]) => data[collection].map(item => ({ kind, id: item.id, label: item.name || item.title || item.code || item.description || item.id })))];
  }
  C.library = Object.freeze({ kinds, MAX_FILE_BYTES, safeUrl, validateFile, validate, addLocal, addExternal, link, unlink, remove, targets });
})();
