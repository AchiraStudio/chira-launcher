# Design system: Adaptive Glass

Implements the foundations of `plan.md` §16. Source of truth: `apps/shell-ui/src/design-system/`.

## Tokens (`tokens.css`)

Primitives from the plan (§16.2): **Obsidian** `#101114`, **Graphite** `#191C22`, **Slate** `#252A32`, **Azure** `#3979B9`.
Semantic roles (`--bg`, `--surface-1..3`, `--fg`, `--muted`, `--faint`, `--line`, `--accent`, status colours) are
defined per theme (`data-theme="dark|light"`) and exposed to Tailwind (`bg-surface-1`, `text-muted`, `border-line`…).
The accent is user-configurable (`#RRGGBB`, validated in Rust); its foreground is chosen for WCAG contrast.

Typography: **Manrope Variable** (bundled, no CDN), `Cascadia Mono` for code. Radii: card 22px, control 12px.
Typography scale and spacing beyond Tailwind's defaults are still open (plan §26.9).

## Materials (`materials.css`)

| Class         | Use               | Notes                                                   |
| ------------- | ----------------- | ------------------------------------------------------- |
| `mat-clear`   | Floating controls | Light tint, blur 16px                                   |
| `mat-frosted` | Navigation panels | Blur 30px (sidebar)                                     |
| `mat-smoked`  | Cards and docks   | Dark translucent (Home cards)                           |
| `mat-solid`   | Text-heavy panels | **Opaque** (Settings) — glass does not cover everything |
| `mat-accent`  | Active selection  | Accent-tinted                                           |

The shell paints its own wallpaper (`.wallpaper`): a webview cannot sample the real desktop (plan §16.3).

## Quality profiles (§16.6) — `data-quality` on `<html>`

| Profile       | Effect                                                                                |
| ------------- | ------------------------------------------------------------------------------------- |
| `performance` | No `backdrop-filter` anywhere; materials fall back to opaque surfaces; flat wallpaper |
| `balanced`    | Default glass                                                                         |
| `ultra`       | Adds a static specular sheen to large glass surfaces                                  |

## Motion (§16.5)

Tokens: instant 100 · quick 160 · standard 240 · spatial 360 · cinematic 500 · background 700 ms
(`--motion-*` in CSS, `duration` in `motion.ts`). Only `transform`/`opacity` animate; materials never animate blur or
shadow. `Reduced` (or the Windows setting under `System`) sets `data-motion="reduced"` (CSS durations collapse) and
`<MotionConfig reducedMotion>` (layout animations).

## Components

`Surface`, `Button`, `Badge`, `SegmentedControl`, `RadioCardGroup` (roving-tabindex keyboard model shared via
`useRadioKeys`). Focus rings are always visible. Controller/spatial navigation arrives with the Input Manager (M05/M06).

## Shell anatomy (plan §11)

| Anchor         | Component             | Behaviour                                                                                                                                                                     |
| -------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home           | `features/home`       | Listbox carousel (arrows / hover / Enter), 1.16× scale + glow ring on the highlighted card, caption below, `ambient` background crossfades to the card's tone (opacity only). |
| Dynamic Island | `shell/DynamicIsland` | Compact pill (time) → brief **activity** (real engine events) → expanded system panel. One surface that resizes as a unit; Esc closes.                                        |
| Floating dock  | `shell/Dock`          | Centred, detached, three zones. Hover magnification is a transform (`scale`, origin bottom) driven by a spring; disabled under reduced motion.                                |

The shell launches **borderless fullscreen**; see HR-W11 for the escape routes.
