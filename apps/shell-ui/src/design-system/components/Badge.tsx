import type { HTMLAttributes } from 'react';
import { cn } from '../cn';

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

const tones: Record<Tone, string> = {
  neutral: 'bg-surface-3/70 text-muted border-line',
  accent: 'bg-accent/15 text-fg border-accent/40',
  success: 'bg-success/15 text-success border-success/35',
  warning: 'bg-warning/15 text-warning border-warning/35',
  danger: 'bg-danger/15 text-danger border-danger/35',
};

export function Badge({ tone = 'neutral', className, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        tones[tone],
        className,
      )}
      {...rest}
    />
  );
}
