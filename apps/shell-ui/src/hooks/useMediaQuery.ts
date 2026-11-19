import { useEffect, useState } from 'react';

/** Subscribes to a media query and returns whether it currently matches. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    list.addEventListener('change', onChange);
    onChange();
    return () => list.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
