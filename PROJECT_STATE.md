# Project state

Branch: `codex/browser-mvp-foundation`, created from latest main. The Tauri Phase 0 and Phase 1 branches are separate and are not merged here.

Implemented: direct-file browser shell, six architecture screens, synthetic network example, Current/Transition/Future views, evidence-aware model, interactive SVG topology, IndexedDB persistence, editable LLD readiness/decisions/dependency resolution, branch/device photo storage, and versioned JSON backup/restore. No runtime dependencies or build step.

Scope: architecture visibility MVP. Native packaging, vendor APIs, project management, telemetry and cloud services are outside this branch.

Verification: six dependency-free model/security tests pass; all JavaScript syntax checks and `git diff --check` pass. Direct browser launch remains unverified in this Linux execution environment because Chromium stalls even on `about:blank`; macOS browser smoke testing is still needed during PR review. There is no production build by design.
