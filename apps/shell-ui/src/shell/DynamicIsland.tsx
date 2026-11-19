import { AnimatePresence, motion } from 'motion/react';
import { Check, LogOut, Maximize2, Minimize2, Monitor, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { BrandMark } from '@/components/BrandMark';
import {
  Badge,
  Button,
  SegmentedControl,
  cn,
  duration,
  easeStandard,
  spring,
} from '@/design-system';
import { useMinuteClock } from '@/hooks/useMinuteClock';
import { formatResolution } from '@/lib/displayLayout';
import type { QualityProfile } from '@/services/bindings/QualityProfile';
import { useDisplayStore } from '@/stores/displayStore';
import { useEngineStore } from '@/stores/engineStore';
import { useIslandStore, type IslandActivity } from '@/stores/islandStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useShellStore } from '@/stores/shellStore';

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const dateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const QUALITY_OPTIONS = [
  { value: 'performance', label: 'Performance' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'ultra', label: 'Ultra' },
] as const satisfies ReadonlyArray<{ value: QualityProfile; label: string }>;

const ACTIVITY_ICON: Record<IslandActivity['kind'], LucideIcon> = {
  settings: Check,
  displays: Monitor,
  'window-mode': Maximize2,
};

const fade = { duration: duration.quick, ease: easeStandard } as const;

/** Idle: the time. Active: a short live announcement (plan §11.2 "Activity"). */
function CompactContent({ now }: { now: Date }) {
  const activity = useIslandStore((s) => s.activity);

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {activity ? (
        <motion.span
          key={`activity-${activity.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={fade}
          className="flex items-center gap-2.5 px-4 text-sm font-bold whitespace-nowrap"
        >
          {(() => {
            const Icon = ACTIVITY_ICON[activity.kind];
            return <Icon size={16} className="text-accent" aria-hidden />;
          })()}
          <span role="status">
            {activity.title}
            {activity.detail && (
              <span className="font-semibold text-muted"> · {activity.detail}</span>
            )}
          </span>
        </motion.span>
      ) : (
        <motion.span
          key="idle"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={fade}
          className="flex items-center gap-2.5 px-4 text-sm font-bold tabular-nums"
        >
          <BrandMark size={16} />
          {timeFormat.format(now)}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-3/40 px-4 py-3">
      <div className="text-[11px] font-bold tracking-wider text-faint uppercase">{label}</div>
      <div className="mt-0.5 text-sm font-bold">{value}</div>
    </div>
  );
}

function ExpandedContent({ now }: { now: Date }) {
  const displays = useDisplayStore((s) => s.displays);
  const appInfo = useEngineStore((s) => s.appInfo);
  const quality = useSettingsStore((s) => s.settings?.appearance.qualityProfile);
  const updateSettings = useSettingsStore((s) => s.update);
  const windowMode = useShellStore((s) => s.windowMode);
  const toggleFullscreen = useShellStore((s) => s.toggleFullscreen);
  const exit = useShellStore((s) => s.exit);

  const [confirmExit, setConfirmExit] = useState(false);
  useEffect(() => {
    if (!confirmExit) return;
    const timer = window.setTimeout(() => setConfirmExit(false), 3000);
    return () => window.clearTimeout(timer);
  }, [confirmExit]);

  const primary = displays.find((d) => d.isPrimary) ?? displays[0];
  const system = appInfo?.system;
  const fullscreen = windowMode === 'fullscreen';

  return (
    <div className="w-[min(36rem,calc(100vw-2rem))] space-y-5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-4xl font-extrabold tracking-tight tabular-nums">
            {timeFormat.format(now)}
          </div>
          <div className="text-sm text-muted">{dateFormat.format(now)}</div>
        </div>
        <Badge tone="success">
          <span className="size-1.5 rounded-full bg-success" aria-hidden />
          Engine ready
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <Stat
          label="Displays"
          value={primary ? `${displays.length} · ${formatResolution(primary)}` : 'None'}
        />
        <Stat label="Windows" value={system ? `${system.osName} · ${system.osBuild}` : '—'} />
        <Stat label="Window" value={fullscreen ? 'Fullscreen' : 'Windowed'} />
      </div>

      {quality && (
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-bold">Visual quality</span>
          <SegmentedControl
            label="Visual quality"
            value={quality}
            options={QUALITY_OPTIONS}
            onChange={(qualityProfile) => void updateSettings({ appearance: { qualityProfile } })}
          />
        </div>
      )}

      <div className="flex items-center gap-2.5 border-t border-line pt-4">
        <Button onClick={() => void toggleFullscreen()}>
          {fullscreen ? <Minimize2 size={15} aria-hidden /> : <Maximize2 size={15} aria-hidden />}
          {fullscreen ? 'Leave fullscreen' : 'Go fullscreen'}
        </Button>
        <Button
          variant={confirmExit ? 'primary' : 'subtle'}
          onClick={() => (confirmExit ? void exit() : setConfirmExit(true))}
        >
          <LogOut size={15} aria-hidden />
          {confirmExit ? 'Click again to exit' : 'Exit'}
        </Button>
        <span className="ml-auto text-xs text-faint">F11 fullscreen · Esc closes</span>
      </div>
    </div>
  );
}

/**
 * The Dynamic Island (plan §11.2): an adaptive top-centre surface. Compact it shows the time and
 * announces real engine events; click (or Enter) to expand into system controls. One surface that
 * resizes as a unit.
 */
export function DynamicIsland() {
  const expanded = useIslandStore((s) => s.expanded);
  const setExpanded = useIslandStore((s) => s.setExpanded);
  const toggle = useIslandStore((s) => s.toggle);
  const now = useMinuteClock();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded, setExpanded]);

  return (
    <>
      {expanded && (
        // Click-away layer. Purely a pointer affordance; Escape is the keyboard path.
        <div className="fixed inset-0 z-40" onClick={() => setExpanded(false)} aria-hidden />
      )}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center">
        <motion.div
          layout
          transition={spring.soft}
          style={{ borderRadius: expanded ? 32 : 22 }}
          className={cn(
            'mat mat-smoked pointer-events-auto overflow-hidden',
            expanded ? 'shadow-2xl' : 'h-11',
          )}
        >
          {expanded ? (
            <div
              ref={panelRef}
              tabIndex={-1}
              role="dialog"
              aria-label="System"
              className="outline-none"
            >
              <ExpandedContent now={now} />
            </div>
          ) : (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={false}
              aria-label="Open system panel"
              className="flex h-full items-center"
            >
              <CompactContent now={now} />
            </button>
          )}
        </motion.div>
      </div>
    </>
  );
}
