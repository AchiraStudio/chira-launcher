import { installFakeEngine } from '@/test/fakeEngine';
import { useSettingsStore } from './settingsStore';

beforeEach(() => {
  useSettingsStore.setState({ settings: null, error: null });
});

describe('settingsStore', () => {
  it('loads settings from the engine', async () => {
    installFakeEngine();
    await useSettingsStore.getState().load();
    expect(useSettingsStore.getState().settings?.appearance.theme).toBe('dark');
  });

  it('sends a partial patch and adopts the engine’s answer', async () => {
    const fake = installFakeEngine();
    await useSettingsStore.getState().load();

    const ok = await useSettingsStore.getState().update({ appearance: { theme: 'light' } });

    expect(ok).toBe(true);
    expect(fake.calls.at(-1)).toEqual({
      command: 'update_settings',
      args: { patch: { appearance: { theme: 'light' } } },
    });
    expect(useSettingsStore.getState().settings?.appearance.theme).toBe('light');
    expect(useSettingsStore.getState().error).toBeNull();
  });

  it('surfaces a rejected update and keeps the previous settings', async () => {
    const fake = installFakeEngine();
    await useSettingsStore.getState().load();
    fake.failNext('update_settings', {
      code: 'invalid-input',
      message: 'accent colour must look like #RRGGBB',
    });

    const ok = await useSettingsStore.getState().update({ appearance: { accent: 'nope' } });

    expect(ok).toBe(false);
    expect(useSettingsStore.getState().error).toContain('#RRGGBB');
    expect(useSettingsStore.getState().settings?.appearance.accent).toBe('#3979B9');
  });

  it('clears the error after a later success', async () => {
    const fake = installFakeEngine();
    await useSettingsStore.getState().load();
    fake.failNext('update_settings', { code: 'storage', message: 'disk full' });
    await useSettingsStore.getState().update({ appearance: { theme: 'light' } });
    expect(useSettingsStore.getState().error).toBe('disk full');

    await useSettingsStore.getState().update({ appearance: { theme: 'light' } });
    expect(useSettingsStore.getState().error).toBeNull();
  });

  it('applies updates in the order they were requested', async () => {
    const fake = installFakeEngine();
    await useSettingsStore.getState().load();

    const store = useSettingsStore.getState();
    await Promise.all([
      store.update({ appearance: { theme: 'light' } }),
      store.update({ appearance: { qualityProfile: 'ultra' } }),
      store.update({ appearance: { theme: 'system' } }),
    ]);

    const sent = fake.calls
      .filter((c) => c.command === 'update_settings')
      .map((c) => c.args?.patch);
    expect(sent).toEqual([
      { appearance: { theme: 'light' } },
      { appearance: { qualityProfile: 'ultra' } },
      { appearance: { theme: 'system' } },
    ]);
    expect(useSettingsStore.getState().settings?.appearance).toMatchObject({
      theme: 'system',
      qualityProfile: 'ultra',
    });
  });
});
