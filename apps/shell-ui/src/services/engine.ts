import type { AppInfo } from './bindings/AppInfo';
import type { DesktopWindow } from './bindings/DesktopWindow';
import type { Diagnostics } from './bindings/Diagnostics';
import type { Display } from './bindings/Display';
import type { EngineEvent } from './bindings/EngineEvent';
import type { FrontendErrorReport } from './bindings/FrontendErrorReport';
import type { Settings } from './bindings/Settings';
import type { ShellWindowMode } from './bindings/ShellWindowMode';
import type { SettingsPatch } from './bindings/SettingsPatch';
import { toEngineCallError } from './errors';
import { ENGINE_EVENT_CHANNEL } from './protocol';
import { getTransport } from './transport';

/**
 * Typed wrappers over the engine's command surface. Each maps 1:1 to a `#[tauri::command]` in
 * `src-tauri/src/commands.rs`. Failures are normalised to `EngineCallError`.
 */
async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await getTransport().invoke<T>(command, args);
  } catch (thrown) {
    throw toEngineCallError(thrown);
  }
}

export const engine = {
  isAvailable: () => getTransport().isAvailable(),
  getAppInfo: () => call<AppInfo>('get_app_info'),
  getSettings: () => call<Settings>('get_settings'),
  updateSettings: (patch: SettingsPatch) => call<Settings>('update_settings', { patch }),
  listDisplays: () => call<Display[]>('list_displays'),
  refreshDisplays: () => call<Display[]>('refresh_displays'),
  getDiagnostics: () => call<Diagnostics>('get_diagnostics'),
  listWindows: () => call<DesktopWindow[]>('list_windows'),
  getWindowMode: () => call<ShellWindowMode>('get_window_mode'),
  setWindowMode: (mode: ShellWindowMode) => call<ShellWindowMode>('set_window_mode', { mode }),
  exitApp: () => call<void>('exit_app'),
  reportFrontendError: (report: FrontendErrorReport) =>
    call<void>('report_frontend_error', { report }),
};

/** Subscribes to every engine event. Resolves to an unsubscribe function. */
export function subscribeToEngineEvents(
  handler: (event: EngineEvent) => void,
): Promise<() => void> {
  return getTransport().listen<EngineEvent>(ENGINE_EVENT_CHANNEL, handler);
}
