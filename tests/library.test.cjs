'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function load() {
  class FileReader {
    readAsDataURL(blob) {
      blob.arrayBuffer().then(bytes => { this.result = `data:${blob.type};base64,${Buffer.from(bytes).toString('base64')}`; this.onload(); }).catch(error => { this.error = error; this.onerror(); });
    }
  }
  const context = vm.createContext({ window: {}, Blob, Uint8Array, URL, atob, FileReader, console });
  context.window.window = context.window;
  for (const file of ['model.js', 'library.js', 'assurance.js', 'meraki.js', 'sdwan.js', 'intelligence.js', 'current-report.js', 'scenario.js', 'transformation.js', 'demo.js', 'storage.js', 'transformation-views.js', 'sdwan-views.js', 'intelligence-views.js', 'current-report-views.js', 'scenario-views.js', 'library-views.js', 'views.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  return context.window.Cockpit;
}
function localFile(name, text) {
  const file = new Blob([text], { type: 'application/pdf' });
  file.name = name;
  return file;
}

test('local library files and OneDrive references link both ways without changing evidence state', async () => {
  const C = load();
  const before = C.demo.create();
  const files = C.library.addLocal(before, [localFile('Example HLD.pdf', 'synthetic HLD'), localFile('Example LLD.pdf', 'synthetic LLD')], 'Synthetic architecture team');
  assert.equal(files.data.libraryDocuments.length, 2);
  assert.equal(files.data.libraryDocuments[0].classification, 'Observed');
  const remote = C.library.addExternal(files.data, { title: 'Example OneDrive model', remoteUrl: 'https://example.sharepoint.com/sites/network/Shared%20Documents/model.pdf?e=example', sourceLabel: 'Synthetic architecture team' });
  const linked = C.library.link(C.library.link(remote.data, remote.id, 'Branch', 'branch-north', 'HLD context'), remote.id, 'Component', remote.data.components[0].id, 'Architecture reference');
  assert.equal(linked.documentLinks.length, 2);
  assert.match(C.libraryViews.linked(linked, 'Branch', 'branch-north'), /Example OneDrive model/);
  assert.match(C.views.library(linked, { selectedLibraryDocumentId: remote.id }), /Branch · Example Branch North/);
  assert.equal(linked.branchEvidence.length, before.branchEvidence.length);
  assert.equal(linked.assuranceBaselines.length, before.assuranceBaselines.length);
  assert.throws(() => C.library.link(linked, remote.id, 'Branch', 'branch-north'), /Duplicate document association/);
  assert.throws(() => C.library.link(linked, remote.id, 'Branch', 'missing'), /missing architecture object/i);
  const backup = await C.storage.makeBackup(linked, [], files.files);
  const restored = C.storage.parseBackup(JSON.stringify(backup));
  assert.equal(restored.documents.length, 2);
  assert.equal(restored.workspace.documentLinks.length, 2);
  assert.equal(restored.workspace.libraryDocuments[2].remoteUrl, remote.data.libraryDocuments[2].remoteUrl);
  assert.throws(() => C.storage.parseBackup(JSON.stringify({ ...backup, documents: backup.documents.slice(1) })), /missing a local document/);
  const hostile = C.library.addExternal(linked, { title: '<img src=x onerror=alert(1)>', remoteUrl: 'https://example.com/document.pdf' });
  const html = C.views.library(hostile.data, { selectedLibraryDocumentId: hostile.id });
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /<img src=x/);
});

test('schema 8 migration preserves architecture and rejects embedded URL credentials', () => {
  const C = load();
  const old = C.model.copy(C.demo.create()); old.schemaVersion = 8; delete old.libraryDocuments; delete old.documentLinks;
  const migrated = C.model.migrateWorkspace(old);
  assert.equal(migrated.schemaVersion, 9);
  assert.equal(migrated.branches.length, old.branches.length);
  assert.deepEqual([...migrated.libraryDocuments], []);
  assert.throws(() => C.library.addExternal(migrated, { title: 'Bad', remoteUrl: 'javascript:alert(1)' }), /HTTPS/);
  assert.throws(() => C.library.addExternal(migrated, { title: 'Bad', remoteUrl: 'https://example.com/file?access_token=secret' }), /credential/);
  assert.throws(() => C.library.addLocal(migrated, [localFile('payload.html', 'unsafe')]), /supported document/);
});
