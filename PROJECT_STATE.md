# Project state

Phase 6 `codex/phase-6-sdwan-validation` starts from merged main `16a6cec`. The cockpit remains a zero-install direct-file browser app with IndexedDB and JSON backup. The browser has no network access, server, build, telemetry, cloud database or runtime AI.

Implemented: schema 6 migration; read-only Catalyst SD-WAN snapshot schema and optional Keychain-backed macOS collector; Branch/Campus site mapping; per-candidate observation review; versioned Design Intent targets; deterministic validation history for WAN Edge quantity, Site ID, System IP, reachability, colours, VPN IDs, TLOCs, BFD, control, OMP, service-side status, associations and alarms where available; and a combined Branch view covering SD-WAN, Meraki LAN/Wi-Fi, Physical, Routing and Management. Critical failures govern the overall state.

Verification: Node tests, JavaScript/Bash syntax checks and direct-file asset checks. No build step exists. Live Catalyst SD-WAN Manager access and macOS collector execution were unavailable here, so endpoint coverage and Keychain session behavior need validation on a representative Manager release. Only synthetic data is committed.
