/** Stable accent palette for application avatars (until real icons arrive with the library, M04). */
const PALETTE = [
  '#7C6BE6',
  '#2F8FD6',
  '#2FB5A6',
  '#4CAF6E',
  '#E0A030',
  '#D95C7A',
  '#5B6CF0',
  '#C86BD6',
];

/** Same name → same colour, every time, so an app keeps its identity between refreshes. */
export function toneFor(name: string): string {
  let hash = 0;
  for (const ch of name.toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length] ?? PALETTE[0]!;
}

/** First letter to show on an avatar. */
export function initialOf(name: string): string {
  const letter = [...name.trim()].find((c) => /\p{L}|\p{N}/u.test(c));
  return (letter ?? '?').toUpperCase();
}
