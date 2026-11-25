# Project state

The cockpit is a zero-install, direct-file browser application with IndexedDB and JSON backup. The browser CSP blocks outbound connections. Optional vendor collectors run outside the browser.

The merged Current Deployment Report import adds schema 8, sourced pre-SD-WAN Current/Observed branch snapshots and a reviewed CSV import. The Scenario Explorer adds read-only Transition/Future what-if comparisons using saved Branch Patterns. It groups gaps by architecture area, retains Current source/classification, and shows related decisions and dependencies. Imported report connectivity/subnets remain context; a reported AP count can be compared as Observed. No scenario changes assigned patterns, validation or As-Built Baselines.

The Document Library branch starts from merged main 884c963. Schema 9 adds local document metadata, architecture associations and an IndexedDB file store. Users may upload multiple files or register HTTPS OneDrive/SharePoint links, then navigate between documents and linked objects. JSON backup version 2 includes local files; version 1 restores remain supported. Only synthetic test content is committed. There is no production build step.
