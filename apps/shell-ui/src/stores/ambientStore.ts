import { create } from 'zustand';

interface AmbientState {
  /** Hue of the highlighted Home card; `null` falls back to the accent colour. */
  tone: string | null;
  setTone: (tone: string | null) => void;
}

/** Drives the background that crossfades as the user moves across Home (plan §11.1). */
export const useAmbientStore = create<AmbientState>((set) => ({
  tone: null,
  setTone: (tone) => set({ tone }),
}));
