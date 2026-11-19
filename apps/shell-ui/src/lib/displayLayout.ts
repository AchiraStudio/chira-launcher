import type { Display } from '@/services/bindings/Display';

export interface PlacedDisplay {
  id: string;
  /** Position and size as percentages of the arrangement's bounding box. */
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
}

export interface DisplayArrangement {
  /** width / height of the bounding box of all displays (physical pixels). */
  aspectRatio: number;
  placed: PlacedDisplay[];
}

/**
 * Lays displays out proportionally inside their combined bounding box, so the mini-map mirrors the
 * real arrangement (including negative coordinates for monitors left of / above the primary).
 */
export function arrangeDisplays(displays: Display[]): DisplayArrangement {
  const usable = displays.filter((d) => d.bounds.width > 0 && d.bounds.height > 0);
  if (usable.length === 0) return { aspectRatio: 16 / 9, placed: [] };

  const minX = Math.min(...usable.map((d) => d.bounds.x));
  const minY = Math.min(...usable.map((d) => d.bounds.y));
  const maxX = Math.max(...usable.map((d) => d.bounds.x + d.bounds.width));
  const maxY = Math.max(...usable.map((d) => d.bounds.y + d.bounds.height));
  const width = maxX - minX;
  const height = maxY - minY;

  return {
    aspectRatio: width / height,
    placed: usable.map((d) => ({
      id: d.id,
      leftPct: ((d.bounds.x - minX) / width) * 100,
      topPct: ((d.bounds.y - minY) / height) * 100,
      widthPct: (d.bounds.width / width) * 100,
      heightPct: (d.bounds.height / height) * 100,
    })),
  };
}

/** "2560 × 1440". */
export function formatResolution(display: Display): string {
  return `${display.bounds.width} × ${display.bounds.height}`;
}

/** "150%". */
export function formatScale(display: Display): string {
  return `${Math.round(display.dpiScale * 100)}%`;
}
