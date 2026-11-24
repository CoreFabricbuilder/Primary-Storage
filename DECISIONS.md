# Technical decisions

- The MVP runs directly from `index.html` with plain HTML, CSS and classic JavaScript. This removes local build and server requirements and avoids browser `file://` module restrictions.
- IndexedDB stores the active model and photo Blobs. JSON backup/restore is explicit because browser profile data is not a durable external backup.
- The topology uses dependency-free SVG with pan, zoom, selection and filtering. It can be replaced behind `topology.js` if a graph library becomes necessary.
- Time state, perspective and evidence classification are separate fields. Readiness status changes do not change evidence classification.
- Vendor integrations are deferred; future read-only observations enter through a local adapter and require architect review before confirmation.
- No customer documents, photographs, configurations or credentials are stored in Git. The repository holds synthetic seed data and a defensive `.gitignore`.
