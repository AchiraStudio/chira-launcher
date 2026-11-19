import type { MotionPreference } from '@/services/bindings/MotionPreference';
import type { ThemeMode } from '@/services/bindings/ThemeMode';

export type ResolvedTheme = 'dark' | 'light';
export type ResolvedMotion = 'reduced' | 'full';

/** `system` follows the OS colour scheme. */
export function resolveTheme(mode: ThemeMode, systemPrefersDark: boolean): ResolvedTheme {
  if (mode === 'system') return systemPrefersDark ? 'dark' : 'light';
  return mode;
}

/** `system` follows the OS "reduce motion" preference. */
export function resolveMotion(
  pref: MotionPreference,
  systemPrefersReduced: boolean,
): ResolvedMotion {
  if (pref === 'system') return systemPrefersReduced ? 'reduced' : 'full';
  return pref;
}

/** The value for motion's `<MotionConfig reducedMotion>`. */
export function motionConfigValue(pref: MotionPreference): 'user' | 'always' | 'never' {
  if (pref === 'reduced') return 'always';
  if (pref === 'full') return 'never';
  return 'user';
}
