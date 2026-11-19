import { initialOf, toneFor } from './appTone';

describe('appTone', () => {
  it('is stable and case-insensitive', () => {
    expect(toneFor('Notepad')).toBe(toneFor('notepad'));
    expect(toneFor('Notepad')).toBe(toneFor('Notepad'));
  });

  it('always returns a hex colour', () => {
    for (const name of ['', 'a', 'Visual Studio Code', '日本語', '🙂']) {
      expect(toneFor(name)).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('picks a sensible initial', () => {
    expect(initialOf('notepad')).toBe('N');
    expect(initialOf('  (draft) Notes')).toBe('D');
    expect(initialOf('🙂')).toBe('?');
    expect(initialOf('')).toBe('?');
  });
});
