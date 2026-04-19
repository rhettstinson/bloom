/**
 * storage.ts — AsyncStorage wrappers for stats and daily progress
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Types ─────────────────────────────────────────────────────────────────

export interface Stats {
  played: number;
  won: number;
  streak: number;
  maxStreak: number;
  lastWonDay: number;    // dayIndex of last win
  distribution: Record<number, number>; // hintsUsed → count
}

export interface DayProgress {
  dayIndex: number;
  seed: string;
  words: string[];       // submitted words (ring 1–4)
  hintsUsed: number;
  misses: number;        // invalid submissions used (0–4)
  done: boolean;
  won: boolean;
}

const STATS_KEY = 'bloom_stats';
const PLAY_KEY = (day: number) => `bloom_play_${day}`;

// ── Stats ─────────────────────────────────────────────────────────────────

const DEFAULT_STATS: Stats = {
  played: 0,
  won: 0,
  streak: 0,
  maxStreak: 0,
  lastWonDay: -1,
  distribution: {},
};

export async function loadStats(): Promise<Stats> {
  try {
    const raw = await AsyncStorage.getItem(STATS_KEY);
    if (!raw) return { ...DEFAULT_STATS };
    return { ...DEFAULT_STATS, ...JSON.parse(raw) } as Stats;
  } catch {
    return { ...DEFAULT_STATS };
  }
}

export async function saveStats(stats: Stats): Promise<void> {
  await AsyncStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

export async function recordResult(
  dayIndex: number,
  won: boolean,
  hintsUsed: number
): Promise<Stats> {
  const stats = await loadStats();
  stats.played += 1;

  if (won) {
    stats.won += 1;
    stats.streak = dayIndex === stats.lastWonDay + 1 ? stats.streak + 1 : 1;
    stats.maxStreak = Math.max(stats.maxStreak, stats.streak);
    stats.lastWonDay = dayIndex;
    stats.distribution[hintsUsed] = (stats.distribution[hintsUsed] ?? 0) + 1;
  } else {
    stats.streak = 0;
  }

  await saveStats(stats);
  return stats;
}

// ── Daily Progress ────────────────────────────────────────────────────────

export async function loadProgress(dayIndex: number): Promise<DayProgress | null> {
  try {
    const raw = await AsyncStorage.getItem(PLAY_KEY(dayIndex));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { misses: 0, ...parsed } as DayProgress; // default misses for old saves
  } catch {
    return null;
  }
}

export async function saveProgress(progress: DayProgress): Promise<void> {
  await AsyncStorage.setItem(PLAY_KEY(progress.dayIndex), JSON.stringify(progress));
}
