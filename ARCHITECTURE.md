# Architecture

The MVP is a zero-install local browser application. `index.html` loads only adjacent CSS and classic JavaScript files, so it runs from `file://` without a server or build. There are no external libraries, CDN resources, outbound API calls, telemetry, analytics, cloud storage or runtime AI. The content security policy blocks network connections and limits resources to local files and local photo blobs.

`model.js` owns vocabulary, relationships, validation and pure mutations. `demo.js` creates synthetic data. `storage.js` owns IndexedDB and versioned JSON backup/restore; the `workspaces` store holds the normalized architecture model and the `photos` store holds user-selected image Blobs. `views.js` renders six screens; `topology.js` renders the interactive logical graph as local SVG; `app.js` coordinates user actions and persistence. All dynamic text is escaped or assigned with `textContent`.

Current, Transition and Future are time states. Design Intent, Observed, Validated and As-Built are perspectives. Evidence classifications are separate and cannot be inferred from a readiness status. Facts, sources, evidence, validation rules and results retain provenance. A future local integration service can supply read-only vendor observations through an explicit import/validation adapter; it must write Observed records and leave Design Intent and architect confirmation to explicit review. No integration service or vendor connection is part of this MVP.

Browser storage is scoped to the browser profile and file origin. Native macOS packaging, Keychain use, Meraki Dashboard and Catalyst SD-WAN Manager integrations are deferred. The browser file picker is used for JSON backups and photographs; the application does not scan local directories.
