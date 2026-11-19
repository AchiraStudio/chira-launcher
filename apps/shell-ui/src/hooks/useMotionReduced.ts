import { resolveMotion } from '@/app/appearance';
import { useSettingsStore } from '@/stores/settingsStore';
import { useMediaQuery } from './useMediaQuery';

/** Whether motion should be reduced, combining the user's setting with the Windows preference. */
export function useMotionReduced(): boolean {
  const pref = useSettingsStore((s) => s.settings?.appearance.motion ?? 'system');
  const systemReduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  return resolveMotion(pref, systemReduced) === 'reduced';
}
