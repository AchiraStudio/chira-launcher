# Architecture

Companion to `plan.md` §4. This documents what is **built**; the plan documents what is intended.

## Layers

```text
React shell (apps/shell-ui)            UI only. Never touches Win32.
        │  typed commands + events, versioned (desktop-protocol)
Tauri host (src-tauri)                 Thin adapter. No business logic.
        │  Arc<Engine>
desktop-engine                         UI-independent composition root. No `tauri` dependency.
        │
display-manager · settings-manager · persistence        engine subsystems
        │
platform-windows                       The only crate with `unsafe`. Safe wrappers out.
        │
Windows (Win32 / DWM / WinRT …)
```

Dependency direction is one-way and enforced: engine crates cannot depend on `tauri` (`pnpm check:rules`,
HR-A4), and `unsafe` is forbidden everywhere except `platform-windows` (workspace lint + HR-A2).

## Crates

| Crate              | Responsibility                                                                                                                                                                                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `desktop-core`     | Product identity constants, `EngineError`, `AppPaths` (the `%LOCALAPPDATA%\ChiraLauncher` layout).                                                                                                                                                                         |
| `desktop-protocol` | Every type crossing the boundary (`Settings`, `Display`, `AppInfo`, `Diagnostics`, `EngineEvent`, `ProtocolError`…). `PROTOCOL_VERSION`. ts-rs → TS.                                                                                                                       |
| `platform-windows` | `EnumDisplayMonitors`/`GetDpiForMonitor`, `RtlGetVersion`, DPI-awareness query, fatal-error `MessageBox`. Non-Windows targets return `Unsupported`.                                                                                                                        |
| `display-manager`  | Owns monitor discovery. `MonitorSource` trait lets tests simulate topology changes. Detects "changed".                                                                                                                                                                     |
| `window-manager`   | Owns native HWND operations. **Today: read-only discovery** of other apps' windows (`WindowSource` trait for tests; pure `is_application_window` filter; friendly app names). No move/focus/restyle yet — those need saved originals and identity checks first (HR-W5/W6). |
| `persistence`      | SQLx/SQLite, embedded migrations, quarantine of corrupt DBs, atomic file writes.                                                                                                                                                                                           |
| `settings-manager` | Validation, partial patches, DB persistence, last-known-good snapshot in `recovery/`, DB → snapshot → defaults fallback (source is reported).                                                                                                                              |
| `desktop-engine`   | `Engine`: starts subsystems, event bus, diagnostics, frontend-error intake (size-capped, rate-limited), logging/panic hook.                                                                                                                                                |
| `src-tauri`        | Typed `#[tauri::command]`s (one-line adapters), event bridge `EngineEvent → webview`, startup/shutdown, fatal-error dialog.                                                                                                                                                |

## The command / event contract

Commands (`src-tauri/src/commands.rs`): `get_app_info`, `get_settings`, `update_settings(patch)`,
`list_displays`, `refresh_displays`, `get_diagnostics`, `report_frontend_error`, `list_windows`, and — host-level, touching only the shell's own window — `get_window_mode`, `set_window_mode`, `exit_app`. There is deliberately no
generic "run X" command (HR-A6). Failures return a serializable `ProtocolError { code, message }`; I/O errors are
reduced to a category so absolute paths stay in the log, not in the UI.

Events (`engine:event`): `settingsChanged(Settings)` and `displaysChanged(Display[])`. Each carries **full state**,
so a lagging or reconnecting UI converges without replay.

Versioning: `PROTOCOL_VERSION` (Rust) must equal `EXPECTED_PROTOCOL_VERSION` (TS); a Rust test enforces it and the
shell refuses to run against a mismatched engine. `pnpm bindings:check` fails if generated bindings drift.

## Persistence and recovery

```text
%LOCALAPPDATA%\ChiraLauncher\
├── database\desktop.db       SQLite (WAL). Source of truth for persistent state.
├── logs\chira-launcher.*.log Daily-rotated, 14 kept.
└── recovery\settings.last-known-good.json   Written atomically after every save; independent of the DB.
```

- Corrupt/not-a-database file → renamed `desktop.db.corrupt-<unix>` (never deleted), fresh DB created, surfaced in
  System settings. A database from a **newer** build is an error, not a quarantine.
- A failed settings save leaves the previous settings in force; an invalid value is rejected before anything is written.

## Frontend structure

`app/` boot, appearance, error boundary, global F11 · `shell/` the three anchors (`DynamicIsland`, `Dock`, `AmbientBackground`) and the page frame · `components/` brand mark, top chrome, display map · `features/` pages (`home`, `settings`, `pending`) · `design-system/` tokens, materials, motion,
primitives · `services/` **the only place that talks to Tauri** (`transport` → `engine`) · `stores/` zustand state
(`engine`, `settings`, `displays`, `windows`, `shell` (own-window mode), `island`, `ambient`, `nav`) · `lib/` pure helpers.

State rule: the UI renders what the engine confirmed. Updates are serialised and not optimistic — the local round
trip is milliseconds, so there is nothing to reconcile.

## Extension points (not yet built)

| Plan area                           | Where it plugs in                                                                             |
| ----------------------------------- | --------------------------------------------------------------------------------------------- |
| M01 window engine, window lab       | new `window-manager` crate over `platform-windows`; new commands; a `features/developer` page |
| M02 sessions, M03 workspaces/layout | `process-manager`, `session-manager`, `layout-engine` (pure), `workspace-manager` crates      |
| M03 monitor hot-plug                | event-driven detection feeding `DisplayManager::refresh` (debounced)                          |
| M05 per-monitor surfaces            | `overlay-manager`; tauri multi-window; `capabilities/` entries per window                     |
| M07 supervisor, shell modes         | separate `shell-supervisor` binary; `shell-manager` crate                                     |
| Plugins / automation                | `plugin-host`, `automation-engine`; permissions enforced in Rust                              |
