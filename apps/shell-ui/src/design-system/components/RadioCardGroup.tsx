import type { ReactNode } from 'react';
import { cn } from '../cn';
import { useRadioKeys } from './useRadioKeys';

export interface RadioCardOption<T extends string> {
  value: T;
  title: string;
  description: string;
  icon: ReactNode;
}

interface RadioCardGroupProps<T extends string> {
  label: string;
  value: T;
  options: ReadonlyArray<RadioCardOption<T>>;
  onChange: (value: T) => void;
}

/** A single-choice group presented as cards with a title and explanation. */
export function RadioCardGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: RadioCardGroupProps<T>) {
  const { onKeyDown, register } = useRadioKeys<HTMLButtonElement>(options.length, (i) => {
    const option = options[i];
    if (option) onChange(option.value);
  });

  return (
    <div role="radiogroup" aria-label={label} className="grid gap-3 sm:grid-cols-3">
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={register(index)}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={cn(
              'flex flex-col items-start gap-2 rounded-control border p-4 text-left',
              'transition-[background-color,border-color] duration-(--motion-quick)',
              selected
                ? 'border-accent/60 bg-accent/12'
                : 'border-line bg-surface-2/60 hover:border-line-strong hover:bg-surface-2',
            )}
          >
            <span className={cn('transition-colors', selected ? 'text-accent' : 'text-muted')}>
              {option.icon}
            </span>
            <span className="text-sm font-bold">{option.title}</span>
            <span className="text-[13px] leading-snug text-muted">{option.description}</span>
          </button>
        );
      })}
    </div>
  );
}
