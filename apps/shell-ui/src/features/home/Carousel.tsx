import { motion } from 'motion/react';
import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from 'react';
import { cn, duration, spring } from '@/design-system';
import { useMotionReduced } from '@/hooks/useMotionReduced';
import type { HomeCard } from './homeCards';

interface CarouselProps {
  cards: readonly HomeCard[];
  index: number;
  onIndexChange: (index: number) => void;
  onActivate: (card: HomeCard) => void;
}

/** How much the highlighted card grows. A pure transform: neighbours never reflow (HR-Q4). */
const FOCUS_SCALE = 1.16;

function cardBackground(tone: string): CSSProperties {
  return {
    background: `linear-gradient(155deg, color-mix(in oklab, ${tone} 92%, white 8%), color-mix(in oklab, ${tone} 52%, #0b0d12))`,
  };
}

/**
 * The PS5-style focus row (plan §11.1): large cards, one highlighted. Mouse hover, arrow keys and
 * (later) the controller D-pad all move the same highlight; Enter / click opens it.
 *
 * Implemented as a listbox with `aria-activedescendant`, so the whole row is a single tab stop and
 * the highlight is announced to screen readers.
 */
export function Carousel({ cards, index, onIndexChange, onActivate }: CarouselProps) {
  const reduced = useMotionReduced();
  const refs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    refs.current[index]?.scrollIntoView?.({
      inline: 'center',
      block: 'nearest',
      behavior: reduced ? 'auto' : 'smooth',
    });
  }, [index, reduced]);

  const onKeyDown = (event: KeyboardEvent) => {
    const last = cards.length - 1;
    switch (event.key) {
      case 'ArrowRight':
        onIndexChange(Math.min(index + 1, last));
        break;
      case 'ArrowLeft':
        onIndexChange(Math.max(index - 1, 0));
        break;
      case 'Home':
        onIndexChange(0);
        break;
      case 'End':
        onIndexChange(last);
        break;
      case 'Enter':
      case ' ': {
        const card = cards[index];
        if (card) onActivate(card);
        break;
      }
      default:
        return;
    }
    event.preventDefault();
  };

  return (
    <div
      role="listbox"
      aria-label="Sections"
      aria-orientation="horizontal"
      aria-activedescendant={`home-card-${cards[index]?.id}`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="no-scrollbar flex items-start gap-7 overflow-x-auto px-24 py-8 outline-none focus-visible:outline-none"
    >
      {cards.map((card, i) => {
        const selected = i === index;
        const Icon = card.icon;
        return (
          <motion.div
            key={card.id}
            id={`home-card-${card.id}`}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="option"
            aria-selected={selected}
            aria-label={
              card.milestone ? `${card.title}, planned for ${card.milestone.id}` : card.title
            }
            onMouseEnter={() => onIndexChange(i)}
            onClick={() => onActivate(card)}
            animate={{ scale: selected ? FOCUS_SCALE : 1, opacity: selected ? 1 : 0.82 }}
            transition={reduced ? { duration: 0 } : spring.snappy}
            style={cardBackground(card.tone)}
            className={cn(
              'relative grid h-56 w-44 shrink-0 cursor-default place-items-center overflow-hidden rounded-[26px]',
              'border border-white/15',
            )}
          >
            {/* Highlight ring and glow: only opacity animates. */}
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[26px] border-[3px] border-white/90"
              style={{ boxShadow: `0 0 46px 6px ${card.tone}` }}
              animate={{ opacity: selected ? 1 : 0 }}
              transition={{ duration: reduced ? 0 : duration.quick }}
            />
            <Icon
              size={64}
              strokeWidth={1.5}
              className="relative text-white drop-shadow-lg"
              aria-hidden
            />
            {card.milestone && (
              <span className="absolute top-3 right-3 rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-white/90">
                {card.milestone.id}
              </span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
