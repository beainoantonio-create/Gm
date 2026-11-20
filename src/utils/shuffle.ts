/**
 * Deterministic shuffle: the same seed always gives the same order.
 *
 * Why seeded instead of Math.random() on every render? The home page re-renders a lot
 * (cached list -> fresh list from the server, filters, back from a property page).
 * A plain random shuffle would make the cards jump around on each of those. With a seed
 * chosen once per visit the order is random between visits but stable while browsing.
 */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newShuffleSeed(): number {
  return Math.floor(Math.random() * 4294967296);
}

export function shuffleWithSeed<T extends { id: string }>(items: T[], seed: number): T[] {
  // Sort by id first so the result doesn't depend on the order the server/cache returned.
  const arr = [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const rand = mulberry32(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
