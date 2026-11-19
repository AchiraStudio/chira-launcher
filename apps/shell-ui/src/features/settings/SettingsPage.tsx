import { Info, Monitor, Palette, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Surface, cn } from '@/design-system';
import { useNavStore, type SettingsSectionId } from '@/stores/navStore';
import { DisplaysSection } from './DisplaysSection';
import { PersonalizationSection } from './PersonalizationSection';
import { SystemSection } from './SystemSection';

interface Section {
  id: SettingsSectionId;
  label: string;
  icon: LucideIcon;
  render: () => ReactNode;
}

// The plan's full list (§12.3) arrives with M08; these are the sections backed by real engine
// functionality today.
const SECTIONS: readonly Section[] = [
  {
    id: 'personalization',
    label: 'Personalization',
    icon: Palette,
    render: () => <PersonalizationSection />,
  },
  { id: 'displays', label: 'Displays', icon: Monitor, render: () => <DisplaysSection /> },
  { id: 'system', label: 'System', icon: Info, render: () => <SystemSection /> },
];

export default function SettingsPage() {
  const active = useNavStore((s) => s.settingsSection);
  const setSection = useNavStore((s) => s.setSettingsSection);
  const section = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];
  if (!section) return null;

  return (
    <div className="grid gap-4 p-1 pb-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <nav aria-label="Settings sections" className="flex gap-1 lg:flex-col">
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSection(id)}
            aria-current={id === active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-control px-3.5 py-2.5 text-left text-sm font-semibold',
              'transition-colors duration-(--motion-quick)',
              id === active
                ? 'mat mat-accent text-fg'
                : 'text-muted hover:bg-surface-3/40 hover:text-fg',
            )}
          >
            <Icon size={18} className={id === active ? 'text-accent' : undefined} aria-hidden />
            {label}
          </button>
        ))}
      </nav>

      <Surface material="solid" className="min-w-0 p-8">
        <h2 className="mb-2 text-2xl font-extrabold tracking-tight">{section.label}</h2>
        {section.render()}
      </Surface>
    </div>
  );
}
