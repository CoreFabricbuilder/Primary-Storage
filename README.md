# Network Refresh Architecture Cockpit

A zero-install, local-first browser application for architecture visibility across a network refresh programme. The repository contains synthetic demonstration data only.

## Open

Download or unzip this repository, then open `index.html` in a current macOS browser. No terminal, server, package installation or build is needed. The first open creates a synthetic workspace in that browser's IndexedDB. Use the same browser profile and the same local file location to reopen it.

The application has architecture and branch screens, six deployment assurance screens, Meraki Review, Catalyst SD-WAN validation, a Combined Branch view, Architecture Intelligence and a Transformation Portfolio. Current, Transition and Future are selectable for architecture views. Design Intent, Observed, Validated and As-Built remain separate perspectives.

## Your data

Changes and selected branch photographs are stored in IndexedDB in the browser profile. Use **Export JSON** regularly to download a complete backup, including photographs. **Import JSON** replaces the active workspace and photos after confirmation. Keep exported backups and customer evidence outside this Git repository. Browser private mode, profile cleanup and local file origin changes can make stored data unavailable; the JSON backup is the portable copy.

You can start a branch with a site name and proposed pattern, then add its devices, interfaces, circuits, subnets, observations and evidence as information arrives. Branch evidence can refer to a branch, cabinet, device, interface, circuit, wireless AP or switch. Photograph files stay as local IndexedDB Blobs; other evidence types store references and notes only. Supported image formats are JPEG, PNG, WebP and HEIC/HEIF, up to 20 MB each. Evidence classifications are explicit, and photographs never produce confirmed technical facts automatically. The Branch Pattern Catalogue contains synthetic examples only; blank targets remain Unknown.

Deployment assurance uses an active Design Intent baseline and sourced Observed values. **Run validation** creates immutable rule results; entering new observations or As-Built values never edits an earlier run or the baseline. Critical mandatory failures make Deployment Acceptance **FAILED**. An architect must explicitly approve exceptions and record any acceptance. The demonstration results and sources are synthetic.

Meraki Review can stage a user-selected Dashboard snapshot and apply individual values as Observed after review. The optional [macOS companion](docs/MERAKI_COMPANION.md) uses a Keychain API key and read-only Dashboard GET requests to collect that snapshot. The browser does not connect to Meraki, hold credentials, or change Design Intent automatically. The companion is not needed to open or use the browser app.

Catalyst SD-WAN validation can stage a user-selected Manager snapshot for a Branch or Campus site, then compare reviewed Observed values with versioned architecture targets. The [optional macOS collector](docs/SDWAN_COMPANION.md) uses Keychain credentials and fixed read-only Manager GET requests. Unsupported query coverage stays Unknown. The Combined Branch view brings SD-WAN, Meraki LAN and Wi-Fi, Physical, Routing and Management results together; a Critical failure blocks readiness regardless of other passing results.

**Service Flows** highlights logical paths through the selected Current, Transition or Future topology; examples cover Branch to Internet, AWS and Mainframe, plus Campus to Shared Services. **Segmentation** searches VRFs, SD-WAN VPNs, VLANs and subnets, separating sourced direct links from related site context. **Architecture Impact** gathers downstream sites, services, routing, segmentation, security, decisions, evidence and open LLD inputs for a component. These views show modelled relationships, not proof of live traffic.

**As-Built & Drift** lets an architect snapshot an accepted deployment as an As-Built Baseline. Later sourced observations compare with the frozen values. Unexplained differences can be reviewed as Expected or Approved Change with a linked architecture decision and rationale. The application never changes the baseline or remediates devices automatically.

The [Transformation Portfolio](docs/TRANSFORMATION_IMPORT.md) locally reads the two-sheet `OM Plan - streams.xlsx` format. It previews new, changed and removed source rows and data quality issues before you confirm. Architect mappings and gates stay separate from workbook planning status and survive re-import. The original workbook is not saved; JSON backup includes the imported projection and enrichment. Keep customer workbooks and backups outside Git. The XLSX parser is bundled locally, so no CDN or build is needed.

## Development verification

The application runs without developer tools. Developers with Node.js 20+ may run the dependency-free tests with `node --test tests/*.test.cjs`. Syntax checks can be run with `node --check` on each JavaScript file. There is no production build.

See [ARCHITECTURE.md](ARCHITECTURE.md), [DATA_MODEL.md](DATA_MODEL.md) and [PROJECT_STATE.md](PROJECT_STATE.md) for implementation details and scope.
