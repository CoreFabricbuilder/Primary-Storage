# Architecture

The React webview is a thin local interface. It can call one Tauri command, `select_project`, which opens the native folder picker in Rust. The webview cannot supply an arbitrary filesystem path. Rust validates the selected directory, applies SQLite migrations through the small `cockpit-storage` crate, and returns only the folder name and schema version.

SQLite lives at `<selected project directory>/.network-refresh-cockpit.sqlite3`. The directory must be outside a Git worktree. Selection is required each launch; the path is not copied into source, browser storage, or a second database. Rust owns filesystem and database access. Tauri grants core window permissions only; there is no shell or filesystem plugin, remote listener, telemetry, or application API client. Vite binds to loopback for development.

The model separates time horizon (Current, Transition, Future) from information perspective (Design Intent, Observed, Validated, As-Built). Evidence classification is independent. No automatic promotion between perspectives or classifications is implemented.

Structured JSON logs contain application lifecycle and error categories, without project data or selected paths. The foundation uses Cytoscape.js only as an installed dependency; topology views come later.
