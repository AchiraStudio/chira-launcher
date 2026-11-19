import { MotionConfig } from 'motion/react';
import { useEffect } from 'react';
import { useShellHotkeys } from '@/hooks/useShellHotkeys';
import { ShellLayout } from '@/shell/ShellLayout';
import { useEngineStore } from '@/stores/engineStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { motionConfigValue } from './appearance';
import { BootFailureScreen, BootScreen, EngineUnavailableScreen } from './BootScreens';
import { ErrorBoundary } from './ErrorBoundary';
import { installGlobalErrorReporting } from './errorReporting';
import { useAppearance } from './useAppearance';

function ShellContent() {
  const phase = useEngineStore((s) => s.phase);
  const error = useEngineStore((s) => s.error);

  switch (phase) {
    case 'booting':
      return <BootScreen />;
    case 'unavailable':
      return <EngineUnavailableScreen />;
    case 'failed':
      return <BootFailureScreen message={error ?? 'Unknown error.'} />;
    case 'ready':
      return <ShellLayout />;
  }
}

export function ShellApp() {
  const boot = useEngineStore((s) => s.boot);
  const motionPref = useSettingsStore((s) => s.settings?.appearance.motion ?? 'system');
  useAppearance();
  // Registered above the error boundary on purpose: if the UI crashes while fullscreen, F11 must
  // still work (plan pillar 6: the user is never locked in).
  useShellHotkeys();

  useEffect(() => installGlobalErrorReporting(), []);
  useEffect(() => {
    void boot();
  }, [boot]);

  return (
    <MotionConfig reducedMotion={motionConfigValue(motionPref)}>
      <ErrorBoundary>
        <ShellContent />
      </ErrorBoundary>
    </MotionConfig>
  );
}
