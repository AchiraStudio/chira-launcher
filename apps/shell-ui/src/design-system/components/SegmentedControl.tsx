import { motion } from 'motion/react';
import { useId } from 'react';
import { cn } from '../cn';
import { spring } from '../motion';
import { useRadioKeys } from './useRadioKeys';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  label: string;
  value: T;
  options: ReadonlyArray<SegmentOption<T>>;
  onChange: (value: T) => void;
}

/** A single-choice control with a sliding selection thumb. */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedControlProps<T>) {
  const thumbId = useId();
  const { onKeyDown, register } = useRadioKeys<HTMLButtonElement>(options.length, (i) => {
    const option = options[i];
    if (option) onChange(option.value);
  });

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex gap-1 rounded-control border border-line bg-surface-2/70 p-1"
    >
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
              'relative rounded-[9px] px-4 py-1.5 text-sm font-semibold',
              'transition-colors duration-(--motion-quick)',
              selected ? 'text-fg' : 'text-muted hover:text-fg',
            )}
          >
            {selected && (
              <motion.span
                layoutId={thumbId}
                transition={spring.snappy}
                className="absolute inset-0 rounded-[9px] border border-accent/50 bg-accent/20"
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
