import { AnimatePresence, motion } from 'motion/react';
import type { CSSProperties } from 'react';
import { duration } from '@/design-system';
import { useAmbientStore } from '@/stores/ambientStore';

/** Base wallpaper plus a toned glow that crossfades whenever the highlighted card changes. */
export function AmbientBackground() {
  const tone = useAmbientStore((s) => s.tone) ?? 'var(--accent)';

  return (
    <>
      <div className="wallpaper" aria-hidden />
      <AnimatePresence initial={false}>
        <motion.div
          key={tone}
          className="ambient"
          style={{ '--tone': tone } as CSSProperties}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: duration.background }}
          aria-hidden
        />
      </AnimatePresence>
    </>
  );
}
