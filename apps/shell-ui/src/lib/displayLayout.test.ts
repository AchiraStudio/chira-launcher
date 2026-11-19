import type { Display } from '@/services/bindings/Display';
import { arrangeDisplays, formatResolution, formatScale } from './displayLayout';

function display(id: string, x: number, y: number, width: number, height: number): Display {
  const rect = { x, y, width, height };
  return {
    id,
    label: id,
    deviceName: id,
    isPrimary: x === 0 && y === 0,
    bounds: rect,
    workArea: rect,
    dpiScale: 1.5,
  };
}

describe('arrangeDisplays', () => {
  it('returns an empty arrangement for no displays', () => {
    expect(arrangeDisplays([])).toEqual({ aspectRatio: 16 / 9, placed: [] });
  });

  it('fills the whole box for a single display', () => {
    const { placed, aspectRatio } = arrangeDisplays([display('a', 0, 0, 1920, 1080)]);
    expect(aspectRatio).toBeCloseTo(16 / 9);
    expect(placed).toEqual([{ id: 'a', leftPct: 0, topPct: 0, widthPct: 100, heightPct: 100 }]);
  });

  it('keeps side-by-side monitors proportional, including negative coordinates', () => {
    const { placed, aspectRatio } = arrangeDisplays([
      display('left', -2560, 0, 2560, 1440),
      display('main', 0, 0, 1920, 1080),
    ]);
    expect(aspectRatio).toBeCloseTo(4480 / 1440);
    const [left, main] = placed;
    expect(left?.leftPct).toBe(0);
    expect(left?.widthPct).toBeCloseTo((2560 / 4480) * 100);
    expect(main?.leftPct).toBeCloseTo((2560 / 4480) * 100);
    expect(main?.heightPct).toBeCloseTo((1080 / 1440) * 100);
  });

  it('ignores degenerate monitors instead of dividing by zero', () => {
    const { placed } = arrangeDisplays([display('bad', 0, 0, 0, 0), display('ok', 0, 0, 100, 50)]);
    expect(placed.map((p) => p.id)).toEqual(['ok']);
  });
});

describe('formatting', () => {
  it('formats resolution and scale', () => {
    const d = display('a', 0, 0, 2560, 1440);
    expect(formatResolution(d)).toBe('2560 × 1440');
    expect(formatScale(d)).toBe('150%');
  });
});
