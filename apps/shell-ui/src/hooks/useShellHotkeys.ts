import { useEffect } from 'react';
import { useShellStore } from '@/stores/shellStore';

/**
 * Shell-wide keys. F11 toggles fullscreen — together with the Dynamic Island's button it is the
 * guaranteed way out of fullscreen (plan pillar 6: the user is never locked in).
 */
export function useShellHotkeys(): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'F11') return;
      event.preventDefault();
      void useShellStore.getState().toggleFullscreen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
