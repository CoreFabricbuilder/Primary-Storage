import { useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import type { ProjectInfo } from './models/project';
import { selectProject } from './services/storage';

export function App() {
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function chooseProject() {
    setBusy(true);
    setError(null);
    try {
      const selected = await selectProject();
      if (selected) setProject(selected);
    } catch (problem) {
      setError(typeof problem === 'string' ? problem : 'Could not open the project folder.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell">
      <div className="eyebrow">Local architecture workspace</div>
      <h1>Network Refresh Architecture Cockpit</h1>
      <p className="intro">A local foundation for current, transition and future network architecture evidence.</p>
      <section className="status-card" aria-label="Project storage">
        <h2>Project storage</h2>
        {project ? (
          <p><strong>{project.name}</strong> is ready. SQLite schema version {project.schemaVersion}.</p>
        ) : (
          <p>Choose a Network Refresh project folder. The application will create its local SQLite database there.</p>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <button type="button" onClick={chooseProject} disabled={busy || !isTauri()}>
          {busy ? 'Opening…' : project ? 'Choose another folder' : 'Choose project folder'}
        </button>
        {!isTauri() && <p className="hint">Open this interface through the Tauri desktop app to choose a folder.</p>}
      </section>
      <p className="footnote">Phase 0 establishes local storage and the application shell. Architecture views arrive in later phases.</p>
    </main>
  );
}
