import { Cpu, Monitor, Palette, type LucideIcon } from 'lucide-react';
import type { SettingsSectionId } from '@/stores/navStore';
import { getDestination, type DestinationId } from '../destinations';

export interface HomeCard {
  id: string;
  title: string;
  summary: string;
  /** Signature colour: tints the card and the ambient background while highlighted. */
  tone: string;
  icon: LucideIcon;
  /** Roadmap milestone when the destination is not built yet. */
  milestone: { id: string; name: string } | null;
  destination: DestinationId;
  settingsSection?: SettingsSectionId;
}

/** A card for a destination that exists in `destinations.ts`, so copy and milestones stay in one place. */
function fromDestination(id: DestinationId, tone: string): HomeCard {
  const d = getDestination(id);
  return {
    id,
    title: d.label,
    summary: d.summary,
    tone,
    icon: d.icon,
    milestone: d.milestone,
    destination: id,
  };
}

/**
 * The Home carousel, in focus order. What works today comes first; unbuilt destinations follow and
 * say which milestone delivers them (see `PendingFeaturePage`).
 */
export const homeCards: readonly HomeCard[] = [
  {
    id: 'appearance',
    title: 'Appearance',
    summary: 'Theme, accent colour and visual quality.',
    tone: '#7C6BE6',
    icon: Palette,
    milestone: null,
    destination: 'settings',
    settingsSection: 'personalization',
  },
  {
    id: 'displays',
    title: 'Displays',
    summary: 'Your monitors, resolutions and scaling as Windows reports them.',
    tone: '#2F8FD6',
    icon: Monitor,
    milestone: null,
    destination: 'settings',
    settingsSection: 'displays',
  },
  {
    id: 'system',
    title: 'System',
    summary: 'Windows version, engine status and where your data lives.',
    tone: '#2FB5A6',
    icon: Cpu,
    milestone: null,
    destination: 'settings',
    settingsSection: 'system',
  },
  fromDestination('library', '#3979B9'),
  fromDestination('games', '#D95C7A'),
  fromDestination('files', '#E0A030'),
  fromDestination('workspaces', '#4CAF6E'),
  fromDestination('multitasking', '#5B6CF0'),
  fromDestination('widgets', '#C86BD6'),
];
