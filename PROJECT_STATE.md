# Project state

The cockpit is a zero-install, direct-file browser application with IndexedDB and JSON backup. The browser CSP blocks outbound connections. Optional vendor collectors run outside the browser.

The merged Current Deployment Report import adds schema 8, sourced pre-SD-WAN Current/Observed branch snapshots and a reviewed CSV import. The overview now summarizes imported branch coverage, access types, regions, reported switch/AP counts and source issues. Transition/Future views show target-pattern coverage and direct the architect to define intent; they do not treat imported values as validated. The Scenario Explorer adds read-only what-if comparisons using saved Branch Patterns. It groups gaps by architecture area, retains Current source/classification, and shows related decisions and dependencies. No scenario changes assigned patterns, validation or As-Built Baselines.

This overview branch starts from merged main 884c963 (PR #10), so it includes schema 8 support and Scenario Explorer. Startup errors show the specific cause without clearing stored data. Verification: 54 dependency-free Node tests, a synthetic Chrome overview smoke check, an outside-Git 262-row report dry run, syntax, static asset and diff checks. Only synthetic data is committed; customer CSVs and backups stay outside Git. There is no production build step.
