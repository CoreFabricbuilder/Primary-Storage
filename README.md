# Network Refresh Architecture Cockpit

A local macOS architecture workspace foundation for an enterprise Network Refresh programme. Phase 0 provides a desktop shell and persistent SQLite storage, without an architecture dashboard.

## Develop on macOS

Install Node.js 20.19+ or 22.12+, Rust stable, and Xcode Command Line Tools. Then:

```bash
npm ci
npm run tauri:dev
```

Choose a project directory outside this Git repository. The app creates `.network-refresh-cockpit.sqlite3` in that directory. Choose the same directory on later launches to reopen it. Keep customer documents and runtime data outside the repository.

## Checks

```bash
npm test
npm run build
npm run test:rust
npm run check:rust
```

`npm run tauri:build` packages a macOS `.app` when run on macOS with the platform build tools. The Vite development server listens on `127.0.0.1` only; the packaged app has no application network client or inbound listener.
