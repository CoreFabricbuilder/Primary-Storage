/* Local-only IndexedDB adapter. No HTTP, cloud or vendor connections. */
(() => {
  'use strict';
  const C = window.Cockpit;
  const DB_NAME = 'network-refresh-architecture-cockpit';
  const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
  const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
  let dbPromise;

  function open() {
    if (!window.indexedDB) return Promise.reject(new Error('IndexedDB is unavailable in this browser or for this local file. Try a current macOS browser with local storage enabled.'));
    if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('workspaces')) db.createObjectStore('workspaces', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('photos')) {
          const photos = db.createObjectStore('photos', { keyPath: 'id' });
          photos.createIndex('branchId', 'branchId', { unique: false });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      request.onerror = () => reject(request.error || new Error('Could not open IndexedDB.'));
      request.onblocked = () => reject(new Error('Close other tabs using this cockpit, then reopen it.'));
    }).catch(error => { dbPromise = null; throw error; });
    return dbPromise;
  }

  function readRequest(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Browser storage read failed.'));
    });
  }

  async function write(stores, schedule) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(stores, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Browser storage write failed.'));
      tx.onabort = () => reject(tx.error || new Error('Browser storage write was cancelled.'));
      try { schedule(tx); } catch (error) { tx.abort(); reject(error); }
    });
  }

  async function getWorkspace() {
    const db = await open();
    const value = await readRequest(db.transaction('workspaces').objectStore('workspaces').get('active'));
    return value ? C.model.validateWorkspace(value) : null;
  }
  async function saveWorkspace(workspace) {
    C.model.validateWorkspace(workspace);
    await write(['workspaces'], tx => tx.objectStore('workspaces').put(workspace));
  }
  async function getPhotos(branchId = null) {
    const db = await open();
    const store = db.transaction('photos').objectStore('photos');
    return readRequest(branchId ? store.index('branchId').getAll(branchId) : store.getAll());
  }
  function validatePhoto(photo, workspace) {
    if (!photo || typeof photo !== 'object' || typeof photo.id !== 'string' || !/^[A-Za-z0-9._:-]{1,80}$/.test(photo.id)) throw new Error('Invalid photo ID.');
    const branch = workspace.branches.find(item => item.id === photo.branchId);
    if (!branch) throw new Error('Photo refers to a missing branch.');
    if (photo.deviceId && !branch.deviceIds.includes(photo.deviceId)) throw new Error('Photo device does not belong to the selected branch.');
    if (typeof photo.name !== 'string' || photo.name.length > 200) throw new Error('Invalid photo name.');
    if (!allowedImageTypes.has(photo.type) || !(photo.blob instanceof Blob) || photo.blob.type !== photo.type || photo.blob.size > MAX_PHOTO_BYTES) throw new Error('Only JPEG, PNG, WebP or HEIC photos up to 20 MB are supported.');
    if (typeof photo.addedAt !== 'string' || typeof photo.note !== 'string' || photo.note.length > 1000 || typeof photo.sourceLabel !== 'string' || photo.sourceLabel.length > 200) throw new Error('Invalid photo provenance.');
    if (!C.model.classifications.includes(photo.classification)) throw new Error('Invalid photo classification.');
    return photo;
  }
  async function addPhoto(photo, workspace) {
    validatePhoto(photo, workspace);
    await write(['photos'], tx => tx.objectStore('photos').put(photo));
  }
  async function addPhotos(photos, workspace) {
    photos.forEach(photo => validatePhoto(photo, workspace));
    await write(['photos'], tx => photos.forEach(photo => tx.objectStore('photos').put(photo)));
  }
  async function removePhoto(id) { await write(['photos'], tx => tx.objectStore('photos').delete(id)); }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('Could not read a photo for backup.'));
      reader.readAsDataURL(blob);
    });
  }
  function dataUrlToBlob(dataUrl) {
    if (typeof dataUrl !== 'string') throw new Error('Invalid photo data in backup.');
    const match = /^data:(image\/(?:jpeg|png|webp|heic|heif));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
    if (!match || !allowedImageTypes.has(match[1]) || match[2].length > Math.ceil(MAX_PHOTO_BYTES * 4 / 3) + 4) throw new Error('Invalid or oversized photo in backup.');
    const binary = atob(match[2]);
    if (binary.length > MAX_PHOTO_BYTES) throw new Error('Photo exceeds 20 MB.');
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type: match[1] });
  }
  async function createBackup(workspace) {
    C.model.validateWorkspace(workspace);
    const photos = await Promise.all((await getPhotos()).map(async photo => {
      validatePhoto(photo, workspace);
      const { blob, ...metadata } = photo;
      return { ...metadata, dataUrl: await blobToDataUrl(blob) };
    }));
    return { format: 'network-refresh-cockpit-backup', version: 1, exportedAt: new Date().toISOString(), workspace: C.model.copy(workspace), photos };
  }
  function parseBackup(text) {
    let backup;
    try { backup = JSON.parse(text); } catch { throw new Error('The selected file is not valid JSON.'); }
    if (!backup || backup.format !== 'network-refresh-cockpit-backup' || backup.version !== 1 || !Array.isArray(backup.photos) || backup.photos.length > 2000) throw new Error('Unsupported cockpit backup format.');
    const workspace = C.model.validateWorkspace(backup.workspace);
    const photoIds = new Set();
    const photos = backup.photos.map(item => {
      if (!item || photoIds.has(item.id)) throw new Error('Duplicate or invalid photo in backup.');
      photoIds.add(item.id);
      const { dataUrl, ...metadata } = item;
      const blob = dataUrlToBlob(dataUrl);
      const photo = { ...metadata, blob };
      return validatePhoto(photo, workspace);
    });
    return { workspace, photos };
  }
  async function restoreBackup(backup) {
    const workspace = C.model.validateWorkspace(backup.workspace);
    backup.photos.forEach(photo => validatePhoto(photo, workspace));
    await write(['workspaces', 'photos'], tx => {
      const workspaces = tx.objectStore('workspaces');
      const photos = tx.objectStore('photos');
      workspaces.clear(); photos.clear();
      workspaces.put(workspace);
      backup.photos.forEach(photo => photos.put(photo));
    });
  }
  C.storage = Object.freeze({ open, getWorkspace, saveWorkspace, getPhotos, addPhoto, addPhotos, removePhoto, createBackup, parseBackup, restoreBackup, allowedImageTypes, MAX_PHOTO_BYTES });
})();
