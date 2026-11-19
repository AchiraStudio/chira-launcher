import { create } from 'zustand';
import { engine } from '@/services/engine';
import { toEngineCallError } from '@/services/errors';
import type { DesktopWindow } from '@/services/bindings/DesktopWindow';

interface WindowsState {
  /** Other applications' windows, front to back. Read-only (M01 discovery). */
  windows: DesktopWindow[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Discovery is on demand — when Home appears, when the shell regains focus, or when the user asks —
 * never on a timer (HR-Q3). Event-driven updates arrive with the WinEvent hooks (M01).
 */
export const useWindowsStore = create<WindowsState>((set) => ({
  windows: [],
  status: 'idle',
  error: null,
  refresh: async () => {
    set({ status: 'loading', error: null });
    try {
      set({ windows: await engine.listWindows(), status: 'ready' });
    } catch (thrown) {
      set({ status: 'error', error: toEngineCallError(thrown).message });
    }
  },
}));
