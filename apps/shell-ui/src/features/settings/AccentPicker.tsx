import { Check } from 'lucide-react';
import { useId, useState } from 'react';
import { cn } from '@/design-system';
import { isValidHex, normalizeHex, readableForeground } from '@/lib/color';

/** Curated starting points; any #RRGGBB is allowed (plan §16.2: "custom accent colors"). */
export const ACCENT_PRESETS = [
  { name: 'Azure', value: '#3979B9' },
  { name: 'Violet', value: '#7C6BE6' },
  { name: 'Teal', value: '#2FB5A6' },
  { name: 'Amber', value: '#E0A030' },
  { name: 'Rose', value: '#D95C7A' },
  { name: 'Emerald', value: '#4CAF6E' },
] as const;

interface AccentPickerProps {
  value: string;
  onChange: (hex: string) => void;
}

export function AccentPicker({ value, onChange }: AccentPickerProps) {
  const inputId = useId();
  // `draft` is what the user is typing; `null` means "show the committed value".
  const [draft, setDraft] = useState<string | null>(null);
  const [seenValue, setSeenValue] = useState(value);

  // When the committed value changes (preset click, remote change), drop the stale draft.
  // Adjusting state during render is React's recommended alternative to an effect here.
  if (seenValue !== value) {
    setSeenValue(value);
    setDraft(null);
  }

  const text = draft ?? value;
  const invalid = draft !== null && !isValidHex(draft);

  const commit = (next: string) => {
    setDraft(next);
    if (isValidHex(next) && normalizeHex(next) !== value) onChange(normalizeHex(next));
  };

  return (
    <div className="flex flex-col items-start gap-3 sm:items-end">
      <div className="flex gap-2" role="radiogroup" aria-label="Accent colour presets">
        {ACCENT_PRESETS.map((preset) => {
          const selected = preset.value === value;
          return (
            <button
              key={preset.value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={preset.name}
              title={preset.name}
              onClick={() => commit(preset.value)}
              className={cn(
                'grid size-8 place-items-center rounded-full border-2 transition-transform duration-(--motion-quick)',
                selected ? 'scale-110 border-fg' : 'border-transparent hover:scale-110',
              )}
              style={{ background: preset.value, color: readableForeground(preset.value) }}
            >
              {selected && <Check size={15} strokeWidth={3} aria-hidden />}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor={inputId} className="text-xs font-semibold text-muted">
          Custom
        </label>
        <input
          id={inputId}
          value={text}
          onChange={(e) => commit(e.target.value)}
          onBlur={() => setDraft(null)}
          spellCheck={false}
          maxLength={7}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${inputId}-error` : undefined}
          className={cn(
            'selectable w-28 rounded-control border bg-surface-2 px-3 py-1.5 font-mono text-sm uppercase',
            invalid ? 'border-danger' : 'border-line focus:border-accent',
          )}
        />
      </div>
      {invalid && (
        <p id={`${inputId}-error`} className="text-xs text-danger">
          Use a six-digit hex colour like #3979B9.
        </p>
      )}
    </div>
  );
}
