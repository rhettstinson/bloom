/**
 * BLOOM game screen
 *
 * State machine:
 *   loading  → fetching puzzle from API
 *   playing  → user is entering words
 *   done     → puzzle complete (won or gave up)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import RingRow from '../../components/RingRow';
import { fetchTodaysPuzzle, fetchPuzzleBySeed, type PuzzleResponse } from '../../lib/api';
import {
  isValidMove,
  getHintLetter,
  ringForWord,
  TOTAL_RINGS,
  type Graph,
} from '../../lib/gameLogic';
import { loadProgress, saveProgress, recordResult } from '../../lib/storage';
import { Colors, Fonts, Spacing, Radius } from '../../constants/theme';

// ── Types ─────────────────────────────────────────────────────────────────

type ScreenState = 'loading' | 'playing' | 'done';

interface GameState {
  puzzle: PuzzleResponse;
  words: string[];        // [ring1Word, ring2Word, ring3Word, ring4Word]
  currentRing: number;    // 1–4, or 5 if done
  hintsUsed: number;
  hintLetter: string | null;
  won: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function BloomScreen() {
  const [screen, setScreen] = useState<ScreenState>('loading');
  const [game, setGame] = useState<GameState | null>(null);
  const [input, setInput] = useState('');
  const [shake, setShake] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<TextInput>(null);

  // ── Load puzzle ────────────────────────────────────────────────────────

  const loadPuzzle = useCallback(async (fetcher: () => Promise<PuzzleResponse>) => {
    setScreen('loading');
    setError('');
    try {
      const puzzle = await fetcher();

      // Restore saved progress if available
      const saved = await loadProgress(puzzle.dayIndex);
      if (saved && saved.seed === puzzle.seed) {
        setGame({
          puzzle,
          words: saved.words,
          currentRing: saved.done ? TOTAL_RINGS + 1 : saved.words.length + 1,
          hintsUsed: saved.hintsUsed,
          hintLetter: null,
          won: saved.won,
        });
        setScreen(saved.done ? 'done' : 'playing');
      } else {
        setGame({
          puzzle,
          words: [],
          currentRing: 1,
          hintsUsed: 0,
          hintLetter: null,
          won: false,
        });
        setScreen('playing');
      }
    } catch (err) {
      setError('Could not load puzzle. Is the server running?\nnpm start in bloom-api/');
      setScreen('loading');
    }
  }, []);

  useEffect(() => {
    loadPuzzle(fetchTodaysPuzzle);
  }, [loadPuzzle]);

  // ── Input handling ────────────────────────────────────────────────────

  const currentWord = useCallback((): string => {
    if (!game) return '';
    if (game.currentRing === 1) return game.puzzle.seed;
    return game.words[game.currentRing - 2] ?? game.puzzle.seed;
  }, [game]);

  const triggerShake = useCallback(() => {
    setShake(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setTimeout(() => setShake(false), 500);
  }, []);

  const submitWord = useCallback(() => {
    if (!game || screen !== 'playing') return;
    const candidate = input.trim().toLowerCase();
    if (!candidate) return;

    // Validate
    if (!isValidMove(currentWord(), candidate, game.puzzle.graph)) {
      if (!(candidate in game.puzzle.graph)) {
        setError('Not a valid word or not reachable from here');
      } else {
        setError('Must use all previous letters plus exactly one new letter');
      }
      triggerShake();
      return;
    }

    setError('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const newWords = [...game.words, candidate];
    const newRing = game.currentRing + 1;
    const won = newRing > TOTAL_RINGS;

    const nextGame: GameState = {
      ...game,
      words: newWords,
      currentRing: newRing,
      hintLetter: null,
      won,
    };
    setGame(nextGame);
    setInput('');

    // Persist progress
    saveProgress({
      dayIndex: game.puzzle.dayIndex,
      seed: game.puzzle.seed,
      words: newWords,
      hintsUsed: game.hintsUsed,
      done: won,
      won,
    });

    if (won) {
      recordResult(game.puzzle.dayIndex, true, game.hintsUsed);
      setScreen('done');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [game, input, screen, currentWord, triggerShake]);

  const requestHint = useCallback(() => {
    if (!game || screen !== 'playing') return;
    const hint = getHintLetter(currentWord(), game.puzzle.graph);
    if (!hint) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setGame(g => g ? { ...g, hintsUsed: g.hintsUsed + 1, hintLetter: hint } : g);
  }, [game, screen, currentWord]);

  // ── Render ────────────────────────────────────────────────────────────

  if (screen === 'loading') {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'BLOOM' }} />
        {error ? (
          <Text style={styles.errorBig}>{error}</Text>
        ) : (
          <ActivityIndicator size="large" color={Colors.primary} />
        )}
      </View>
    );
  }

  if (!game) return null;

  const seed = game.puzzle.seed.toLowerCase();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Stack.Screen options={{ title: 'BLOOM' }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Seed word */}
        <View style={styles.seedRow}>
          <Text style={styles.seedLabel}>SEED</Text>
          <Text style={styles.seedWord}>{seed.toUpperCase()}</Text>
        </View>

        {/* Ring rows */}
        {Array.from({ length: TOTAL_RINGS }).map((_, i) => {
          const ring = i + 1;
          const word = game.words[i] ?? '';
          let status: 'future' | 'active' | 'done' = 'future';
          if (ring < game.currentRing) status = 'done';
          else if (ring === game.currentRing) status = 'active';

          return (
            <RingRow
              key={ring}
              ringIndex={ring}
              word={word}
              hint={ring === game.currentRing ? (game.hintLetter ?? undefined) : undefined}
              status={status}
              tileSize={48}
            />
          );
        })}

        {/* Status / error */}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Game over */}
        {screen === 'done' ? (
          <View style={styles.doneBox}>
            <Text style={styles.doneTitle}>{game.won ? '🌸 Full Bloom!' : 'Game Over'}</Text>
            <Text style={styles.doneSub}>
              Hints used: {game.hintsUsed}
              {'\n'}Day {game.puzzle.dayIndex} · Seed: {game.puzzle.seed}
            </Text>
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() => loadPuzzle(fetchTodaysPuzzle)}
            >
              <Text style={styles.btnText}>Today's Puzzle</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Input row */
          <View style={[styles.inputRow, shake && styles.shake]}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={input}
              onChangeText={t => { setInput(t); setError(''); }}
              onSubmitEditing={submitWord}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={`${currentWord().toUpperCase()} + one letter`}
              placeholderTextColor={Colors.textMuted}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.btnSubmit} onPress={submitWord}>
              <Text style={styles.btnText}>→</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnHint} onPress={requestHint}>
              <Text style={styles.btnText}>?</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Dev: cycle seeds */}
        {__DEV__ && (
          <TouchableOpacity
            style={styles.btnDev}
            onPress={() => {
              Alert.prompt(
                'Load seed',
                'Enter a 3-letter seed word',
                seed => loadPuzzle(() => fetchPuzzleBySeed(seed)),
                'plain-text'
              );
            }}
          >
            <Text style={styles.btnDevText}>DEV: Change seed</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.bg,
    padding: Spacing.lg,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  content: {
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
    alignItems: 'center',
  },
  seedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  seedLabel: {
    color: Colors.textMuted,
    fontSize: Fonts.size.xs,
    letterSpacing: 2,
    fontWeight: '600',
  },
  seedWord: {
    color: Colors.primary,
    fontSize: Fonts.size.xxl,
    fontFamily: Fonts.mono,
    fontWeight: '700',
    letterSpacing: 4,
  },
  inputRow: {
    flexDirection: 'row',
    marginTop: Spacing.lg,
    gap: Spacing.xs,
    width: '100%',
    maxWidth: 360,
  },
  shake: {
    // Simple shake — a proper Reanimated shake can be added later
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.textPrimary,
    fontSize: Fonts.size.lg,
    fontFamily: Fonts.mono,
    borderWidth: 1,
    borderColor: Colors.surfaceAlt,
  },
  btnSubmit: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    width: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnHint: {
    backgroundColor: '#8b5cf6',
    borderRadius: Radius.md,
    width: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnText: {
    color: '#1a1a2e',
    fontWeight: '700',
    fontSize: Fonts.size.lg,
  },
  btnPrimary: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.md,
  },
  errorText: {
    color: Colors.error,
    fontSize: Fonts.size.sm,
    textAlign: 'center',
    marginTop: Spacing.sm,
    maxWidth: 300,
  },
  errorBig: {
    color: Colors.error,
    fontSize: Fonts.size.md,
    textAlign: 'center',
    lineHeight: 24,
  },
  doneBox: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  doneTitle: {
    color: Colors.primary,
    fontSize: Fonts.size.xxl,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  doneSub: {
    color: Colors.textMuted,
    fontSize: Fonts.size.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  btnDev: {
    marginTop: Spacing.xl,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.textMuted,
    borderRadius: Radius.sm,
  },
  btnDevText: {
    color: Colors.textMuted,
    fontSize: Fonts.size.xs,
  },
});
