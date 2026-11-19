import { Gauge, Sparkles, Zap } from 'lucide-react';
import { RadioCardGroup, SegmentedControl, type RadioCardOption } from '@/design-system';
import type { MotionPreference } from '@/services/bindings/MotionPreference';
import type { QualityProfile } from '@/services/bindings/QualityProfile';
import type { ThemeMode } from '@/services/bindings/ThemeMode';
import { useSettingsStore } from '@/stores/settingsStore';
import { AccentPicker } from './AccentPicker';
import { SettingRow } from './SettingRow';

const THEMES = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
] as const satisfies ReadonlyArray<{ value: ThemeMode; label: string }>;

const MOTION = [
  { value: 'system', label: 'System' },
  { value: 'reduced', label: 'Reduced' },
  { value: 'full', label: 'Full' },
] as const satisfies ReadonlyArray<{ value: MotionPreference; label: string }>;

const QUALITY: ReadonlyArray<RadioCardOption<QualityProfile>> = [
  {
    value: 'performance',
    title: 'Performance',
    description: 'Minimal effects. No live blur, so it stays light on weaker GPUs.',
    icon: <Zap size={20} aria-hidden />,
  },
  {
    value: 'balanced',
    title: 'Balanced',
    description: 'Frosted glass and smooth animation. The recommended default.',
    icon: <Gauge size={20} aria-hidden />,
  },
  {
    value: 'ultra',
    title: 'Ultra',
    description: 'Adds specular highlights to large glass surfaces.',
    icon: <Sparkles size={20} aria-hidden />,
  },
];

export function PersonalizationSection() {
  const appearance = useSettingsStore((s) => s.settings?.appearance);
  const error = useSettingsStore((s) => s.error);
  const update = useSettingsStore((s) => s.update);

  if (!appearance) return null;

  return (
    <div className="divide-y divide-line">
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-control border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          Couldn’t save that change: {error}
        </p>
      )}

      <SettingRow
        title="Theme"
        description="Dark is the default. System follows your Windows colour mode."
      >
        <SegmentedControl
          label="Theme"
          value={appearance.theme}
          options={THEMES}
          onChange={(theme) => void update({ appearance: { theme } })}
        />
      </SettingRow>

      <SettingRow
        title="Accent colour"
        description="Used for selection, focus and highlights across the shell."
      >
        <AccentPicker
          value={appearance.accent}
          onChange={(accent) => void update({ appearance: { accent } })}
        />
      </SettingRow>

      <SettingRow
        stacked
        title="Visual quality"
        description="Independent of game graphics settings. Pick what suits this machine."
      >
        <RadioCardGroup
          label="Visual quality"
          value={appearance.qualityProfile}
          options={QUALITY}
          onChange={(qualityProfile) => void update({ appearance: { qualityProfile } })}
        />
      </SettingRow>

      <SettingRow
        title="Motion"
        description="Reduced removes animation entirely. System follows the Windows animation setting."
      >
        <SegmentedControl
          label="Motion"
          value={appearance.motion}
          options={MOTION}
          onChange={(motion) => void update({ appearance: { motion } })}
        />
      </SettingRow>
    </div>
  );
}
