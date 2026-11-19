import type { HTMLAttributes } from 'react';
import { cn } from '../cn';

export type Material = 'clear' | 'frosted' | 'smoked' | 'solid' | 'accent';

interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  material?: Material;
  /** Corner radius token. */
  radius?: 'card' | 'control';
}

/** A panel rendered in one of the Adaptive Glass materials. */
export function Surface({
  material = 'smoked',
  radius = 'card',
  className,
  ...rest
}: SurfaceProps) {
  return (
    <div
      className={cn(
        'mat',
        `mat-${material}`,
        radius === 'card' ? 'rounded-card' : 'rounded-control',
        className,
      )}
      {...rest}
    />
  );
}
