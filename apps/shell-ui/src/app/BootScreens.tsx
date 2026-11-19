import { motion } from 'motion/react';
import { OctagonX, PlugZap } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { Button, Surface, duration, easeStandard } from '@/design-system';

/** Shown for the few milliseconds while the engine answers its first requests. */
export function BootScreen() {
  return (
    <div
      className="grid h-full place-items-center"
      role="status"
      aria-label="Starting Chira Launcher"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: duration.cinematic, ease: easeStandard }}
        className="flex flex-col items-center gap-5"
      >
        <BrandMark size={72} />
        <span className="text-sm font-semibold tracking-[0.3em] text-muted uppercase">
          Chira Launcher
        </span>
      </motion.div>
    </div>
  );
}

/** The UI is running without the desktop host (e.g. opened in a plain browser). */
export function EngineUnavailableScreen() {
  return (
    <div className="grid h-full place-items-center p-8">
      <Surface material="solid" className="max-w-lg space-y-4 p-8">
        <PlugZap className="text-warning" size={28} aria-hidden />
        <h1 className="text-xl font-extrabold">The desktop engine isn’t connected</h1>
        <p className="text-sm text-muted">
          This interface only works inside the Chira Launcher desktop host — it has no data of its
          own. Start the full app from the project root:
        </p>
        <code className="selectable block rounded-control bg-surface-2 px-4 py-3 font-mono text-sm">
          pnpm dev
        </code>
      </Surface>
    </div>
  );
}

interface BootFailureProps {
  message: string;
}

/** The engine answered but the shell cannot start (e.g. protocol mismatch). */
export function BootFailureScreen({ message }: BootFailureProps) {
  return (
    <div className="grid h-full place-items-center p-8">
      <Surface material="solid" className="max-w-lg space-y-4 p-8" role="alert">
        <OctagonX className="text-danger" size={28} aria-hidden />
        <h1 className="text-xl font-extrabold">Chira Launcher couldn’t start</h1>
        <p className="selectable text-sm text-muted">{message}</p>
        <p className="text-sm text-muted">
          Details are in the log folder under{' '}
          <span className="font-mono">%LOCALAPPDATA%\ChiraLauncher\logs</span>.
        </p>
        <Button variant="primary" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </Surface>
    </div>
  );
}
