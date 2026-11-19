import { RefreshCw } from 'lucide-react';
import { DisplayMap } from '@/components/DisplayMap';
import { Badge, Button } from '@/design-system';
import { formatResolution, formatScale } from '@/lib/displayLayout';
import { useDisplayStore } from '@/stores/displayStore';

export function DisplaysSection() {
  const { displays, status, error } = useDisplayStore();
  const refresh = useDisplayStore((s) => s.refresh);
  const loading = status === 'loading';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <p className="max-w-md text-sm text-muted">
          Monitors as Windows reports them, in physical pixels. Changes are detected when you
          rescan; automatic detection arrives with workspaces (M03).
        </p>
        <Button onClick={() => void refresh()} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'animate-spin' : undefined} aria-hidden />
          Rescan
        </Button>
      </div>

      {status === 'error' && (
        <p
          role="alert"
          className="rounded-control border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          Couldn’t read the displays: {error}
        </p>
      )}

      {displays.length > 0 && (
        <div className="rounded-card border border-line bg-surface-2/50 p-6">
          <DisplayMap displays={displays} />
        </div>
      )}

      <ul className="grid gap-3 md:grid-cols-2">
        {displays.map((d) => (
          <li
            key={d.id}
            className="space-y-3 rounded-control border border-line bg-surface-2/50 p-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-bold">{d.label}</h3>
              {d.isPrimary && <Badge tone="accent">Primary</Badge>}
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">Resolution</dt>
              <dd className="font-semibold tabular-nums">{formatResolution(d)}</dd>
              <dt className="text-muted">Scale</dt>
              <dd className="font-semibold tabular-nums">{formatScale(d)}</dd>
              <dt className="text-muted">Refresh</dt>
              <dd className="font-semibold tabular-nums">
                {d.refreshRateHz ? `${d.refreshRateHz} Hz` : 'Not reported'}
              </dd>
              <dt className="text-muted">Position</dt>
              <dd className="font-semibold tabular-nums">
                {d.bounds.x}, {d.bounds.y}
              </dd>
              <dt className="text-muted">Device</dt>
              <dd className="selectable truncate font-mono text-xs">{d.deviceName}</dd>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
