import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

/**
 * The single seam between the UI and the native host (HR-A1). Everything above this file talks to
 * the `Transport` interface; tests swap in a fake with `setTransport`.
 */
export interface Transport {
  /** `false` when the UI runs outside the desktop host (e.g. a plain browser tab). */
  isAvailable(): boolean;
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
  /** Resolves to an unsubscribe function. */
  listen<T>(event: string, handler: (payload: T) => void): Promise<() => void>;
}

export const tauriTransport: Transport = {
  isAvailable: () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window,
  invoke: (command, args) => invoke(command, args),
  listen: (event, handler) => listen(event, (e) => handler(e.payload as never)),
};

let current: Transport = tauriTransport;

export function getTransport(): Transport {
  return current;
}

/** Replaces the transport. Intended for tests. */
export function setTransport(transport: Transport): void {
  current = transport;
}
