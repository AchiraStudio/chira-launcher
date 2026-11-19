import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/design-system';
import { engine } from '@/services/engine';
import { toEngineCallError } from '@/services/errors';
import type { Diagnostics } from '@/services/bindings/Diagnostics';
import type { DpiAwareness } from '@/services/bindings/DpiAwareness';

const DPI_LABEL: Record<DpiAwareness, string> = {
  unaware: 'Unaware',
  system: 'System',
  'per-monitor': 'Per-monitor',
  'per-monitor-v2': 'Per-monitor v2',
  unknown: 'Unknown',
};

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function CopyablePath({ label, value }: { label: string; value: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch (thrown) {
      console.error('Clipboard write failed', thrown);
      setState('failed');
    }
    window.setTimeout(() => setState('idle'), 1800);
  };

  return (
    <div className="flex items-center gap-3 rounded-control border border-line bg-surface-2/50 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-muted">{label}</div>
        <div className="selectable truncate font-mono text-[13px]" title={value}>
          {value}
        </div>
      </div>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={`Copy ${label}`}
        className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-3/60 hover:text-fg"
      >
        {state === 'copied' ? <Check size={16} className="text-success" /> : <Copy size={16} />}
      </button>
      <span className="sr-only" role="status">
        {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : ''}
      </span>
    </div>
  );
}

export function SystemSection() {
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    engine.getDiagnostics().then(
      (result) => {
        if (!cancelled) setDiagnostics(result);
      },
      (thrown: unknown) => {
        if (!cancelled) setError(toEngineCallError(thrown).message);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <p
        role="alert"
        className="rounded-control border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
      >
        Couldn’t read diagnostics: {error}
      </p>
    );
  }
  if (!diagnostics) return <p className="text-sm text-muted">Reading diagnostics…</p>;

  const { app, paths, database, settingsSource, uptimeSeconds, frontendReportsDropped } =
    diagnostics;
  const rows: Array<[string, string]> = [
    ['Application', `${app.name} ${app.version}`],
    ['Protocol', `v${app.protocolVersion}`],
    [
      'Windows',
      app.system
        ? `${app.system.osName} · ${app.system.osVersion}.${app.system.osBuild}`
        : 'Unavailable',
    ],
    ['DPI awareness', app.system ? DPI_LABEL[app.system.dpiAwareness] : 'Unavailable'],
    [
      'Database schema',
      database.schemaVersion === undefined ? 'Unknown' : `v${database.schemaVersion}`,
    ],
    ['Engine uptime', formatUptime(uptimeSeconds)],
  ];

  return (
    <div className="space-y-8">
      {(database.quarantinedPrevious || settingsSource !== 'database') && (
        <div className="space-y-2" role="status">
          {database.quarantinedPrevious && (
            <p className="rounded-control border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
              <Badge tone="warning">Recovered</Badge> A corrupt database was set aside as{' '}
              <span className="selectable font-mono">{database.quarantinedPrevious}</span> and a
              fresh one was created.
            </p>
          )}
          {settingsSource !== 'database' && (
            <p className="rounded-control border border-line bg-surface-2/50 px-4 py-3 text-sm">
              Settings were loaded from{' '}
              <strong>
                {settingsSource === 'defaults' ? 'defaults (first run)' : 'the recovery snapshot'}
              </strong>{' '}
              at startup.
            </p>
          )}
        </div>
      )}

      <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-4 border-b border-line pb-2"
          >
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="selectable text-sm font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="space-y-3">
        <h3 className="text-[15px] font-bold">Locations</h3>
        <CopyablePath label="Data folder" value={paths.dataDir} />
        <CopyablePath label="Logs" value={paths.logsDir} />
        <CopyablePath label="Database" value={paths.databaseFile} />
        <CopyablePath label="Recovery" value={paths.recoveryDir} />
      </div>

      {frontendReportsDropped > 0 && (
        <p className="text-sm text-muted">
          {frontendReportsDropped} interface error reports were discarded by the rate limiter.
        </p>
      )}
    </div>
  );
}
