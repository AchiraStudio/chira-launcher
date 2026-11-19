import { cn } from '@/design-system';
import { arrangeDisplays, formatResolution } from '@/lib/displayLayout';
import type { Display } from '@/services/bindings/Display';

interface DisplayMapProps {
  displays: Display[];
  /** Taller maps leave room for the resolution caption inside each screen. */
  size?: 'compact' | 'comfortable';
}

/**
 * A to-scale picture of the real monitor arrangement, drawn from the engine's display list.
 * Positions are percentages of the combined bounding box, so it mirrors the true layout.
 */
export function DisplayMap({ displays, size = 'comfortable' }: DisplayMapProps) {
  const { aspectRatio, placed } = arrangeDisplays(displays);
  const byId = new Map(displays.map((d) => [d.id, d]));

  return (
    <div
      className="relative mx-auto w-full"
      style={{
        aspectRatio,
        maxHeight: size === 'compact' ? 150 : 240,
        maxWidth: `calc(${size === 'compact' ? 150 : 240}px * ${aspectRatio})`,
      }}
      role="img"
      aria-label={`Display arrangement: ${displays.map((d) => `${d.label} ${formatResolution(d)}`).join(', ')}`}
    >
      {placed.map((p) => {
        const display = byId.get(p.id);
        if (!display) return null;
        return (
          <div
            key={p.id}
            className="absolute p-[3px]"
            style={{
              left: `${p.leftPct}%`,
              top: `${p.topPct}%`,
              width: `${p.widthPct}%`,
              height: `${p.heightPct}%`,
            }}
          >
            <div
              className={cn(
                'flex h-full w-full flex-col items-center justify-center gap-0.5 overflow-hidden rounded-lg border',
                display.isPrimary
                  ? 'border-accent/70 bg-accent/18'
                  : 'border-line-strong bg-surface-3/50',
              )}
            >
              <span className="text-lg font-extrabold">
                {display.label.replace('Display ', '')}
              </span>
              {size === 'comfortable' && (
                <span className="text-[11px] font-semibold text-muted tabular-nums">
                  {formatResolution(display)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
