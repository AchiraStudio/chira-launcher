import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFakeEngine } from '@/test/fakeEngine';
import { resetEngineBootForTests } from '@/stores/engineStore';
import { useNavStore } from '@/stores/navStore';
import { ShellApp } from './ShellApp';

// HR-W11: the shell launches fullscreen, so a UI crash must never leave the user trapped in it.
// This page is forced to crash; the app-level F11 handler has to survive the error boundary.
vi.mock('@/features/settings/SettingsPage', () => ({
  default: () => {
    throw new Error('simulated render crash');
  },
}));

beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
});

describe('HR-W11: escaping fullscreen after a UI crash', () => {
  it('F11 still reaches the engine while the error boundary is showing', async () => {
    const user = userEvent.setup();
    const fake = installFakeEngine();
    resetEngineBootForTests();
    useNavStore.setState({ destination: 'home', settingsSection: 'personalization' });
    // React logs caught render errors; keep the test output readable.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(<ShellApp />);
    const dock = await screen.findByRole('navigation', { name: 'Primary' });
    await user.click(within(dock).getByRole('button', { name: 'Settings' }));

    expect(await screen.findByText('The interface hit a problem')).toBeInTheDocument();
    expect(fake.windowMode).toBe('fullscreen');

    await user.keyboard('{F11}');
    await waitFor(() => expect(fake.windowMode).toBe('windowed'));

    // And the crash itself was reported to the engine log.
    expect(fake.calls.some((c) => c.command === 'report_frontend_error')).toBe(true);
  });
});
