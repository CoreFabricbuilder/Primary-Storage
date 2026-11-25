# Project state

The cockpit is a zero-install, direct-file browser application with IndexedDB and JSON backup. The browser CSP blocks outbound connections. Optional vendor collectors run outside the browser.

The merged Current Deployment Report import adds schema 8, sourced pre-SD-WAN Current/Observed branch snapshots and a reviewed CSV import. The Scenario Explorer adds read-only Transition/Future what-if comparisons using saved Branch Patterns. It groups gaps by architecture area, retains Current source/classification, and shows related decisions and dependencies. Imported report connectivity/subnets remain context; a reported AP count can be compared as Observed. No scenario changes assigned patterns, validation or As-Built Baselines.

This branch was rebased onto merged main c6a29a8 after PR #9 merged, so it can read schema 8 workspaces. Startup errors now show the specific cause without clearing stored data, and a future-schema workspace receives an explicit version message. Verification: 53 dependency-free Node tests, syntax, static asset and diff checks. Only synthetic data is committed; customer CSVs and backups stay outside Git. There is no production build step.
