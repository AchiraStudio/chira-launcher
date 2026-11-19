import { motionConfigValue, resolveMotion, resolveTheme } from './appearance';

describe('appearance resolution', () => {
  it('resolves the theme', () => {
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('resolves motion', () => {
    expect(resolveMotion('reduced', false)).toBe('reduced');
    expect(resolveMotion('full', true)).toBe('full');
    expect(resolveMotion('system', true)).toBe('reduced');
    expect(resolveMotion('system', false)).toBe('full');
  });

  it('maps motion preference onto motion/react reducedMotion', () => {
    expect(motionConfigValue('system')).toBe('user');
    expect(motionConfigValue('reduced')).toBe('always');
    expect(motionConfigValue('full')).toBe('never');
  });
});
