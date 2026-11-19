# Chira Launcher

A customizable, high-performance desktop environment for Windows: one place to launch apps and games,
manage windows, workspaces and displays, with a console-polished interface.

> **Status: foundation.** The architecture, design system, engine⇄UI contract, persistence, diagnostics
> and tooling are in place and running. The window engine (the heart of the product) is the next
> milestone. See [`plan.md`](plan.md) for the full vision and roadmap, and the **Status** line under each
> milestone for what is finished.

**Stack:** Rust · Tauri 2 · React 19 · TypeScript · Tailwind CSS 4 · Motion · SQLite (SQLx) · `windows-rs`

## What works today

- Native Tauri 2 host with a **UI-independent Rust engine** behind a typed, versioned command/event protocol
  (TypeScript bindings are generated from the Rust types).
- **Adaptive Glass** design system: tokens, five materials, dark/light themes, accent colours, quality
  profiles (Performance / Balanced / Ultra) and reduced-motion support.
- **Shell (PS5-inspired):** launches in **borderless fullscreen**; a Home focus carousel whose background follows the
  highlighted card, a **Dynamic Island** (time, live activities from real engine events, expandable system panel) and a
  **floating dock** with hover magnification. Escape routes: **F11**, the Island's _Leave fullscreen_/_Exit_, and Alt+F4.
- Home shows real data: a to-scale map of your monitors and the **application windows open right now** (read-only
  window discovery — the first step of M01). Settings: Personalization, Displays, System diagnostics.
- Real Windows integration through `platform-windows`: monitor enumeration (bounds, work area, per-monitor DPI,
  refresh rate), Windows version, DPI-awareness check.
- Persistence: SQLite with versioned migrations, corruption quarantine, atomic writes and a
  last-known-good settings snapshot in a separate `recovery/` folder.
- Diagnostics: structured logging to a rotating file, panic capture, UI crash reporting into the engine log.

Destinations whose milestone is not built yet (Library, Games, Files, Workspaces, Multitasking, Widgets) say so
plainly instead of pretending to work.

## Prerequisites

| Tool                      | Version                                                |
| ------------------------- | ------------------------------------------------------ |
| Windows                   | 11 (10 best-effort) with WebView2 (preinstalled on 11) |
| Rust                      | stable ≥ 1.88 (`rustup`), MSVC toolchain               |
| Visual Studio Build Tools | "Desktop development with C++" workload                |
| Node.js                   | ≥ 22                                                   |
| pnpm                      | ≥ 10 (`npm i -g pnpm`)                                 |

> **npm 12 note:** npm 12 blocks install scripts by default, which leaves pnpm's Windows shim broken
> (`'…\pnpm' is not recognized`). Install it with `npm install -g pnpm --allow-scripts=pnpm`.

## Getting started

```powershell
pnpm install
pnpm dev          # runs the desktop app with hot reload
```

User data lives in `%LOCALAPPDATA%\ChiraLauncher\` (`database/`, `logs/`, `recovery/`). Set
`CHIRA_LAUNCHER_DATA_DIR` to use a throw-away location while developing, and `CHIRA_LOG=debug` for verbose logs.

## Commands

| Command                     | Purpose                                                                        |
| --------------------------- | ------------------------------------------------------------------------------ |
| `pnpm dev`                  | Desktop app (Tauri + Vite, hot reload)                                         |
| `pnpm dev:ui`               | UI only, in a browser — shows the "engine not connected" screen (no mock data) |
| `pnpm build`                | Production build and NSIS installer (`target/release/bundle/nsis/`)            |
| `pnpm verify`               | **Everything CI runs.** Run before every commit                                |
| `pnpm check:rules`          | Machine-checkable [`HARD_RULES.md`](HARD_RULES.md) enforcement                 |
| `pnpm bindings`             | Regenerate TypeScript bindings from `crates/desktop-protocol`                  |
| `pnpm test`                 | Rust, UI and script tests                                                      |
| `pnpm lint` / `pnpm format` | Clippy + ESLint / rustfmt + Prettier                                           |

`pnpm verify` builds the UI before compiling Rust: the Tauri host embeds `apps/shell-ui/dist` at compile time.

## Repository layout

```text
apps/shell-ui/        React + TypeScript shell (design system, features, stores, services)
src-tauri/            Tauri host — a thin adapter: commands → engine, engine events → webview
crates/
  desktop-core/       identity, EngineError, on-disk layout
  desktop-protocol/   versioned commands/events/DTOs → generated TS bindings
  desktop-engine/     UI-independent composition root (never depends on Tauri)
  platform-windows/   the ONLY crate with unsafe Win32 code
  display-manager/    monitor discovery and model
  window-manager/     native window discovery (read-only today)
  settings-manager/   settings validation, persistence, recovery
  persistence/        SQLite (SQLx) + migrations + atomic writes
docs/                 ARCHITECTURE · DECISIONS · DESIGN_SYSTEM
resources/            source artwork (icon)
scripts/              rules + bindings checks
plan.md               the master plan (source of truth)
HARD_RULES.md         non-negotiable rules
```

More crates (`window-manager`, `layout-engine`, `workspace-manager`, …) are extracted as their milestones begin;
see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Working agreement

Read [`HARD_RULES.md`](HARD_RULES.md) before contributing — it is enforced by `pnpm check:rules` and CI.
AI agents are pointed at it through [`CLAUDE.md`](CLAUDE.md).

## License

Not chosen yet (open question in `plan.md` §26). All rights reserved until decided.
