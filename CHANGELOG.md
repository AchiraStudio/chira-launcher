# Changelog

All notable changes to Chira Launcher are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/) (pre-1.0: minor versions may change behaviour).

The release workflow publishes the section matching the pushed tag as the GitHub release notes, and
fails if that section is missing — so every release has a changelog entry. See "Releasing" in the README.

## [Unreleased]

### Added

- Nothing yet.

## [0.1.0] - 2026-11-19

First public build: the application foundation, the PS5-inspired shell, and the first step of the
window engine. The window engine itself (arranging, focusing and launching apps) is not built yet.

### Added

- **Fullscreen shell.** Launches in borderless fullscreen. Leave it with **F11**, the Dynamic Island's
  _Leave fullscreen_ / _Exit_, or Alt+F4 — also after an interface crash.
- **Home.** A PS5-style focus carousel (arrow keys, hover or Enter) whose background glow follows the
  highlighted card, with a to-scale map of your real monitors and a **Running now** list of the
  application windows open on your PC.
- **Dynamic Island.** A top-centre pill showing the time and briefly announcing real events (settings saved,
  displays changed, fullscreen toggled); click it for live system info, a visual-quality switch,
  fullscreen toggle and Exit.
- **Floating dock** with hover magnification.
- **Adaptive Glass design system:** dark and light themes, custom accent colour, Performance / Balanced /
  Ultra quality profiles, and reduced-motion support (follows the Windows setting by default).
- **Settings:** Personalization, Displays and System diagnostics.
- **Engine:** Rust engine behind a typed, versioned protocol; SQLite storage with migrations, corrupt-database
  quarantine and a last-known-good settings snapshot; rotating logs; per-monitor-v2 DPI awareness.
- **Read-only window discovery** (first step of milestone M01): lists real application windows, filtering out
  background, cloaked, tool, owned and shell windows.
- Windows installer (NSIS, per-user, no administrator rights needed).

### Known limitations

- Running apps show letter tiles instead of their own icons; real executable icons, upscaled for HD, are planned.
- Sections such as Library, Games, Files, Workspaces, Multitasking and Widgets are placeholders that name the
  milestone delivering them.
- The installer is **not code-signed**, so Windows SmartScreen may warn on first run.
- Display detection has only been tested on a single-monitor setup.

[Unreleased]: https://github.com/AchiraStudio/chira-launcher/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/AchiraStudio/chira-launcher/releases/tag/v0.1.0
