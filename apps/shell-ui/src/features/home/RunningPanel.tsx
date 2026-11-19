import { RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { Badge, Surface, cn } from '@/design-system';
import { initialOf, toneFor } from '@/lib/appTone';
import { useWindowsStore } from '@/stores/windowsStore';

const MAX_ROWS = 6;

/**
 * Applications with an open window right now — real data from the engine's window discovery
 * (plan §5.2). Read-only: focusing and arranging windows arrive with M02.
 */
export function RunningPanel() {
  const { windows, status, error } = useWindowsStore();
  const refresh = useWindowsStore((s) => s.refresh);

  // Refresh when Home appears and whenever the shell regains focus — never on a timer (HR-Q3).
  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  const shown = windows.slice(0, MAX_ROWS);
  const hidden = windows.length - shown.length;

  return (
    <Surface material="frosted" className="flex flex-col gap-3 p-6" aria-labelledby="running-title">
      <div className="flex items-center justify-between">
        <h2 id="running-title" className="text-lg font-extrabold">
          Running now
        </h2>
        <button
          type="button"
          onClick={() => void refresh()}
          aria-label="Refresh running windows"
          className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-3/60 hover:text-fg"
        >
          <RefreshCw size={15} className={cn(status === 'loading' && 'animate-spin')} aria-hidden />
        </button>
      </div>

      {status === 'error' && (
        <p role="alert" className="text-sm text-danger">
          Couldn’t list windows: {error}
        </p>
      )}

      {status === 'ready' && windows.length === 0 && (
        <p className="text-sm text-muted">No other windows are open.</p>
      )}

      <ul className="flex flex-col gap-1.5">
        {shown.map((w) => (
          <li
            key={w.id}
            className="flex items-center gap-3 rounded-2xl bg-surface-3/35 px-3 py-2.5"
          >
            <span
              aria-hidden
              className="grid size-9 shrink-0 place-items-center rounded-xl text-sm font-extrabold text-white"
              style={{ background: toneFor(w.appName) }}
            >
              {initialOf(w.appName)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{w.appName}</span>
              <span className="block truncate text-xs text-muted">{w.title}</span>
            </span>
            {w.isForeground && <Badge tone="accent">Active</Badge>}
            {w.isMinimized && <Badge>Minimized</Badge>}
          </li>
        ))}
      </ul>

      {hidden > 0 && <p className="text-xs text-faint">+{hidden} more</p>}
      <p className="mt-auto pt-1 text-xs text-faint">
        View only for now — switching and arranging windows arrive in M02.
      </p>
    </Surface>
  );
}
