import type { AppInfo } from '@/services/bindings/AppInfo';
import type { Diagnostics } from '@/services/bindings/Diagnostics';
import type { Display } from '@/services/bindings/Display';
import type { EngineEvent } from '@/services/bindings/EngineEvent';
import type { Settings } from '@/services/bindings/Settings';
import type { SettingsPatch } from '@/services/bindings/SettingsPatch';
import { EXPECTED_PROTOCOL_VERSION } from '@/services/protocol';
import { setTransport, type Transport } from '@/services/transport';

/**
 * Test double for the native host. It sits behind the `Transport` seam, so the real stores,
 * services and components run unmodified against it.
 */
export const defaultSettings: Settings = {
  schemaVersion: 1,
  appearance: { theme: 'dark', accent: '#3979B9', qualityProfile: 'balanced', motion: 'system' },
};

export const sampleDisplays: Display[] = [
  {
    id: '\\\\.\\DISPLAY1',
    label: 'Display 1',
    deviceName: '\\\\.\\DISPLAY1',
    isPrimary: true,
    bounds: { x: 0, y: 0, width: 2560, height: 1440 },
    workArea: { x: 0, y: 0, width: 2560, height: 1400 },
    dpiScale: 1.5,
    refreshRateHz: 144,
  },
  {
    id: '\\\\.\\DISPLAY2',
    label: 'Display 2',
    deviceName: '\\\\.\\DISPLAY2',
    isPrimary: false,
    bounds: { x: 2560, y: 0, width: 1920, height: 1080 },
    workArea: { x: 2560, y: 0, width: 1920, height: 1080 },
    dpiScale: 1,
  },
];

export const sampleAppInfo: AppInfo = {
  name: 'Chira Launcher',
  slug: 'chira-launcher',
  identifier: 'com.chira.launcher',
  version: '0.1.0',
  protocolVersion: EXPECTED_PROTOCOL_VERSION,
  system: {
    osName: 'Windows 11',
    osVersion: '10.0',
    osBuild: 26200,
    dpiAwareness: 'per-monitor-v2',
  },
};

export const sampleDiagnostics: Diagnostics = {
  app: sampleAppInfo,
  paths: {
    dataDir: 'C:\\Users\\test\\AppData\\Local\\ChiraLauncher',
    logsDir: 'C:\\Users\\test\\AppData\\Local\\ChiraLauncher\\logs',
    databaseFile: 'C:\\Users\\test\\AppData\\Local\\ChiraLauncher\\database\\desktop.db',
    recoveryDir: 'C:\\Users\\test\\AppData\\Local\\ChiraLauncher\\recovery',
  },
  database: { schemaVersion: 1 },
  settingsSource: 'database',
  uptimeSeconds: 5,
  frontendReportsDropped: 0,
};

export interface FakeEngine {
  calls: Array<{ command: string; args?: Record<string, unknown> }>;
  settings: Settings;
  displays: Display[];
  appInfo: AppInfo;
  /** Make the next call to `command` reject with this error. */
  failNext: (command: string, error: unknown) => void;
  /** Deliver an engine event to subscribers, as the host's event bridge would. */
  emit: (event: EngineEvent) => void;
  available: boolean;
}

export function installFakeEngine(
  overrides: Partial<Pick<FakeEngine, 'available' | 'appInfo'>> = {},
): FakeEngine {
  const listeners = new Set<(payload: EngineEvent) => void>();
  const failures = new Map<string, unknown>();

  const fake: FakeEngine = {
    calls: [],
    settings: structuredClone(defaultSettings),
    displays: structuredClone(sampleDisplays),
    appInfo: overrides.appInfo ?? sampleAppInfo,
    available: overrides.available ?? true,
    failNext: (command, error) => failures.set(command, error),
    emit: (event) => listeners.forEach((l) => l(event)),
  };

  const handlers: Record<string, (args?: Record<string, unknown>) => unknown> = {
    get_app_info: () => fake.appInfo,
    get_settings: () => fake.settings,
    update_settings: (args) => {
      const patch = args?.patch as SettingsPatch;
      fake.settings = {
        ...fake.settings,
        appearance: { ...fake.settings.appearance, ...patch.appearance },
      };
      return fake.settings;
    },
    list_displays: () => fake.displays,
    refresh_displays: () => fake.displays,
    get_diagnostics: () => sampleDiagnostics,
    report_frontend_error: () => undefined,
  };

  const transport: Transport = {
    isAvailable: () => fake.available,
    invoke: async <T>(command: string, args?: Record<string, unknown>) => {
      fake.calls.push({ command, args });
      if (failures.has(command)) {
        const error = failures.get(command);
        failures.delete(command);
        throw error;
      }
      const handler = handlers[command];
      if (!handler) throw new Error(`fake engine has no handler for ${command}`);
      return handler(args) as T;
    },
    listen: async <T>(_event: string, handler: (payload: T) => void) => {
      const typed = handler as (payload: EngineEvent) => void;
      listeners.add(typed);
      return () => listeners.delete(typed);
    },
  };

  setTransport(transport);
  return fake;
}
