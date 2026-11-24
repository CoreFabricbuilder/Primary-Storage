# Network Refresh Architecture Cockpit

A zero-install, local-first browser application for architecture visibility across a network refresh programme. The repository contains synthetic demonstration data only.

## Open

Download or unzip this repository, then open `index.html` in a current macOS browser. No terminal, server, package installation or build is needed. The first open creates a synthetic workspace in that browser's IndexedDB. Use the same browser profile and the same local file location to reopen it.

The application has six screens: Architecture Overview, Topology, LLD Readiness, Architecture Decisions, Dependencies and Branches. Current, Transition and Future are selectable. Design Intent, Observed, Validated and As-Built are model perspectives; evidence classification is tracked separately.

## Your data

Changes and selected branch photographs are stored in IndexedDB in the browser profile. Use **Export JSON** regularly to download a complete backup, including photographs. **Import JSON** replaces the active workspace and photos after confirmation. Keep exported backups and customer evidence outside this Git repository. Browser private mode, profile cleanup and local file origin changes can make stored data unavailable; the JSON backup is the portable copy.

Photographs may be attached to a branch or one of its devices. Supported formats are JPEG, PNG, WebP and HEIC/HEIF, up to 20 MB each. They are classified Observed and are never promoted to Confirmed automatically.

## Development verification

The application runs without developer tools. Developers with Node.js 20+ may run the dependency-free tests with `node --test tests/*.test.cjs`. Syntax checks can be run with `node --check` on each JavaScript file. There is no production build.

See [ARCHITECTURE.md](ARCHITECTURE.md), [DATA_MODEL.md](DATA_MODEL.md) and [PROJECT_STATE.md](PROJECT_STATE.md) for implementation details and scope.
