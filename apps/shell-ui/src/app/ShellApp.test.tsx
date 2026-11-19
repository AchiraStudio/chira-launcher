import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFakeEngine, sampleAppInfo, sampleDisplays } from '@/test/fakeEngine';
import { resetEngineBootForTests } from '@/stores/engineStore';
import { useDisplayStore } from '@/stores/displayStore';
import { useNavStore } from '@/stores/navStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { ShellApp } from './ShellApp';

beforeEach(() => {
  resetEngineBootForTests();
  useSettingsStore.setState({ settings: null, error: null });
  useDisplayStore.setState({ displays: [], status: 'idle', error: null });
  useNavStore.setState({ destination: 'home', settingsSection: 'personalization' });
  document.documentElement.removeAttribute('data-quality');
  document.documentElement.dataset.theme = 'dark';
});

// jsdom has no matchMedia; the shell asks for colour-scheme and reduced-motion preferences.
beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
});

describe('ShellApp boot', () => {
  it('shows an honest "not connected" screen outside the desktop host', async () => {
    installFakeEngine({ available: false });
    render(<ShellApp />);
    expect(await screen.findByText(/desktop engine isn’t connected/i)).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
  });

  it('refuses to run against an engine speaking another protocol version', async () => {
    installFakeEngine({ appInfo: { ...sampleAppInfo, protocolVersion: 999 } });
    render(<ShellApp />);
    expect(await screen.findByText(/couldn’t start/i)).toBeInTheDocument();
    expect(screen.getByText(/protocol v999/)).toBeInTheDocument();
  });

  it('boots into Home with the engine’s real displays', async () => {
    installFakeEngine();
    render(<ShellApp />);

    expect(await screen.findByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    expect(await screen.findByText(/good (morning|afternoon|evening)/i)).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /Display 1 2560 × 1440, Display 2 1920 × 1080/ }),
    ).toBeInTheDocument();
    expect(screen.getByTitle('Connected displays')).toHaveTextContent('2 displays');
  });

  it('applies the persisted appearance to the document', async () => {
    const fake = installFakeEngine();
    fake.settings = {
      ...fake.settings,
      appearance: {
        ...fake.settings.appearance,
        theme: 'light',
        qualityProfile: 'performance',
        accent: '#D95C7A',
      },
    };
    render(<ShellApp />);
    await screen.findByRole('navigation', { name: 'Primary' });

    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'));
    expect(document.documentElement.dataset.quality).toBe('performance');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#D95C7A');
  });

  it('updates live when the engine announces changes', async () => {
    const fake = installFakeEngine();
    render(<ShellApp />);
    await screen.findByRole('navigation', { name: 'Primary' });

    act(() => {
      fake.emit({ type: 'displaysChanged', payload: [sampleDisplays[0]!] });
    });
    await waitFor(() =>
      expect(screen.getByTitle('Connected displays')).toHaveTextContent('1 display'),
    );

    act(() => {
      fake.emit({
        type: 'settingsChanged',
        payload: {
          ...fake.settings,
          appearance: { ...fake.settings.appearance, qualityProfile: 'ultra' },
        },
      });
    });
    await waitFor(() => expect(document.documentElement.dataset.quality).toBe('ultra'));
  });
});

describe('navigation and settings', () => {
  it('opens Settings, changes the quality profile through the engine, and reflects it', async () => {
    const user = userEvent.setup();
    const fake = installFakeEngine();
    render(<ShellApp />);
    await screen.findByRole('navigation', { name: 'Primary' });

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const performance = await screen.findByRole('radio', { name: /Performance/ });
    await user.click(performance);

    await waitFor(() => expect(fake.settings.appearance.qualityProfile).toBe('performance'));
    await waitFor(() => expect(document.documentElement.dataset.quality).toBe('performance'));
    expect(screen.getByRole('radio', { name: /Performance/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('shows an honest placeholder naming the milestone for unbuilt destinations', async () => {
    const user = userEvent.setup();
    installFakeEngine();
    render(<ShellApp />);
    await screen.findByRole('navigation', { name: 'Primary' });

    await user.click(screen.getByRole('button', { name: /Library/ }));
    expect(await screen.findByText(/Planned for M04 · Application Library/)).toBeInTheDocument();
    expect(screen.getByText(/Not built yet/)).toBeInTheDocument();
  });

  it('rejects an invalid custom accent in the UI before it reaches the engine', async () => {
    const user = userEvent.setup();
    const fake = installFakeEngine();
    render(<ShellApp />);
    await screen.findByRole('navigation', { name: 'Primary' });
    await user.click(screen.getByRole('button', { name: 'Settings' }));

    const input = await screen.findByLabelText('Custom');
    await user.clear(input);
    await user.type(input, '#12');

    expect(screen.getByText(/six-digit hex colour/i)).toBeInTheDocument();
    expect(fake.calls.some((c) => c.command === 'update_settings')).toBe(false);
  });

  it('shows the engine’s diagnostics on the System page', async () => {
    const user = userEvent.setup();
    installFakeEngine();
    render(<ShellApp />);
    await screen.findByRole('navigation', { name: 'Primary' });
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(await screen.findByRole('button', { name: 'System' }));

    expect(await screen.findByText('Per-monitor v2')).toBeInTheDocument();
    expect(screen.getByText(/ChiraLauncher\\logs/)).toBeInTheDocument();
  });
});
