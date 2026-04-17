/**
 * api.ts — Fetch puzzle data from the bloom-api backend
 */

import type { Graph } from './gameLogic';

// In development, point to local server.
// In production this would be the deployed API URL.
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export interface PuzzleResponse {
  dayIndex: number;
  seed: string;
  graph: Graph;
  nodeCount: number;
}

export interface SeedEntry {
  day_index: number;
  seed: string;
  node_count: number;
}

export async function fetchTodaysPuzzle(): Promise<PuzzleResponse> {
  const res = await fetch(`${API_BASE}/puzzle/today`);
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<PuzzleResponse>;
}

export async function fetchPuzzleByDay(dayIndex: number): Promise<PuzzleResponse> {
  const res = await fetch(`${API_BASE}/puzzle/${dayIndex}`);
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<PuzzleResponse>;
}

export async function fetchPuzzleBySeed(seed: string): Promise<PuzzleResponse> {
  const res = await fetch(`${API_BASE}/puzzle/seed/${encodeURIComponent(seed)}`);
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<PuzzleResponse>;
}

export async function fetchAllSeeds(): Promise<SeedEntry[]> {
  const res = await fetch(`${API_BASE}/puzzles`);
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<SeedEntry[]>;
}
