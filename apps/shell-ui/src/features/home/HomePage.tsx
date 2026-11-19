import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Badge, duration, easeStandard } from '@/design-system';
import { useAmbientStore } from '@/stores/ambientStore';
import { useNavStore } from '@/stores/navStore';
import { Carousel } from './Carousel';
import { DisplaysPanel } from './DisplaysPanel';
import { RunningPanel } from './RunningPanel';
import { homeCards, type HomeCard } from './homeCards';

/** Title and description of the highlighted card, shown under the row like the PS5 home. */
function Caption({ card }: { card: HomeCard }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={card.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: duration.quick, ease: easeStandard }}
        className="space-y-2 px-24"
        aria-live="polite"
      >
        <h2 className="text-4xl font-extrabold tracking-tight">{card.title}</h2>
        <p className="max-w-xl text-base text-muted">{card.summary}</p>
        {card.milestone && (
          <Badge tone="accent">
            Planned for {card.milestone.id} · {card.milestone.name}
          </Badge>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

export default function HomePage() {
  const [index, setIndex] = useState(0);
  const setTone = useAmbientStore((s) => s.setTone);
  const navigate = useNavStore((s) => s.navigate);
  const openSettings = useNavStore((s) => s.openSettings);

  const card = homeCards[index] ?? homeCards[0];

  // The background follows the highlight; leaving Home restores the accent.
  useEffect(() => {
    setTone(card?.tone ?? null);
    return () => setTone(null);
  }, [card, setTone]);

  if (!card) return null;

  const open = (target: HomeCard) => {
    if (target.settingsSection) openSettings(target.settingsSection);
    else navigate(target.destination);
  };

  return (
    <div className="flex flex-col gap-4 pb-4">
      <Carousel cards={homeCards} index={index} onIndexChange={setIndex} onActivate={open} />
      <Caption card={card} />
      <div className="grid gap-5 px-24 pt-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <DisplaysPanel />
        <RunningPanel />
      </div>
    </div>
  );
}
