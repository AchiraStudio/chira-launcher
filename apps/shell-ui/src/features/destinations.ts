import {
  FolderOpen,
  Gamepad2,
  House,
  LayoutGrid,
  Layers,
  PanelsTopLeft,
  Settings,
  Shapes,
  type LucideIcon,
} from 'lucide-react';

export type DestinationId =
  'home' | 'library' | 'games' | 'files' | 'workspaces' | 'multitasking' | 'widgets' | 'settings';

export interface Destination {
  id: DestinationId;
  label: string;
  icon: LucideIcon;
  /** Roadmap milestone that delivers it (plan §22). `null` once implemented. */
  milestone: { id: string; name: string } | null;
  /** One-sentence description, taken from the plan. */
  summary: string;
}

/** Top-level destinations in plan §11.1 order. Settings is pinned to the bottom of the sidebar. */
export const destinations: readonly Destination[] = [
  {
    id: 'home',
    label: 'Home',
    icon: House,
    milestone: null,
    summary: 'Your desktop, ready.',
  },
  {
    id: 'library',
    label: 'Library',
    icon: LayoutGrid,
    milestone: { id: 'M04', name: 'Application Library' },
    summary:
      'Every app on the machine in one place — imported from the Start Menu, the desktop, and your game launchers.',
  },
  {
    id: 'games',
    label: 'Games',
    icon: Gamepad2,
    milestone: { id: 'M04', name: 'Application Library' },
    summary: 'Steam, Epic, GOG and Xbox titles with artwork, launched into managed sessions.',
  },
  {
    id: 'files',
    label: 'Files',
    icon: FolderOpen,
    milestone: { id: 'M08', name: 'Native System Apps' },
    summary: 'A first-party file manager with tabs, dual panes and a file-operation queue.',
  },
  {
    id: 'workspaces',
    label: 'Workspaces',
    icon: Layers,
    milestone: { id: 'M03', name: 'Displays and Workspaces' },
    summary:
      'Saved environments — apps, layouts and display assignments — you can switch in one move.',
  },
  {
    id: 'multitasking',
    label: 'Multitasking',
    icon: PanelsTopLeft,
    milestone: { id: 'M02', name: 'Window Manager' },
    summary: 'Switch between running apps, split the screen, and arrange windows across monitors.',
  },
  {
    id: 'widgets',
    label: 'Widgets',
    icon: Shapes,
    milestone: { id: 'M05', name: 'Desktop Shell' },
    summary: 'Clock, calendar, system monitor and more, placed on Home.',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    milestone: null,
    summary: 'Personalization, displays and system information.',
  },
] as const;

export function getDestination(id: DestinationId): Destination {
  const found = destinations.find((d) => d.id === id);
  if (!found) throw new Error(`Unknown destination: ${id}`);
  return found;
}
