# Project state — phase 0

- Branch: `codex/phase-0-foundation`.
- Tauri 2 desktop shell with React, TypeScript, Vite, and Cytoscape.js installed for later visualisation.
- Native folder selection is handled in Rust. Opening a folder creates or reopens a SQLite database there; folders inside Git worktrees are rejected.
- Migration `001_initial.sql` defines the initial relational entities plus classified architecture facts and evidence.
- No dashboard, imports, vendor integration, credentials, telemetry, or application network requests exist.
- Runtime/client data belongs in the selected external project directory. `data/` in this repository is a placeholder.
- Local validation: `npm test` (1 passed), `npm run test:rust` (4 passed), `npm run build` (passed), and `cargo fmt --check` (passed). Full `.app` packaging is checked by the macOS CI workflow after push.
