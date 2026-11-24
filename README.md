# Network Refresh Architecture Cockpit

A zero-install, local-first browser application for architecture visibility across a network refresh programme. The repository contains synthetic demonstration data only.

## Open

Download or unzip this repository, then open `index.html` in a current macOS browser. No terminal, server, package installation or build is needed. The first open creates a synthetic workspace in that browser's IndexedDB. Use the same browser profile and the same local file location to reopen it.

The application has eight screens: Architecture Overview, Topology, LLD Readiness, Architecture Decisions, Dependencies, Branch Detail, Branch Estate Matrix and Branch Pattern Catalogue. Current, Transition and Future are selectable. Design Intent, Observed, Validated and As-Built are model perspectives; evidence classification is tracked separately.

## Your data

Changes and selected branch photographs are stored in IndexedDB in the browser profile. Use **Export JSON** regularly to download a complete backup, including photographs. **Import JSON** replaces the active workspace and photos after confirmation. Keep exported backups and customer evidence outside this Git repository. Browser private mode, profile cleanup and local file origin changes can make stored data unavailable; the JSON backup is the portable copy.

You can start a branch with a site name and proposed pattern, then add its devices, interfaces, circuits, subnets, observations and evidence as information arrives. Branch evidence can refer to a branch, cabinet, device, interface, circuit, wireless AP or switch. Photograph files stay as local IndexedDB Blobs; other evidence types store references and notes only. Supported image formats are JPEG, PNG, WebP and HEIC/HEIF, up to 20 MB each. Evidence classifications are explicit, and photographs never produce confirmed technical facts automatically. The Branch Pattern Catalogue contains synthetic examples only; blank targets remain Unknown.

## Development verification

The application runs without developer tools. Developers with Node.js 20+ may run the dependency-free tests with `node --test tests/*.test.cjs`. Syntax checks can be run with `node --check` on each JavaScript file. There is no production build.

See [ARCHITECTURE.md](ARCHITECTURE.md), [DATA_MODEL.md](DATA_MODEL.md) and [PROJECT_STATE.md](PROJECT_STATE.md) for implementation details and scope.
