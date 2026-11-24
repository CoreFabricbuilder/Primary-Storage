# Project state

Phase 4 branch: `codex/phase-4-meraki-integration`, created from merged main `634da45`. The application remains a direct-file browser app with IndexedDB and JSON backups. The browser has no network access, build, server, AI, telemetry or cloud storage.

Implemented: schema 4 migration; Meraki Review screen; strict local snapshot parser; explicit branch mapping; staged Pending candidates with provenance; individual Apply as Observed or Dismiss decisions; synthetic Meraki demonstration data; and an optional macOS read-only collector using Keychain and built-in tools. The collector projects only supported fields into the snapshot. Design Intent, architect confirmation, baselines and existing validation runs stay separate.

Verification: 23 dependency-free Node tests, JavaScript and Bash syntax checks, `git diff --check`, and a Chromium UI smoke test of the review screen and persisted Apply action. Live Meraki/Keychain collection requires a macOS account with read-only Dashboard access; no customer data or credentials are in Git. No production build exists.

Next: review and merge this PR before Phase 5 branches from updated main. Catalyst SD-WAN Manager integration and native packaging remain deferred.
