import type { ReactNode } from 'react';
import { DisplayMap } from '@/components/DisplayMap';
import { Badge, Surface } from '@/design-system';
import { formatResolution, formatScale } from '@/lib/displayLayout';
import { useDisplayStore } from '@/stores/displayStore';

/** A to-scale picture of the real monitor arrangement, from the engine's display list. */
export function DisplaysPanel() {
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
    body = <DisplayMap displays={displays} size="compact" />;
  }

  return (
    <Surface
      material="frosted"
      className="flex flex-col gap-4 p-6"
      aria-labelledby="displays-title"
    >
      <h2 id="displays-title" className="text-lg font-extrabold">
        Your displays
      </h2>
      <div className="grid min-h-32 place-items-center">{body}</div>
      {primary && (
        <div className="flex flex-wrap gap-2">
          <Badge tone="accent">Primary · {primary.label}</Badge>
          <Badge>{formatResolution(primary)}</Badge>
          <Badge>{formatScale(primary)} scale</Badge>
          {primary.refreshRateHz && <Badge>{primary.refreshRateHz} Hz</Badge>}
        </div>
      )}
    </Surface>
  );
}
