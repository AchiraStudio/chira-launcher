import { useEffect, useState } from 'react';

/** Re-renders when the minute changes; wakes up once per minute, never on a tight poll (HR-Q3). */
export function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: number;
    const schedule = () => {
      const msToNextMinute = 60_000 - (Date.now() % 60_000);
      timer = window.setTimeout(() => {
        setNow(new Date());
        schedule();
      }, msToNextMinute + 50);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, []);
  return now;
}
