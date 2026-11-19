import { AnimatePresence, motion } from 'motion/react';
import { lazy, Suspense } from 'react';
import { TopChrome } from '@/components/TopChrome';
import { fadeSlide } from '@/design-system';
import { getDestination } from '@/features/destinations';
import { PendingFeaturePage } from '@/features/pending/PendingFeaturePage';
import { useNavStore } from '@/stores/navStore';
import { AmbientBackground } from './AmbientBackground';
import { Dock } from './Dock';
import { DynamicIsland } from './DynamicIsland';

// Heavier pages are split into their own chunks and loaded on first visit (plan §19.2).
const HomePage = lazy(() => import('@/features/home/HomePage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));

function CurrentPage() {
  const id = useNavStore((s) => s.destination);
  if (id === 'home') return <HomePage />;
  if (id === 'settings') return <SettingsPage />;
  return <PendingFeaturePage destination={getDestination(id)} />;
}

/**
 * The shell (plan §11): three permanent anchors — the Dynamic Island (top), the floating dock
 * (bottom) and Home — over an ambient background. The page scrolls beneath them.
 */
export function ShellLayout() {
  const destination = useNavStore((s) => s.destination);

  return (
    <>
      <AmbientBackground />
      <TopChrome />
      <DynamicIsland />
      <main
        aria-label={getDestination(destination).label}
        className="no-scrollbar absolute inset-0 overflow-y-auto pt-20 pb-36"
      >
        <h1 className="sr-only">{getDestination(destination).label}</h1>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={destination} {...fadeSlide} className="min-h-full">
            <Suspense fallback={null}>
              <CurrentPage />
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
      <Dock />
    </>
  );
}
