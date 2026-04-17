/**
 * gameLogic.ts — Pure game logic ported from bloom.html
 *
 * No UI, no storage, no side-effects — safe to unit-test.
 */

export type Graph = Record<string, string[]>;

/** Sort a word's letters alphabetically (lowercase) */
export function sortStr(s: string): string {
  return s.toLowerCase().split('').sort().join('');
}

/**
 * Returns true if `cand` is an anagram of `prev` with exactly one extra letter.
 * Order doesn't matter — it's purely letter-set comparison.
 */
export function isAnagramPlusOne(prev: string, cand: string): boolean {
  const p = prev.toLowerCase();
  const c = cand.toLowerCase();
  if (c.length !== p.length + 1) return false;
  const sp = sortStr(p);
  const sc = sortStr(c);
  let pi = 0, ci = 0, extras = 0;
  while (ci < sc.length) {
    if (pi < sp.length && sp[pi] === sc[ci]) { pi++; ci++; }
    else { extras++; ci++; }
  }
  return pi === sp.length && extras === 1;
}

/**
 * Find the one letter that was added going from prev → curr.
 * Uses sorted-string walk (same algorithm as isAnagramPlusOne).
 */
export function findNewLetter(prev: string, curr: string): string {
  const sp = sortStr(prev).split('');
  const sc = sortStr(curr).split('');
  let pi = 0, ci = 0;
  while (ci < sc.length) {
    if (pi < sp.length && sp[pi] === sc[ci]) { pi++; ci++; }
    else return sc[ci].toUpperCase();
  }
  return '';
}

/**
 * Given the current word in the graph, pick a hint letter.
 * Strategy: find the letter that appears in the most children
 * (broadest coverage without pointing to a single solution).
 */
export function getHintLetter(currentWord: string, graph: Graph): string | null {
  const children = graph[currentWord.toLowerCase()];
  if (!children || children.length === 0) return null;

  // Tally new letters across all children
  const freq: Record<string, number> = {};
  for (const child of children) {
    const letter = findNewLetter(currentWord, child);
    if (letter) {
      freq[letter] = (freq[letter] ?? 0) + 1;
    }
  }

  // Return the most common new letter
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/**
 * Check if a word is valid as the next step from currentWord.
 * Rules:
 *  1. Must be in the graph (valid word AND completable)
 *  2. Must be an anagram+1 of currentWord
 */
export function isValidMove(currentWord: string, candidate: string, graph: Graph): boolean {
  const cLower = candidate.toLowerCase();
  return cLower in graph && isAnagramPlusOne(currentWord, candidate);
}

/** Number of rings needed to go from seed (3 letters) to full bloom (7 letters) */
export const TOTAL_RINGS = 4; // rings 1–4 (4-letter → 7-letter words)

/** Ring index = word length - 3 (so 4-letter = ring 1, 7-letter = ring 4) */
export function ringForWord(word: string): number {
  return word.length - 3;
}
