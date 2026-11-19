import { create } from 'zustand';
import { engine, subscribeToEngineEvents } from '@/services/engine';
import { toEngineCallError } from '@/services/errors';
import { EXPECTED_PROTOCOL_VERSION } from '@/services/protocol';
import type { AppInfo } from '@/services/bindings/AppInfo';
import { useDisplayStore } from './displayStore';
import { useSettingsStore } from './settingsStore';

export type EnginePhase = 'booting' | 'ready' | 'unavailable' | 'failed';

interface EngineState {
  phase: EnginePhase;
  appInfo: AppInfo | null;
  error: string | null;
  /** Connects to the engine. Safe to call more than once (React StrictMode mounts twice). */
  boot: () => Promise<void>;
}

let booting: Promise<void> | null = null;

export const useEngineStore = create<EngineState>((set) => ({
  phase: 'booting',
  appInfo: null,
  error: null,

  boot: () => {
    booting ??= (async () => {
      if (!engine.isAvailable()) {
        set({ phase: 'unavailable' });
        return;
      }
      try {
        const appInfo = await engine.getAppInfo();
        if (appInfo.protocolVersion !== EXPECTED_PROTOCOL_VERSION) {
          throw new Error(
            `The engine speaks protocol v${appInfo.protocolVersion} but this interface expects v${EXPECTED_PROTOCOL_VERSION}.`,
          );
        }

        // Subscribe before the initial reads so a change in between cannot be missed.
        await subscribeToEngineEvents((event) => {
          if (event.type === 'settingsChanged')
            useSettingsStore.getState().applyRemote(event.payload);
          else useDisplayStore.getState().applyRemote(event.payload);
        });

        await useSettingsStore.getState().load();
        // A display failure is shown on the pages that need displays; it must not block the shell.
        await useDisplayStore.getState().load();

        set({ phase: 'ready', appInfo, error: null });
      } catch (thrown) {
        set({ phase: 'failed', error: toEngineCallError(thrown).message });
      }
    })();
    return booting;
  },
}));

/** Test helper: forget a previous boot so each test starts clean. */
export function resetEngineBootForTests(): void {
  booting = null;
  useEngineStore.setState({ phase: 'booting', appInfo: null, error: null });
}
