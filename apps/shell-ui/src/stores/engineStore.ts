import { create } from 'zustand';
import { engine, subscribeToEngineEvents } from '@/services/engine';
import { toEngineCallError } from '@/services/errors';
import { EXPECTED_PROTOCOL_VERSION } from '@/services/protocol';
import type { AppInfo } from '@/services/bindings/AppInfo';
import type { EngineEvent } from '@/services/bindings/EngineEvent';
import { useDisplayStore } from './displayStore';
import { useIslandStore } from './islandStore';
import { useSettingsStore } from './settingsStore';
import { useShellStore } from './shellStore';

export type EnginePhase = 'booting' | 'ready' | 'unavailable' | 'failed';

interface EngineState {
  phase: EnginePhase;
  appInfo: AppInfo | null;
  error: string | null;
  /** Connects to the engine. Safe to call more than once (React StrictMode mounts twice). */
  boot: () => Promise<void>;
}

let booting: Promise<void> | null = null;

/** Applies an engine event to the stores and lets the Island announce it. */
function handleEngineEvent(event: EngineEvent): void {
  const island = useIslandStore.getState();
  if (event.type === 'settingsChanged') {
    useSettingsStore.getState().applyRemote(event.payload);
    island.announce({ kind: 'settings', title: 'Settings saved' });
  } else {
    useDisplayStore.getState().applyRemote(event.payload);
    const count = event.payload.length;
    island.announce({
      kind: 'displays',
      title: 'Displays changed',
      detail: `${count} connected`,
    });
  }
}

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
        await subscribeToEngineEvents(handleEngineEvent);

        await useSettingsStore.getState().load();
        // These report their own failures on the pages that use them; neither blocks the shell.
        await useDisplayStore.getState().load();
        await useShellStore.getState().load();

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
