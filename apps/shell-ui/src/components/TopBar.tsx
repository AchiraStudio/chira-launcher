import { Monitor } from 'lucide-react';
import { Badge } from '@/design-system';
import { getDestination } from '@/features/destinations';
import { useMinuteClock } from '@/hooks/useMinuteClock';
import { useDisplayStore } from '@/stores/displayStore';
import { useEngineStore } from '@/stores/engineStore';
import { useNavStore } from '@/stores/navStore';

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

export function TopBar() {
  const destination = useNavStore((s) => getDestination(s.destination));
  const displayCount = useDisplayStore((s) => s.displays.length);
  const version = useEngineStore((s) => s.appInfo?.version);
  const now = useMinuteClock();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between px-2">
      <h1 className="text-lg font-extrabold tracking-tight">{destination.label}</h1>
      <div className="flex items-center gap-2.5">
        <Badge title="Connected displays">
          <Monitor size={13} aria-hidden />
          {displayCount} {displayCount === 1 ? 'display' : 'displays'}
        </Badge>
        <Badge tone="success" title={version ? `Engine v${version}` : 'Engine'}>
          <span className="size-1.5 rounded-full bg-success" aria-hidden />
          Engine ready
        </Badge>
        <time
          dateTime={now.toISOString()}
          className="min-w-14 text-right text-sm font-bold tabular-nums"
        >
          {timeFormat.format(now)}
        </time>
      </div>
    </header>
  );
}
