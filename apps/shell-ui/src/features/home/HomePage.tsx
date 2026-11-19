import { ChevronRight, Cpu, Monitor, Palette } from 'lucide-react';
import type { ReactNode } from 'react';
import { DisplayMap } from '@/components/DisplayMap';
import { Badge, Surface, cn } from '@/design-system';
import { useMinuteClock } from '@/hooks/useMinuteClock';
import { formatResolution, formatScale } from '@/lib/displayLayout';
import { greetingFor } from '@/lib/greeting';
import { useDisplayStore } from '@/stores/displayStore';
import { useEngineStore } from '@/stores/engineStore';
import { useNavStore, type SettingsSectionId } from '@/stores/navStore';
import { useSettingsStore } from '@/stores/settingsStore';

const dateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

interface QuickTileProps {
  icon: ReactNode;
  title: string;
  lines: string[];
  section: SettingsSectionId;
}

/** A glanceable summary that opens the matching Settings section. */
function QuickTile({ icon, title, lines, section }: QuickTileProps) {
  const openSettings = useNavStore((s) => s.openSettings);
  return (
    <button
      type="button"
      onClick={() => openSettings(section)}
      className={cn(
        'mat mat-smoked group flex flex-col items-start gap-3 rounded-card p-5 text-left',
        'transition-[border-color,transform] duration-(--motion-quick) ease-(--ease-standard)',
        'hover:-translate-y-0.5 hover:border-accent/50',
      )}
    >
      <span className="flex w-full items-center justify-between">
        <span className="grid size-10 place-items-center rounded-xl bg-accent/15 text-accent">
          {icon}
        </span>
        <ChevronRight
          size={18}
          className="text-faint transition-colors group-hover:text-fg"
          aria-hidden
        />
      </span>
      <span className="text-base font-extrabold">{title}</span>
      <span className="space-y-0.5 text-sm text-muted">
        {lines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </span>
    </button>
  );
}

function DisplaysPanel() {
  const { displays, status, error } = useDisplayStore();
  const refresh = useDisplayStore((s) => s.refresh);
  const primary = displays.find((d) => d.isPrimary) ?? displays[0];

  let body: ReactNode;
  if (status === 'error') {
    body = (
      <div className="space-y-3" role="alert">
        <p className="text-sm text-danger">Couldn’t read the displays: {error}</p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="text-sm font-bold text-accent"
        >
          Try again
        </button>
      </div>
    );
  } else if (displays.length === 0) {
    body = <p className="text-sm text-muted">Windows reported no active displays.</p>;
  } else {
    body = <DisplayMap displays={displays} />;
  }

  return (
    <Surface
      material="smoked"
      className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"
    >
      <div className="grid min-h-40 place-items-center">{body}</div>
      <div className="flex flex-col justify-center gap-3">
        <h2 className="text-lg font-extrabold">Your displays</h2>
        {primary ? (
          <>
            <p className="text-sm text-muted">
              {displays.length === 1
                ? 'One display connected.'
                : `${displays.length} displays arranged as shown.`}
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge tone="accent">Primary · {primary.label}</Badge>
              <Badge>{formatResolution(primary)}</Badge>
              <Badge>{formatScale(primary)} scale</Badge>
              {primary.refreshRateHz && <Badge>{primary.refreshRateHz} Hz</Badge>}
            </div>
          </>
        ) : null}
      </div>
    </Surface>
  );
}

export default function HomePage() {
  const now = useMinuteClock();
  const displays = useDisplayStore((s) => s.displays);
  const appearance = useSettingsStore((s) => s.settings?.appearance);
  const appInfo = useEngineStore((s) => s.appInfo);

  const primary = displays.find((d) => d.isPrimary) ?? displays[0];
  const system = appInfo?.system;

  return (
    <div className="flex flex-col gap-10 px-2 pt-6 pb-10">
      <section aria-labelledby="home-greeting" className="px-2">
        <h2 id="home-greeting" className="text-5xl font-extrabold tracking-tight">
          {greetingFor(now)}
        </h2>
        <p className="mt-2 text-lg text-muted">Your desktop, ready. · {dateFormat.format(now)}</p>
      </section>

      <section aria-label="Displays">
        <DisplaysPanel />
      </section>

      <section aria-labelledby="quick-access" className="space-y-4">
        <h2
          id="quick-access"
          className="px-2 text-xs font-bold tracking-[0.18em] text-faint uppercase"
        >
          Quick access
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <QuickTile
            section="personalization"
            icon={<Palette size={20} aria-hidden />}
            title="Appearance"
            lines={
              appearance
                ? [
                    `${capitalize(appearance.theme)} theme`,
                    `${capitalize(appearance.qualityProfile)} quality`,
                  ]
                : ['Loading…']
            }
          />
          <QuickTile
            section="displays"
            icon={<Monitor size={20} aria-hidden />}
            title="Displays"
            lines={
              primary
                ? [
                    `${displays.length} connected`,
                    `${formatResolution(primary)} @ ${formatScale(primary)}`,
                  ]
                : ['None detected']
            }
          />
          <QuickTile
            section="system"
            icon={<Cpu size={20} aria-hidden />}
            title="System"
            lines={[
              system ? `${system.osName} · build ${system.osBuild}` : 'Windows',
              appInfo ? `Chira Launcher ${appInfo.version}` : '',
            ].filter(Boolean)}
          />
        </div>
      </section>
    </div>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
