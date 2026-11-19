import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../cn';

type Variant = 'primary' | 'subtle' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:brightness-110 active:brightness-95',
  subtle: 'bg-surface-3/70 text-fg border border-line hover:bg-surface-3 active:bg-surface-2',
  ghost: 'text-muted hover:text-fg hover:bg-surface-3/60',
};

export function Button({ variant = 'subtle', className, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-control px-4 py-2 text-sm font-semibold',
        'transition-[background-color,filter,color] duration-(--motion-quick) ease-(--ease-standard)',
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        className,
      )}
      {...rest}
    />
  );
}
