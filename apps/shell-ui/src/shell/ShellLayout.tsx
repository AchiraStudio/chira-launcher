import { AnimatePresence, motion } from 'motion/react';
import { lazy, Suspense } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { fadeSlide } from '@/design-system';
import { PendingFeaturePage } from '@/features/pending/PendingFeaturePage';
import { getDestination } from '@/features/destinations';
import { useNavStore } from '@/stores/navStore';

// Heavier pages are split into their own chunks and loaded on first visit (plan §19.2).
const HomePage = lazy(() => import('@/features/home/HomePage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));

function CurrentPage() {
  const id = useNavStore((s) => s.destination);
  if (id === 'home') return <HomePage />;
  if (id === 'settings') return <SettingsPage />;
  return <PendingFeaturePage destination={getDestination(id)} />;
}

/** The shell frame: wallpaper, sidebar, top bar and the active page. */
export function ShellLayout() {
  const destination = useNavStore((s) => s.destination);

  return (
    <>
      <div className="wallpaper" aria-hidden />
      <div className="flex h-full gap-3 p-3">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="min-h-0 flex-1 overflow-y-auto rounded-card" aria-label={destination}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={destination} {...fadeSlide} className="min-h-full">
                <Suspense fallback={null}>
                  <CurrentPage />
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </>
  );
}
