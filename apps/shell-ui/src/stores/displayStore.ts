import { create } from 'zustand';
import { engine } from '@/services/engine';
import { toEngineCallError } from '@/services/errors';
import type { Display } from '@/services/bindings/Display';

interface DisplayState {
  displays: Display[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  load: () => Promise<void>;
  /** Re-scans the monitors in the engine (the engine announces changes via events). */
  refresh: () => Promise<void>;
  applyRemote: (displays: Display[]) => void;
}

export const useDisplayStore = create<DisplayState>((set) => {
  const run = async (fetch: () => Promise<Display[]>) => {
    set({ status: 'loading', error: null });
    try {
      set({ displays: await fetch(), status: 'ready' });
    } catch (thrown) {
      set({ status: 'error', error: toEngineCallError(thrown).message });
    }
  };

  return {
    displays: [],
    status: 'idle',
    error: null,
    load: () => run(engine.listDisplays),
    refresh: () => run(engine.refreshDisplays),
    applyRemote: (displays) => set({ displays, status: 'ready', error: null }),
  };
});
