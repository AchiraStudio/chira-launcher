import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from 'motion/react';
import { useRef } from 'react';
import { cn } from '@/design-system';
import { getDestination, type DestinationId } from '@/features/destinations';
import { useMotionReduced } from '@/hooks/useMotionReduced';
import { useNavStore } from '@/stores/navStore';

/** Zones from plan §11.3: navigation · tools · system. */
const ZONES: ReadonlyArray<readonly DestinationId[]> = [
  ['home', 'library', 'games'],
  ['files', 'workspaces', 'multitasking', 'widgets'],
  ['settings'],
];

/** How far (px) from the pointer an icon still reacts, and the peak scale under it. */
const REACH = 130;
const PEAK_SCALE = 1.5;

function DockItem({
  id,
  mouseX,
  magnify,
}: {
  id: DestinationId;
  mouseX: MotionValue<number>;
  magnify: boolean;
}) {
  const destination = getDestination(id);
  const Icon = destination.icon;
  const active = useNavStore((s) => s.destination === id);
  const navigate = useNavStore((s) => s.navigate);
  const ref = useRef<HTMLButtonElement>(null);

  // Magnification is a pure transform (scale), so it never triggers layout (HR-Q4).
  const distance = useTransform(mouseX, (x) => {
    const rect = ref.current?.getBoundingClientRect();
    return rect ? x - (rect.left + rect.width / 2) : Infinity;
  });
  const target = useTransform(distance, [-REACH, 0, REACH], [1, PEAK_SCALE, 1]);
  const scale = useSpring(target, { stiffness: 380, damping: 26, mass: 0.6 });

  const tooltip = destination.milestone
    ? `${destination.label} · ${destination.milestone.id}`
    : destination.label;

  return (
    <div className="group relative flex flex-col items-center">
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute bottom-[calc(100%+3.25rem)] z-10 whitespace-nowrap',
          'mat mat-smoked rounded-full px-3 py-1 text-xs font-bold',
          'opacity-0 transition-opacity duration-(--motion-quick) group-hover:opacity-100 group-focus-within:opacity-100',
        )}
      >
        {tooltip}
      </span>
      <motion.button
        ref={ref}
        type="button"
        aria-label={destination.label}
        aria-current={active ? 'page' : undefined}
        onClick={() => navigate(id)}
        style={{ scale: magnify ? scale : 1, originY: 1 }}
        className={cn(
          'grid size-[52px] place-items-center rounded-2xl border',
          'transition-colors duration-(--motion-quick)',
          active
            ? 'mat-accent border-accent/60 text-fg'
            : 'border-transparent bg-surface-3/40 text-muted hover:bg-surface-3/80 hover:text-fg',
        )}
      >
        <Icon size={24} className={active ? 'text-accent' : undefined} aria-hidden />
      </motion.button>
      <span
        className={cn(
          'mt-1.5 size-1 rounded-full transition-opacity duration-(--motion-quick)',
          active ? 'bg-accent opacity-100' : 'opacity-0',
        )}
        aria-hidden
      />
    </div>
  );
}

/** The floating dock (plan §11.3): centred, detached from the edge, icons magnify under the pointer. */
export function Dock() {
  const mouseX = useMotionValue(Infinity);
  const reduced = useMotionReduced();

  return (
    <nav
      aria-label="Primary"
      onMouseMove={(e) => mouseX.set(e.clientX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2"
    >
      <div className="mat mat-frosted flex items-end gap-2 rounded-[28px] px-3 pt-3 pb-1.5">
        {ZONES.map((zone, index) => (
          <div key={zone.join('-')} className="flex items-end gap-2">
            {index > 0 && <span className="mx-1 mb-3.5 h-9 w-px bg-line-strong" aria-hidden />}
            {zone.map((id) => (
              <DockItem key={id} id={id} mouseX={mouseX} magnify={!reduced} />
            ))}
          </div>
        ))}
      </div>
    </nav>
  );
}
