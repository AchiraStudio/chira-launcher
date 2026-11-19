import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFakeEngine, sampleAppInfo, sampleDisplays, sampleWindows } from '@/test/fakeEngine';
import { resetEngineBootForTests } from '@/stores/engineStore';
import { useDisplayStore } from '@/stores/displayStore';
import { useIslandStore } from '@/stores/islandStore';
import { useNavStore } from '@/stores/navStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useShellStore } from '@/stores/shellStore';
import { useWindowsStore } from '@/stores/windowsStore';
import { ShellApp } from './ShellApp';

beforeEach(() => {
  resetEngineBootForTests();
  useSettingsStore.setState({ settings: null, error: null });
  useDisplayStore.setState({ displays: [], status: 'idle', error: null });
  useWindowsStore.setState({ windows: [], status: 'idle', error: null });
  useShellStore.setState({ windowMode: 'fullscreen', error: null });
  useIslandStore.setState({ expanded: false, activity: null });
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

async function bootShell() {
  render(<ShellApp />);
  return await screen.findByRole('navigation', { name: 'Primary' });
}

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

  it('boots into the Home carousel with the engine’s real displays and windows', async () => {
    installFakeEngine();
    await bootShell();

    expect(await screen.findByRole('listbox', { name: 'Sections' })).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /Display 1 2560 × 1440, Display 2 1920 × 1080/ }),
    ).toBeInTheDocument();
    expect(screen.getByTitle('Connected displays')).toHaveTextContent('2 displays');
    expect(await screen.findByText('notes.txt - Notepad')).toBeInTheDocument();
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
    await bootShell();

    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'));
    expect(document.documentElement.dataset.quality).toBe('performance');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#D95C7A');
  });

  it('updates live when the engine announces changes, and the Island announces them', async () => {
    const fake = installFakeEngine();
    await bootShell();

    act(() => {
      fake.emit({ type: 'displaysChanged', payload: [sampleDisplays[0]!] });
    });
    await waitFor(() =>
      expect(screen.getByTitle('Connected displays')).toHaveTextContent('1 display'),
    );
    expect(await screen.findByText('Displays changed')).toBeInTheDocument();

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

describe('Home carousel', () => {
  it('moves the highlight with the arrow keys and opens the highlighted card with Enter', async () => {
    const user = userEvent.setup();
    installFakeEngine();
    await bootShell();
    const list = await screen.findByRole('listbox', { name: 'Sections' });

    expect(screen.getByRole('heading', { level: 2, name: 'Appearance' })).toBeInTheDocument();
    list.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('option', { name: 'Displays' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(await screen.findByRole('heading', { level: 2, name: 'Displays' })).toBeInTheDocument();

    await user.keyboard('{Enter}');
    expect(useNavStore.getState()).toMatchObject({
      destination: 'settings',
      settingsSection: 'displays',
    });
  });

  it('labels cards for unbuilt destinations with their milestone', async () => {
    const user = userEvent.setup();
    installFakeEngine();
    await bootShell();
    const list = await screen.findByRole('listbox', { name: 'Sections' });
    list.focus();
    await user.keyboard('{End}');

    expect(screen.getByRole('option', { name: /Widgets, planned for M05/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(await screen.findByText(/Planned for M05 · Desktop Shell/)).toBeInTheDocument();
  });

  it('highlights on hover and opens on click', async () => {
    const user = userEvent.setup();
    installFakeEngine();
    await bootShell();
    const system = await screen.findByRole('option', { name: 'System' });

    await user.hover(system);
    expect(system).toHaveAttribute('aria-selected', 'true');
    await user.click(system);
    expect(useNavStore.getState().settingsSection).toBe('system');
  });
});

describe('Running now', () => {
  it('lists real windows and marks the active and minimized ones', async () => {
    installFakeEngine();
    await bootShell();
    const panel = await screen.findByRole('heading', { name: 'Running now' });
    const section = panel.closest('div')?.parentElement as HTMLElement;

    expect(await within(section).findByText('Notepad')).toBeInTheDocument();
    expect(within(section).getByText('Active')).toBeInTheDocument();
    expect(
      within(section).getByText('Calculator', { selector: 'span.font-bold' }),
    ).toBeInTheDocument();
    expect(within(section).getByText('Minimized')).toBeInTheDocument();
  });

  it('says so when nothing else is open, and re-reads on refresh', async () => {
    const user = userEvent.setup();
    const fake = installFakeEngine();
    fake.windows = [];
    await bootShell();
    expect(await screen.findByText('No other windows are open.')).toBeInTheDocument();

    // A window opens while the shell is showing; refreshing must pick it up.
    fake.windows = structuredClone(sampleWindows).slice(0, 1);
    await user.click(screen.getByRole('button', { name: 'Refresh running windows' }));
    expect(await screen.findByText('notes.txt - Notepad')).toBeInTheDocument();
    expect(screen.queryByText('No other windows are open.')).not.toBeInTheDocument();
  });

  it('shows an error instead of an empty list when discovery fails', async () => {
    const fake = installFakeEngine();
    fake.failNext('list_windows', { code: 'platform', message: 'EnumWindows failed' });
    await bootShell();
    expect(
      await screen.findByText(/Couldn’t list windows: EnumWindows failed/),
    ).toBeInTheDocument();
  });
});

describe('Dynamic Island', () => {
  it('is compact by default and expands into real system information', async () => {
    const user = userEvent.setup();
    installFakeEngine();
    await bootShell();

    await user.click(await screen.findByRole('button', { name: 'Open system panel' }));
    const panel = await screen.findByRole('dialog', { name: 'System' });

    expect(within(panel).getByText('2 · 2560 × 1440')).toBeInTheDocument();
    expect(within(panel).getByText('Windows 11 · 26200')).toBeInTheDocument();
    expect(within(panel).getByText('Fullscreen')).toBeInTheDocument();
  });

  it('closes with Escape', async () => {
    const user = userEvent.setup();
    installFakeEngine();
    await bootShell();
    await user.click(await screen.findByRole('button', { name: 'Open system panel' }));
    await screen.findByRole('dialog', { name: 'System' });

    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'System' })).not.toBeInTheDocument(),
    );
  });

  it('changes visual quality through the engine', async () => {
    const user = userEvent.setup();
    const fake = installFakeEngine();
    await bootShell();
    await user.click(await screen.findByRole('button', { name: 'Open system panel' }));
    const panel = await screen.findByRole('dialog', { name: 'System' });

    await user.click(within(panel).getByRole('radio', { name: 'Ultra' }));
    await waitFor(() => expect(fake.settings.appearance.qualityProfile).toBe('ultra'));
  });

  it('leaves and re-enters fullscreen from the island', async () => {
    const user = userEvent.setup();
    const fake = installFakeEngine();
    await bootShell();
    await user.click(await screen.findByRole('button', { name: 'Open system panel' }));

    await user.click(await screen.findByRole('button', { name: 'Leave fullscreen' }));
    await waitFor(() => expect(fake.windowMode).toBe('windowed'));
    expect(await screen.findByRole('button', { name: 'Go fullscreen' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Go fullscreen' }));
    await waitFor(() => expect(fake.windowMode).toBe('fullscreen'));
  });

  it('asks for confirmation before exiting', async () => {
    const user = userEvent.setup();
    const fake = installFakeEngine();
    await bootShell();
    await user.click(await screen.findByRole('button', { name: 'Open system panel' }));

    await user.click(await screen.findByRole('button', { name: 'Exit' }));
    expect(fake.calls.some((c) => c.command === 'exit_app')).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Click again to exit' }));
    await waitFor(() => expect(fake.calls.some((c) => c.command === 'exit_app')).toBe(true));
  });
});

describe('fullscreen', () => {
  it('F11 toggles fullscreen — the guaranteed way out', async () => {
    const user = userEvent.setup();
    const fake = installFakeEngine();
    await bootShell();
    expect(fake.windowMode).toBe('fullscreen');

    await user.keyboard('{F11}');
    await waitFor(() => expect(fake.windowMode).toBe('windowed'));
    expect(await screen.findByText('Windowed')).toBeInTheDocument();

    await user.keyboard('{F11}');
    await waitFor(() => expect(fake.windowMode).toBe('fullscreen'));
  });
});

describe('dock navigation and settings', () => {
  it('opens Settings from the dock, changes the quality profile through the engine, and reflects it', async () => {
    const user = userEvent.setup();
    const fake = installFakeEngine();
    const dock = await bootShell();

    await user.click(within(dock).getByRole('button', { name: 'Settings' }));
    await user.click(await screen.findByRole('radio', { name: /Performance/ }));

    await waitFor(() => expect(fake.settings.appearance.qualityProfile).toBe('performance'));
    await waitFor(() => expect(document.documentElement.dataset.quality).toBe('performance'));
    expect(screen.getByRole('radio', { name: /Performance/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('marks the current destination in the dock', async () => {
    const user = userEvent.setup();
    installFakeEngine();
    const dock = await bootShell();
    expect(within(dock).getByRole('button', { name: 'Home' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await user.click(within(dock).getByRole('button', { name: 'Files' }));
    expect(within(dock).getByRole('button', { name: 'Files' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(dock).getByRole('button', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('shows an honest placeholder naming the milestone for unbuilt destinations', async () => {
    const user = userEvent.setup();
    installFakeEngine();
    const dock = await bootShell();

    await user.click(within(dock).getByRole('button', { name: 'Library' }));
    expect(await screen.findByText(/Planned for M04 · Application Library/)).toBeInTheDocument();
    expect(screen.getByText(/Not built yet/)).toBeInTheDocument();
  });

  it('rejects an invalid custom accent in the UI before it reaches the engine', async () => {
    const user = userEvent.setup();
    const fake = installFakeEngine();
    const dock = await bootShell();
    await user.click(within(dock).getByRole('button', { name: 'Settings' }));

    const input = await screen.findByLabelText('Custom');
    await user.clear(input);
    await user.type(input, '#12');

    expect(screen.getByText(/six-digit hex colour/i)).toBeInTheDocument();
    expect(fake.calls.some((c) => c.command === 'update_settings')).toBe(false);
  });

  it('shows the engine’s diagnostics on the System page', async () => {
    const user = userEvent.setup();
    installFakeEngine();
    const dock = await bootShell();
    await user.click(within(dock).getByRole('button', { name: 'Settings' }));
    await user.click(await screen.findByRole('button', { name: 'System' }));

    expect(await screen.findByText('Per-monitor v2')).toBeInTheDocument();
    expect(screen.getByText(/ChiraLauncher\\logs/)).toBeInTheDocument();
  });
});
