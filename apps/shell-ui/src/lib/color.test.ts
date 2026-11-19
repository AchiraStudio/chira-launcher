import { contrastRatio, isValidHex, normalizeHex, readableForeground } from './color';

describe('color helpers', () => {
  it('validates exactly #RRGGBB', () => {
    expect(isValidHex('#3979B9')).toBe(true);
    expect(isValidHex(' #3979b9 ')).toBe(true);
    for (const bad of ['', '#fff', '3979B9', '#3979B9FF', '#GGGGGG', 'red']) {
      expect(isValidHex(bad), bad).toBe(false);
    }
  });

  it('normalizes to upper case', () => {
    expect(normalizeHex(' #aabbcc ')).toBe('#AABBCC');
  });

  it('computes WCAG contrast', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it('picks a readable foreground for light and dark accents', () => {
    expect(readableForeground('#FFD400')).toBe('#0B0D10');
    expect(readableForeground('#1E3A8A')).toBe('#FFFFFF');
    // The default Azure accent: whichever is chosen must be legible.
    const fg = readableForeground('#3979B9');
    expect(contrastRatio('#3979B9', fg)).toBeGreaterThanOrEqual(4.5);
  });
});
