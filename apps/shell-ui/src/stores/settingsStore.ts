import { create } from 'zustand';
import { engine } from '@/services/engine';
import { toEngineCallError } from '@/services/errors';
import type { Settings } from '@/services/bindings/Settings';
import type { SettingsPatch } from '@/services/bindings/SettingsPatch';

interface SettingsState {
  /** `null` until the engine has answered. */
  settings: Settings | null;
  /** Message of the last failed update; cleared by the next successful one. */
  error: string | null;
  load: () => Promise<void>;
  /** Sends a patch to the engine and adopts the result. Resolves `true` on success. */
  update: (patch: SettingsPatch) => Promise<boolean>;
  /** Adopts settings announced by the engine (e.g. changed from another window). */
  applyRemote: (settings: Settings) => void;
  clearError: () => void;
}

/**
 * Updates are serialised so two quick interactions are applied by the engine in the order the
 * user made them. The UI shows what the engine confirmed, never a guess — a round trip to the
 * local engine is a few milliseconds, so there is no optimistic state to reconcile.
 */
let queue: Promise<unknown> = Promise.resolve();

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  error: null,

  load: async () => {
    set({ settings: await engine.getSettings() });
  },

  update: (patch) => {
    const run = async (): Promise<boolean> => {
      try {
        const settings = await engine.updateSettings(patch);
        set({ settings, error: null });
        return true;
      } catch (thrown) {
        set({ error: toEngineCallError(thrown).message });
        return false;
      }
    };
    const result = queue.then(run, run);
    queue = result;
    return result;
  },

  applyRemote: (settings) => set({ settings }),
  clearError: () => set({ error: null }),
}));
