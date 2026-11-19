# Chira Launcher — instructions for AI agents

Read these before changing anything, in this order:

1. **`HARD_RULES.md`** — non-negotiable rules. If a task conflicts with one, stop and ask. Never "just this once".
2. **`plan.md`** — the master plan and source of truth. The **only** permitted edit is the `> **Status:**` line under each milestone heading (HR-P1): update it whenever a phase starts, progresses or finishes, and mark ✅ only after its Exit criteria were really run and passed. Never edit anything else in it; never comment out a phase.
3. **`docs/ARCHITECTURE.md`** and **`docs/DECISIONS.md`** — how the foundation is laid out and where it deliberately deviates from the plan.

## Working agreement

- Execute ordinary decisions yourself; raise only genuine architecture-changing conflicts.
- Run `pnpm verify` before committing. Never commit red. Never claim something works without running it.
- No force-push, no history rewrite, no invented remotes, no discarding uncommitted work (HR-P2, HR-P3).
- Frontend never calls Win32; native calls go `services/` → typed Tauri command → engine crate → `platform-windows`.
- After changing any DTO in `crates/desktop-protocol`, run `pnpm bindings` and commit the regenerated TypeScript.
- Shell: PowerShell is the primary shell on this machine. `pnpm` lives in `%APPDATA%\npm`; in Git Bash add it to `PATH`.

## Commands

| Command       | What it does                                                               |
| ------------- | -------------------------------------------------------------------------- |
| `pnpm dev`    | Run the desktop app (Tauri + Vite, hot reload)                             |
| `pnpm dev:ui` | UI only in a browser (no engine — shows the "engine unavailable" screen)   |
| `pnpm verify` | Everything CI runs: bindings, rules, format, lint, typecheck, tests, build |
| `pnpm build`  | Production build + installer                                               |
