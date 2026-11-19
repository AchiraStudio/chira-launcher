import { useEffect, useState } from 'react';
import { readableForeground } from '@/lib/color';
import { useSettingsStore } from '@/stores/settingsStore';
import { resolveMotion, resolveTheme } from './appearance';

/** Subscribes to a media query and returns whether it currently matches. */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    list.addEventListener('change', onChange);
    onChange();
    return () => list.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/**
 * Applies the user's appearance settings to the document root: theme, quality profile, motion and
 * accent colour. CSS custom properties and `data-*` attributes keep this out of React's render path.
 */
export function useAppearance(): void {
  const appearance = useSettingsStore((s) => s.settings?.appearance);
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const systemReduced = useMediaQuery('(prefers-reduced-motion: reduce)');

  useEffect(() => {
    // Before settings arrive the stylesheet defaults (dark, balanced) are already correct.
    if (!appearance) return;
    const root = document.documentElement;
    root.dataset.theme = resolveTheme(appearance.theme, systemDark);
    root.dataset.quality = appearance.qualityProfile;
    root.dataset.motion = resolveMotion(appearance.motion, systemReduced);
    root.style.setProperty('--accent', appearance.accent);
    root.style.setProperty('--accent-fg', readableForeground(appearance.accent));
  }, [appearance, systemDark, systemReduced]);
}
