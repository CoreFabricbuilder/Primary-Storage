# Project state

Phase 7 `codex/phase-7-architecture-intelligence` starts from merged main `4215549`. The cockpit remains a zero-install direct-file browser application with IndexedDB and JSON backup. Its browser CSP blocks outbound connections. Vendor collectors are optional and run outside the browser.

Implemented: schema 7 migration; Service Flow Explorer with state-aware highlighted logical paths; Segmentation Explorer for VRF, SD-WAN VPN, VLAN and subnet with explicit sourced links and clearly labelled site context; Architecture Impact for dependent sites, services, routing, segmentation, security, decisions, evidence and open LLD categories; and architect-created As-Built Baselines from accepted assurance runs. Later sourced observations are compared against frozen baseline values and classified No Change, Expected Change, Approved Change or Unexplained Drift. Expected and Approved changes require an architecture decision and architect rationale; none modifies the baseline or devices.

Verification: 45 dependency-free Node tests, JavaScript syntax, static local asset checks and `git diff --check`. No production build step exists. Live Meraki and Catalyst SD-WAN Manager connectivity, optional collectors and macOS browser interaction were not available for this phase. Only synthetic demonstration data is committed.
