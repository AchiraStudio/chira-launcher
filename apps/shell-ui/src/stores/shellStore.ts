import { create } from 'zustand';
import { engine } from '@/services/engine';
import { toEngineCallError } from '@/services/errors';
import type { ShellWindowMode } from '@/services/bindings/ShellWindowMode';
import { useIslandStore } from './islandStore';

interface ShellState {
  /** How the shell's own window is presented. It launches fullscreen. */
  windowMode: ShellWindowMode;
  error: string | null;
  load: () => Promise<void>;
  setWindowMode: (mode: ShellWindowMode) => Promise<void>;
  toggleFullscreen: () => Promise<void>;
  exit: () => Promise<void>;
}

export const useShellStore = create<ShellState>((set, get) => ({
  windowMode: 'fullscreen',
  error: null,

  load: async () => {
    try {
      set({ windowMode: await engine.getWindowMode(), error: null });
    } catch (thrown) {
      set({ error: toEngineCallError(thrown).message });
    }
  },

  setWindowMode: async (mode) => {
    try {
      const applied = await engine.setWindowMode(mode);
      set({ windowMode: applied, error: null });
      useIslandStore.getState().announce({
        kind: 'window-mode',
        title: applied === 'fullscreen' ? 'Fullscreen' : 'Windowed',
      });
    } catch (thrown) {
      set({ error: toEngineCallError(thrown).message });
    }
  },

  toggleFullscreen: () =>
    get().setWindowMode(get().windowMode === 'fullscreen' ? 'windowed' : 'fullscreen'),

  exit: async () => {
    try {
      await engine.exitApp();
    } catch (thrown) {
      set({ error: toEngineCallError(thrown).message });
    }
  },
}));
