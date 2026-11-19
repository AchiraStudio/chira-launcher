import { create } from 'zustand';

/** What the Dynamic Island is currently announcing. Only real engine/shell events become activities. */
export interface IslandActivity {
  id: number;
  kind: 'settings' | 'displays' | 'window-mode';
  title: string;
  detail?: string;
}

interface IslandState {
  expanded: boolean;
  activity: IslandActivity | null;
  setExpanded: (expanded: boolean) => void;
  toggle: () => void;
  /** Announces something briefly in the compact Island; a newer activity replaces an older one. */
  announce: (activity: Omit<IslandActivity, 'id'>) => void;
  dismissActivity: () => void;
}

const ACTIVITY_MS = 3200;
let nextId = 1;
let timer: ReturnType<typeof setTimeout> | undefined;

export const useIslandStore = create<IslandState>((set, get) => ({
  expanded: false,
  activity: null,

  setExpanded: (expanded) => set({ expanded }),
  toggle: () => set({ expanded: !get().expanded }),

  announce: (activity) => {
    const id = nextId++;
    clearTimeout(timer);
    set({ activity: { ...activity, id } });
    timer = setTimeout(() => {
      // Only clear our own announcement; a newer one has its own timer.
      if (get().activity?.id === id) set({ activity: null });
    }, ACTIVITY_MS);
  },

  dismissActivity: () => {
    clearTimeout(timer);
    set({ activity: null });
  },
}));
