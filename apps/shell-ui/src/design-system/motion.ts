import type { Transition } from 'motion/react';

/** Motion tokens in seconds (plan §16.5). Mirror of the `--motion-*` CSS custom properties. */
export const duration = {
  instant: 0.1,
  quick: 0.16,
  standard: 0.24,
  spatial: 0.36,
  cinematic: 0.5,
  background: 0.7,
} as const;

export const easeStandard = [0.2, 0, 0, 1] as const;

/** Springs for things that should feel physical (selection thumbs, expanding surfaces). */
export const spring = {
  snappy: { type: 'spring', stiffness: 520, damping: 38, mass: 0.8 },
  soft: { type: 'spring', stiffness: 260, damping: 30, mass: 1 },
} as const satisfies Record<string, Transition>;

export const fadeSlide = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: duration.standard, ease: easeStandard },
} as const;
