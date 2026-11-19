/**
 * Hand-written protocol constants. The DTO types themselves are GENERATED into ./bindings
 * from `crates/desktop-protocol` (run `pnpm bindings`) and must never be edited by hand.
 */

/**
 * Protocol version this UI was written against. Must equal `PROTOCOL_VERSION` in
 * `crates/desktop-protocol` — a Rust test enforces it (HR-A8).
 */
export const EXPECTED_PROTOCOL_VERSION = 1;

/** Tauri event channel carrying every EngineEvent. Mirrors `ENGINE_EVENT_CHANNEL`. */
export const ENGINE_EVENT_CHANNEL = 'engine:event';
