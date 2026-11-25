# Network Refresh Architecture Cockpit

A zero-install, local-first browser application for architecture visibility across a network refresh programme. The repository contains synthetic demonstration data only.

## Open

Download or unzip this repository, then open `index.html` in a current macOS browser. No terminal, server, package installation or build is needed. The first open creates a synthetic workspace in that browser's IndexedDB. Use the same browser profile and the same local file location to reopen it.

The application has architecture and branch screens, six deployment assurance screens, Meraki Review, Catalyst SD-WAN validation, a Combined Branch view, Architecture Intelligence and a Transformation Portfolio. Current, Transition and Future are selectable for architecture views. Design Intent, Observed, Validated and As-Built remain separate perspectives.

## Your data

Changes, local library documents and selected branch photographs are stored in IndexedDB in the browser profile. Use **Export JSON** regularly to download a complete backup, including local files. **Import JSON** replaces the active workspace, documents and photos after confirmation. Keep exported backups and customer evidence outside this Git repository. Browser private mode, profile cleanup and local file origin changes can make stored data unavailable; the JSON backup is the portable copy.

**Document Library** accepts multiple local PDF, Office, text, CSV, image or Visio files (25 MB each, 75 MB total), or a normal HTTPS link to a document in OneDrive/SharePoint. Link each document to one or more branches, devices, components, sites, decisions or other architecture objects. Open a linked document from Branch Detail, Topology, LLD Readiness, Decisions or Branch Patterns; the library links back to those objects. Local files are stored in this browser profile without separate encryption or access control. OneDrive files stay in OneDrive and retain its permissions; the cockpit stores their links only. A document does not automatically confirm an architectural fact.

When updating the app, replace the whole download and open the newest `index.html` in the same Chrome profile. An older app copy cannot read a workspace written with a newer schema. A startup error now shows the specific cause and does not clear the stored workspace. Do not clear Chrome site data while troubleshooting.

You can start a branch with a site name and proposed pattern, then add its devices, interfaces, circuits, subnets, observations and evidence as information arrives. Branch evidence can refer to a branch, cabinet, device, interface, circuit, wireless AP or switch. Photograph files stay as local IndexedDB Blobs; other evidence types store references and notes only. Supported image formats are JPEG, PNG, WebP and HEIC/HEIF, up to 20 MB each. Evidence classifications are explicit, and photographs never produce confirmed technical facts automatically. The Branch Pattern Catalogue contains synthetic examples only; blank targets remain Unknown.

**Current Deployment Report** imports the pre-SD-WAN 26-column `Location Branch Report` CSV. Select the CSV, review UID matches and row warnings, choose a new clean workspace or merge with the existing one, then apply. The report date comes from the filename and can be corrected before applying. A clean workspace replaces the current browser data, local documents and photographs, so export JSON first if you need them. Imported values appear on each Branch Detail as Current/Observed with source filename and row; they never set SD-WAN targets or confirm readiness. Keep the CSV and JSON backups outside Git. Windows-encoded and semicolon-delimited reports are supported.

After a report is imported, **Architecture Overview** opens with the branch estate: reported primary and secondary connectivity coverage, access types, regions, switch/AP totals and rows needing source review. The Transition and Future selectors show how many branches still need target expectations and link to Branch Patterns and Scenario Explorer. The dashboard uses the latest sourced report snapshot for each branch; it does not treat a secondary connection as proven resilience or a reported count as validated inventory.

**Topology** also shows imported branches when the selected architecture view has no modelled components. Select a reported region to see branches grouped by primary access type, then select a branch to inspect its source row. The dashed lines show report associations only. They do not assert WAN circuits or connectivity to the core. Transition, Future and other domains retain a clear unmodelled notice until architecture components and links are sourced.
**Scenario Explorer** brings in an ABACUS-style what-if comparison. Select a Transition or Future proposal, choose a saved Branch Pattern and inspect one branch or the full estate. The view groups current-to-target gaps by architecture area, shows evidence source and classification, and lists related decisions and dependencies. It does not change the branch's assigned pattern, observations or approved baseline. If a Current Deployment Report has been imported, its connectivity and subnet fields appear as source context; a reported AP count can be compared with the target while retaining its Observed classification.

Deployment assurance uses an active Design Intent baseline and sourced Observed values. **Run validation** creates immutable rule results; entering new observations or As-Built values never edits an earlier run or the baseline. Critical mandatory failures make Deployment Acceptance **FAILED**. An architect must explicitly approve exceptions and record any acceptance. The demonstration results and sources are synthetic.

Meraki Review can stage a user-selected Dashboard snapshot and apply individual values as Observed after review. The optional [macOS companion](docs/MERAKI_COMPANION.md) uses a Keychain API key and read-only Dashboard GET requests to collect that snapshot. The browser does not connect to Meraki, hold credentials, or change Design Intent automatically. The companion is not needed to open or use the browser app.

Catalyst SD-WAN validation can stage a user-selected Manager snapshot for a Branch or Campus site, then compare reviewed Observed values with versioned architecture targets. The [optional macOS collector](docs/SDWAN_COMPANION.md) uses Keychain credentials and fixed read-only Manager GET requests. Unsupported query coverage stays Unknown. The Combined Branch view brings SD-WAN, Meraki LAN and Wi-Fi, Physical, Routing and Management results together; a Critical failure blocks readiness regardless of other passing results.

**Service Flows** highlights logical paths through the selected Current, Transition or Future topology; examples cover Branch to Internet, AWS and Mainframe, plus Campus to Shared Services. **Segmentation** searches VRFs, SD-WAN VPNs, VLANs and subnets, separating sourced direct links from related site context. **Architecture Impact** gathers downstream sites, services, routing, segmentation, security, decisions, evidence and open LLD inputs for a component. These views show modelled relationships, not proof of live traffic.

**As-Built & Drift** lets an architect snapshot an accepted deployment as an As-Built Baseline. Later sourced observations compare with the frozen values. Unexplained differences can be reviewed as Expected or Approved Change with a linked architecture decision and rationale. The application never changes the baseline or remediates devices automatically.

The [Transformation Portfolio](docs/TRANSFORMATION_IMPORT.md) locally reads the two-sheet `OM Plan - streams.xlsx` format. It previews new, changed and removed source rows and data quality issues before you confirm. Architect mappings and gates stay separate from workbook planning status and survive re-import. The original workbook is not saved; JSON backup includes the imported projection and enrichment. Keep customer workbooks and backups outside Git. The XLSX parser is bundled locally, so no CDN or build is needed.

## Development verification

The application runs without developer tools. Developers with Node.js 20+ may run the dependency-free tests with `node --test tests/*.test.cjs`. Syntax checks can be run with `node --check` on each JavaScript file. There is no production build.

See [ARCHITECTURE.md](ARCHITECTURE.md), [DATA_MODEL.md](DATA_MODEL.md) and [PROJECT_STATE.md](PROJECT_STATE.md) for implementation details and scope.
