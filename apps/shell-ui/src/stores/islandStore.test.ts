import { useIslandStore } from './islandStore';

beforeEach(() => {
  vi.useFakeTimers();
  useIslandStore.setState({ expanded: false, activity: null });
});
afterEach(() => vi.useRealTimers());

describe('islandStore', () => {
  it('announces an activity and dismisses it after a few seconds', () => {
    useIslandStore.getState().announce({ kind: 'settings', title: 'Settings saved' });
    expect(useIslandStore.getState().activity?.title).toBe('Settings saved');

    vi.advanceTimersByTime(3300);
    expect(useIslandStore.getState().activity).toBeNull();
  });

  it('lets a newer activity replace an older one without the old timer clearing it', () => {
    const { announce } = useIslandStore.getState();
    announce({ kind: 'settings', title: 'first' });
    vi.advanceTimersByTime(2000);
    announce({ kind: 'displays', title: 'second' });

    vi.advanceTimersByTime(1500); // the first timer would have fired by now
    expect(useIslandStore.getState().activity?.title).toBe('second');

    vi.advanceTimersByTime(2000);
    expect(useIslandStore.getState().activity).toBeNull();
  });

  it('toggles expansion', () => {
    useIslandStore.getState().toggle();
    expect(useIslandStore.getState().expanded).toBe(true);
    useIslandStore.getState().setExpanded(false);
    expect(useIslandStore.getState().expanded).toBe(false);
  });
});
