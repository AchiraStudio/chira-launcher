import { useId } from 'react';

interface BrandMarkProps {
  size?: number;
  className?: string;
}

/** The Chira Launcher mark: an open ring with an orbiting dot. Mirrors resources/icons/chira-launcher.svg. */
export function BrandMark({ size = 32, className }: BrandMarkProps) {
  const gradient = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      className={className}
      role="img"
      aria-label="Chira Launcher"
    >
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="color-mix(in oklab, var(--accent) 60%, white)" />
          <stop offset="1" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <circle
        cx="512"
        cy="512"
        r="270"
        fill="none"
        stroke={`url(#${gradient})`}
        strokeWidth="92"
        strokeLinecap="round"
        strokeDasharray="1330 366"
        transform="rotate(-6 512 512)"
      />
      <circle cx="703" cy="321" r="46" fill={`url(#${gradient})`} />
    </svg>
  );
}
