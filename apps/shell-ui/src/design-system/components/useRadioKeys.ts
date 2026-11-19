import { useRef, type KeyboardEvent } from 'react';

/**
 * Roving-tabindex keyboard behaviour for a radio group: arrows (and Home/End) move selection
 * and focus, wrapping at the ends. Gives mouse, keyboard and — via synthesized key events —
 * controller navigation the same semantics (plan §14.1).
 */
export function useRadioKeys<T extends HTMLElement>(
  count: number,
  select: (index: number) => void,
) {
  const items = useRef<Array<T | null>>([]);

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    let next: number | null = null;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = (index + 1) % count;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = (index - 1 + count) % count;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = count - 1;
        break;
    }
    if (next === null) return;
    event.preventDefault();
    select(next);
    items.current[next]?.focus();
  };

  const register = (index: number) => (element: T | null) => {
    items.current[index] = element;
  };

  return { onKeyDown, register };
}
