import { Badge, Surface } from '@/design-system';
import type { Destination } from '@/features/destinations';

/**
 * Honest placeholder for destinations whose milestone has not been built yet. It states what the
 * destination is for and when the roadmap delivers it — it does not pretend to function.
 */
export function PendingFeaturePage({ destination }: { destination: Destination }) {
  const Icon = destination.icon;
  return (
    <div className="grid min-h-full place-items-center p-6">
      <Surface material="smoked" className="flex max-w-xl flex-col items-start gap-5 p-10">
        <span className="grid size-14 place-items-center rounded-2xl bg-accent/15 text-accent">
          <Icon size={28} aria-hidden />
        </span>
        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold tracking-tight">{destination.label}</h2>
          <p className="text-base text-muted">{destination.summary}</p>
        </div>
        {destination.milestone && (
          <Badge tone="accent">
            Planned for {destination.milestone.id} · {destination.milestone.name}
          </Badge>
        )}
        <p className="text-sm text-faint">
          Not built yet. The roadmap order is defined in plan.md §22.
        </p>
      </Surface>
    </div>
  );
}
