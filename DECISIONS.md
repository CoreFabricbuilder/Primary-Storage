# Technical decisions

- The MVP runs directly from `index.html` with plain HTML, CSS and classic JavaScript. This removes local build and server requirements and avoids browser `file://` module restrictions.
- IndexedDB stores the active model and photo Blobs. JSON backup/restore is explicit because browser profile data is not a durable external backup.
- The topology uses dependency-free SVG with pan, zoom, selection and filtering. It can be replaced behind `topology.js` if a graph library becomes necessary.
- Time state, perspective and evidence classification are separate fields. Readiness status changes do not change evidence classification.
- Vendor integrations are deferred; future read-only observations enter through a local adapter and require architect review before confirmation.
- No customer documents, photographs, configurations or credentials are stored in Git. The repository holds synthetic seed data and a defensive `.gitignore`.
- Phase 2 uses sparse `branchAttributes` for Physical and Logical observations. A missing value remains Unknown; current observations do not overwrite inherited pattern targets.
- Branch patterns are editable reusable intent. Three synthetic examples demonstrate different targets without asserting any final client pattern.
- Branch evidence metadata and photograph Blobs are linked by stable photo ID; photo changes are atomic across both IndexedDB stores. Non-photo evidence stores references only.
- The estate matrix shows classifications and partial coverage rather than a project percentage. Current-versus-target deltas are comparisons, not validation or acceptance results.
- Schema 1 browser workspaces and JSON backups migrate to schema 2. Existing evidence classifications are preserved.
