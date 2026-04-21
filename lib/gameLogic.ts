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

/**
 * Score for a word: number of children it has in the graph.
 * Words with more children tend to be more common English words.
 */
function wordScore(word: string, graph: Graph): number {
  return graph[word.toLowerCase()]?.length ?? 0;
}

/**
 * Find the highest-scoring path from startWord to a 7-letter word.
 *
 * Instead of a greedy DFS that might lock onto an obscure branch,
 * we explore ALL paths and return the one whose total word-score is
 * highest. Score = sum of each word's child-count (more reachable words
 * = more likely to be a common word).
 *
 * Returns the path from startWord's children up to (and including) the
 * 7-letter word, or null if no path exists.
 */
export function findPathToBloom(startWord: string, graph: Graph): string[] | null {
  if (startWord.length >= 7) return [];

  let bestPath: string[] | null = null;
  let bestScore = -1;

  function dfs(word: string, path: string[], score: number, visited: Set<string>): void {
    for (const child of (graph[word.toLowerCase()] ?? [])) {
      const cKey = child.toLowerCase();
      if (visited.has(cKey)) continue;
      const ns = score + wordScore(child, graph);
      if (child.length === 7) {
        if (ns > bestScore) { bestScore = ns; bestPath = [...path, child]; }
      } else {
        visited.add(cKey);
        dfs(child, [...path, child], ns, visited);
        visited.delete(cKey);
      }
    }
  }

  dfs(startWord.toLowerCase(), [], 0, new Set([startWord.toLowerCase()]));
  return bestPath;
}

/**
 * Find the highest-scoring path whose first step adds `hintLetter`.
 * Falls back to findPathToBloom if no hint-letter paths exist.
 */
export function findPathToBloomViaLetter(
  startWord: string,
  hintLetter: string,
  graph: Graph,
): string[] | null {
  if (startWord.length >= 7) return [];
  const hint = hintLetter.toLowerCase();

  let hintBestPath: string[] | null = null;
  let hintBestScore = -1;

  for (const child of (graph[startWord.toLowerCase()] ?? [])) {
    if (findNewLetter(startWord, child).toLowerCase() !== hint) continue;
    const cs = wordScore(child, graph);
    if (child.length === 7) {
      if (cs > hintBestScore) { hintBestScore = cs; hintBestPath = [child]; }
    } else {
      const rest = findPathToBloom(child, graph);
      if (rest !== null) {
        const total = cs + rest.reduce((s, w) => s + wordScore(w, graph), 0);
        if (total > hintBestScore) { hintBestScore = total; hintBestPath = [child, ...rest]; }
      }
    }
  }

  return hintBestPath ?? findPathToBloom(startWord, graph);
}
