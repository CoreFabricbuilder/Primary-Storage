# Decisions

1. **Local Tauri boundary:** One Rust command owns native folder selection and SQLite access. The frontend gets no shell or general filesystem capability.
2. **External project storage:** A hidden SQLite file resides in the selected directory, which must be outside a Git worktree. No project data is committed.
3. **Migration ownership:** The Rust `cockpit-storage` crate applies numbered SQL migrations in a transaction and rejects a newer database schema. It can be tested without a desktop UI dependency.
4. **Separate architecture axes:** Time horizon, information perspective, and evidence classification are separate fields. A fact's classification is explicit.
5. **Minimal phase 0 UI:** The interface only opens a project and reports storage readiness. Cytoscape.js is installed for a later phase.
