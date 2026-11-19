import { create } from 'zustand';
import type { DestinationId } from '@/features/destinations';

export type SettingsSectionId = 'personalization' | 'displays' | 'system';

interface NavState {
  destination: DestinationId;
  settingsSection: SettingsSectionId;
  navigate: (destination: DestinationId) => void;
  openSettings: (section: SettingsSectionId) => void;
  setSettingsSection: (section: SettingsSectionId) => void;
}

/**
 * Navigation is in-memory state, not a URL router: the shell is a single desktop surface with no
 * address bar, deep links or browser history to keep in sync.
 */
export const useNavStore = create<NavState>((set) => ({
  destination: 'home',
  settingsSection: 'personalization',
  navigate: (destination) => set({ destination }),
  openSettings: (section) => set({ destination: 'settings', settingsSection: section }),
  setSettingsSection: (settingsSection) => set({ settingsSection }),
}));
