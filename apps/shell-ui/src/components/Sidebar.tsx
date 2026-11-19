import { motion } from 'motion/react';
import { BrandMark } from '@/components/BrandMark';
import { Surface, cn, spring } from '@/design-system';
import { destinations, type Destination } from '@/features/destinations';
import { useNavStore } from '@/stores/navStore';

function NavItem({ destination }: { destination: Destination }) {
  const active = useNavStore((s) => s.destination === destination.id);
  const navigate = useNavStore((s) => s.navigate);
  const Icon = destination.icon;

  return (
    <button
      type="button"
      onClick={() => navigate(destination.id)}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex w-full items-center gap-3 rounded-control px-3.5 py-2.5 text-left text-sm font-semibold',
        'transition-colors duration-(--motion-quick)',
        active ? 'text-fg' : 'text-muted hover:text-fg hover:bg-surface-3/40',
      )}
    >
      {active && (
        <motion.span
          layoutId="sidebar-active"
          transition={spring.snappy}
          className="mat mat-accent absolute inset-0 rounded-control"
        />
      )}
      <Icon size={19} className={cn('relative', active && 'text-accent')} aria-hidden />
      <span className="relative flex-1">{destination.label}</span>
      {destination.milestone && (
        <span className="relative rounded-full border border-line px-1.5 text-[10px] font-bold tracking-wide text-faint">
          {destination.milestone.id}
        </span>
      )}
    </button>
  );
}

/** Primary navigation (plan §11.1). Settings is pinned below the rest. */
export function Sidebar() {
  const main = destinations.filter((d) => d.id !== 'settings');
  const settings = destinations.filter((d) => d.id === 'settings');

  return (
    <Surface material="frosted" className="flex h-full w-64 shrink-0 flex-col p-3">
      <div className="flex items-center gap-3 px-3.5 pt-2 pb-5">
        <BrandMark size={30} />
        <span className="text-[15px] font-extrabold tracking-tight">Chira Launcher</span>
      </div>
      <nav aria-label="Primary" className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {main.map((d) => (
          <NavItem key={d.id} destination={d} />
        ))}
      </nav>
      <div className="border-t border-line pt-3">
        {settings.map((d) => (
          <NavItem key={d.id} destination={d} />
        ))}
      </div>
    </Surface>
  );
}
