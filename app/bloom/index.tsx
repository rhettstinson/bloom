/**
 * BLOOM game screen — botanical design, graph-based validation
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import FlowerGrowth from '../../components/FlowerGrowth';
import { fetchTodaysPuzzle, fetchPuzzleBySeed, type PuzzleResponse } from '../../lib/api';
import { isValidMove, findNewLetter, type Graph } from '../../lib/gameLogic';
import { loadProgress, saveProgress, recordResult, loadStats, type Stats } from '../../lib/storage';
import { Colors, Fonts, Spacing, Radius } from '../../constants/theme';

// ── Types ─────────────────────────────────────────────────────────────────

const TOTAL_RINGS = 4;
const MAX_HINTS = 3;

interface GameState {
  puzzle: PuzzleResponse;
  words: string[];           // completed ring words [ring1, ring2, ring3, ring4]
  currentRing: number;       // 1–4 while playing, 5 = done
  hintsUsed: number;
  revealedLetters: string[]; // letters revealed by hints for current ring
  won: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Pick a hint letter for the current ring.
 * Collects all unique new letters across every child of `currentWord`,
 * filters out already-revealed ones, picks a random unrevealed one.
 */
function pickHintLetter(currentWord: string, graph: Graph, revealed: string[]): string | null {
  const children = graph[currentWord.toLowerCase()];
  if (!children || children.length === 0) return null;

  const unique = new Set<string>();
  for (const child of children) {
    const letter = findNewLetter(currentWord, child);
    if (letter) unique.add(letter.toUpperCase());
  }

  const unrevealed = [...unique].filter(l => !revealed.includes(l));
  if (unrevealed.length === 0) return null;
  return unrevealed[Math.floor(Math.random() * unrevealed.length)];
}

// ── Component ─────────────────────────────────────────────────────────────

export default function BloomScreen() {
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [game, setGame]         = useState<GameState | null>(null);
  const [input, setInput]       = useState('');
  const [inputError, setInputError] = useState('');
  const [gameKey, setGameKey]   = useState(0);
  const [seedModal, setSeedModal] = useState(false);
  const [gardenModal, setGardenModal] = useState(false);
  const [gardenStats, setGardenStats] = useState<Stats | null>(null);
  const devSeedRef              = useRef('');
  const inputRef                = useRef<TextInput>(null);

  // ── Load puzzle ──────────────────────────────────────────────────────

  const loadPuzzle = useCallback(async (
    fetcher: () => Promise<PuzzleResponse>,
    fresh = false,
  ) => {
    // Increment key first — forces complete remount of the game tree,
    // resetting all Reanimated shared values in tiles/stem.
    setGameKey(k => k + 1);
    setGame(null);
    setLoading(true);
    setError('');
    setInput('');
    setInputError('');
    try {
      const puzzle = await fetcher();
      const saved = fresh ? null : await loadProgress(puzzle.dayIndex);
      if (saved && saved.seed === puzzle.seed) {
        setGame({
          puzzle,
          words: saved.words,
          currentRing: saved.done ? TOTAL_RINGS + 1 : saved.words.length + 1,
          hintsUsed: saved.hintsUsed,
          revealedLetters: [],
          won: saved.won,
        });
      } else {
        setGame({
          puzzle,
          words: [],
          currentRing: 1,
          hintsUsed: 0,
          revealedLetters: [],
          won: false,
        });
      }
    } catch (e) {
      setError(`Could not load puzzle — make sure the API server is running (cd bloom-api && npm start)\n\n${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPuzzle(fetchTodaysPuzzle); }, [loadPuzzle]);

  // Direct seed loader — bypasses loading-state complexity, always starts fresh
  const loadSeed = useCallback(async (seed: string) => {
    setSeedModal(false);
    devSeedRef.current = '';
    try {
      const puzzle = await fetchPuzzleBySeed(seed.trim().toUpperCase());
      setGameKey(k => k + 1);
      setGame({
        puzzle,
        words: [],
        currentRing: 1,
        hintsUsed: 0,
        revealedLetters: [],
        won: false,
      });
      setInput('');
      setInputError('');
      setError('');
    } catch (e) {
      setError(`Seed "${seed}" not found. Available: ACE LAP NAG EAR RAN TOE ORE PIE ALE ODE APE ARC ARM ART ASH BAD BAG BAN BAR BAT`);
    }
  }, []);

  // Open the Your Garden stats modal
  const openGarden = useCallback(async () => {
    const s = await loadStats();
    setGardenStats(s);
    setGardenModal(true);
  }, []);

  // ── Derived state ────────────────────────────────────────────────────

  const currentWord = (): string => {
    if (!game) return '';
    if (game.currentRing === 1) return game.puzzle.seed;
    return game.words[game.currentRing - 2] ?? game.puzzle.seed;
  };

  const ringsComplete = game ? Math.min(game.currentRing - 1, TOTAL_RINGS) : 0;
  const isPlaying = !!game && game.currentRing <= TOTAL_RINGS;

  // ── Submit ───────────────────────────────────────────────────────────

  const submitWord = useCallback(() => {
    if (!game || !isPlaying) return;
    const candidate = input.trim().toLowerCase();
    if (!candidate) return;

    if (!isValidMove(currentWord(), candidate, game.puzzle.graph)) {
      const reason = !(candidate in game.puzzle.graph)
        ? 'Not a valid word or no path to bloom from here'
        : 'Must use all previous letters plus exactly one new letter';
      setInputError(reason);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    // Block dead-end words on non-final rings (ring 4 words have no children by design)
    const isFinalRing = game.currentRing === TOTAL_RINGS;
    if (!isFinalRing) {
      const children = game.puzzle.graph[candidate];
      if (!children || children.length === 0) {
        setInputError('Dead end — no path to full bloom from this word');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
    }

    setInputError('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const newWords = [...game.words, candidate];
    const newRing  = game.currentRing + 1;
    const won      = newRing > TOTAL_RINGS;

    const next: GameState = {
      ...game,
      words: newWords,
      currentRing: newRing,
      revealedLetters: [],   // reset hints for new ring
      won,
    };
    setGame(next);
    setInput('');

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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [game, input, isPlaying]);

  // ── Hint ─────────────────────────────────────────────────────────────

  const requestHint = useCallback(() => {
    if (!game || !isPlaying) return;
    if (game.hintsUsed >= MAX_HINTS) return;
    const letter = pickHintLetter(currentWord(), game.puzzle.graph, game.revealedLetters);
    if (!letter) {
      setInputError('No more hints available for this ring');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setGame(g => g ? {
      ...g,
      hintsUsed: g.hintsUsed + 1,
      revealedLetters: [...g.revealedLetters, letter],
    } : g);
  }, [game, isPlaying]);

  // ── Render ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'BLOOM', headerStyle: { backgroundColor: Colors.bg }, headerTintColor: Colors.darkGreen }} />
        <ActivityIndicator size="large" color={Colors.midGreen} />
      </View>
    );
  }

  if (error || !game) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'BLOOM', headerStyle: { backgroundColor: Colors.bg }, headerTintColor: Colors.darkGreen }} />
        <Text style={styles.errorBig}>{error || 'Something went wrong.'}</Text>
        <TouchableOpacity style={[styles.btnPrimary, { marginTop: Spacing.lg }]} onPress={() => loadPuzzle(fetchTodaysPuzzle)}>
          <Text style={styles.btnPrimaryText}>RETRY</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const seed = game.puzzle.seed.toLowerCase();

  // Ring rows: displayed bottom→top so we reverse for flex-column
  // We render ring4 first (top), seed last (bottom)
  const ringLabels = ['4 letters', '5 letters', '6 letters', '7 letters'];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Stack.Screen options={{
        title: 'BLOOM',
        headerStyle: { backgroundColor: Colors.bg },
        headerTintColor: Colors.darkGreen,
        headerShadowVisible: false,
        headerLeft: () => (
          <TouchableOpacity onPress={openGarden} style={{ paddingHorizontal: 12 }}>
            <Text style={{ fontSize: 20 }}>🌱</Text>
          </TouchableOpacity>
        ),
        headerRight: () => (
          <TouchableOpacity onPress={() => { setSeedModal(true); devSeedRef.current = ''; }} style={{ paddingHorizontal: 12 }}>
            <Text style={{ color: Colors.darkGreen, fontWeight: '700', fontSize: Fonts.size.sm, letterSpacing: 1.5 }}>NEW</Text>
          </TouchableOpacity>
        ),
      }} />

      <ScrollView
        key={gameKey}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Main game area: stem + rings */}
        <View style={styles.gameArea}>
          <FlowerGrowth ringsComplete={ringsComplete} />

          <View style={styles.rings}>
            {/* Ring 4 → Ring 1 (top to bottom visually = highest ring first) */}
            {[4, 3, 2, 1].map(ring => {
              let status: 'future' | 'active' | 'bloomed' = 'future';
              if (ring < game.currentRing) status = 'bloomed';
              else if (ring === game.currentRing) status = 'active';

              return (
                <RingRow
                  key={ring}
                  ringIndex={ring}
                  word={ring < game.currentRing ? game.words[ring - 1] : ''}
                  typingInput={ring === game.currentRing ? input : ''}
                  status={status}
                  tileSize={42}
                  label={ringLabels[ring - 1]}
                />
              );
            })}

            {/* Seed row */}
            <RingRow
              ringIndex={0}
              word={seed}
              status="seed"
              tileSize={42}
              label="seed"
            />
          </View>
        </View>

        {/* Input area */}
        {isPlaying ? (
          <View style={styles.inputArea}>
            {/* Hint display */}
            {game.revealedLetters.length > 0 && (
              <Text style={styles.hintText}>
                Hint: contains {game.revealedLetters.map(l => `"${l}"`).join(', ')}
              </Text>
            )}

            {/* Error */}
            {inputError ? <Text style={styles.errorText}>{inputError}</Text> : null}

            {/* Input row */}
            <View style={styles.inputRow}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={input}
                onChangeText={t => { setInput(t); setInputError(''); }}
                onSubmitEditing={submitWord}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder={`${currentWord().toUpperCase()} + 1 letter…`}
                placeholderTextColor={Colors.textMuted}
                returnKeyType="done"
                maxLength={currentWord().length + 1}
              />
              <TouchableOpacity style={styles.btnEnter} onPress={submitWord}>
                <Text style={styles.btnEnterText}>ENTER</Text>
              </TouchableOpacity>
            </View>

            {/* Hint button */}
            {game.hintsUsed < MAX_HINTS ? (
              <TouchableOpacity style={styles.btnHint} onPress={requestHint}>
                <Text style={styles.btnHintText}>
                  HINT ({MAX_HINTS - game.hintsUsed} left)
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.btnHint, styles.btnHintExhausted]}>
                <Text style={[styles.btnHintText, styles.btnHintTextExhausted]}>
                  NO HINTS LEFT
                </Text>
              </View>
            )}
          </View>
        ) : (
          /* Won / done state */
          <View style={styles.doneBox}>
            <Text style={styles.doneTitle}>Full Bloom! 🌸</Text>
            <Text style={styles.doneSub}>
              {game.hintsUsed === 0 ? 'No hints used! 🌟' : `Hints used: ${game.hintsUsed}`}
              {'\n'}Day {game.puzzle.dayIndex} · Seed: {game.puzzle.seed.toUpperCase()}
            </Text>

            {/* Victory word chain */}
            <View style={styles.chain}>
              {[game.puzzle.seed.toLowerCase(), ...game.words].map((w, i) => {
                const prev = i === 0 ? '' : [game.puzzle.seed.toLowerCase(), ...game.words][i - 1];
                const newLetter = i === 0 ? '' : findNewLetter(prev, w);
                return (
                  <View key={i} style={styles.chainRow}>
                    <Text style={styles.chainEmoji}>{i === 0 ? '🌱' : i === game.words.length ? '🌸' : '🌿'}</Text>
                    <Text style={styles.chainWord}>{w.toUpperCase()}</Text>
                    {newLetter ? <Text style={styles.chainNew}>+{newLetter}</Text> : null}
                  </View>
                );
              })}
            </View>

            <TouchableOpacity style={styles.btnPrimary} onPress={() => loadPuzzle(fetchTodaysPuzzle)}>
              <Text style={styles.btnPrimaryText}>TODAY'S PUZZLE</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>

      {/* Seed picker modal */}
      {seedModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Choose a seed word</Text>
            <TextInput
              style={styles.modalInput}
              defaultValue=""
              onChangeText={t => { devSeedRef.current = t.toUpperCase(); }}
              placeholder="e.g. EAR"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              maxLength={3}
              onSubmitEditing={() => loadSeed(devSeedRef.current)}
            />
            <Text style={styles.modalHint}>
              ACE · LAP · NAG · EAR · RAN · TOE · ORE · PIE · ALE · ODE{'\n'}
              APE · ARC · ARM · ART · ASH · BAD · BAG · BAN · BAR · BAT
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setSeedModal(false)}>
                <Text style={styles.modalBtnCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnGo} onPress={() => loadSeed(devSeedRef.current)}>
                <Text style={styles.modalBtnGoText}>LOAD</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
      {/* Your Garden stats modal */}
      {gardenModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Your Garden 🌱</Text>

            {gardenStats && gardenStats.played > 0 ? (
              <>
                {/* 4-stat grid */}
                <View style={styles.gardenGrid}>
                  {[
                    { label: 'Played',  value: String(gardenStats.played) },
                    { label: 'Won %',   value: `${Math.round((gardenStats.won / gardenStats.played) * 100)}%` },
                    { label: 'Streak',  value: String(gardenStats.streak) },
                    { label: 'Best',    value: String(gardenStats.maxStreak) },
                  ].map(({ label, value }) => (
                    <View key={label} style={styles.gardenStat}>
                      <Text style={styles.gardenStatValue}>{value}</Text>
                      <Text style={styles.gardenStatLabel}>{label}</Text>
                    </View>
                  ))}
                </View>

                {/* Hint distribution */}
                {Object.keys(gardenStats.distribution).length > 0 && (
                  <View style={styles.gardenDist}>
                    <Text style={styles.gardenDistTitle}>Hint history</Text>
                    {Array.from({ length: MAX_HINTS + 1 }, (_, i) => i)
                      .filter(i => (gardenStats.distribution[i] ?? 0) > 0)
                      .map(i => (
                        <View key={i} style={styles.gardenDistRow}>
                          <Text style={styles.gardenDistLabel}>
                            {i === 0 ? 'No hints' : `${i} hint${i > 1 ? 's' : ''}`}
                          </Text>
                          <View style={styles.gardenDistBar}>
                            <View style={[
                              styles.gardenDistFill,
                              { flex: gardenStats.distribution[i] / gardenStats.won },
                            ]} />
                          </View>
                          <Text style={styles.gardenDistCount}>
                            {gardenStats.distribution[i]}{i === 0 ? ' 🌟' : ''}
                          </Text>
                        </View>
                      ))}
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.gardenEmpty}>
                No games yet — play your first puzzle!
              </Text>
            )}

            <TouchableOpacity
              style={[styles.modalBtnGo, { marginTop: Spacing.md, width: '100%' }]}
              onPress={() => setGardenModal(false)}
            >
              <Text style={styles.modalBtnGoText}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
  scroll: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  content: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },

  // Game area: stem + rings side-by-side
  gameArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  rings: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },

  // Input
  inputArea: {
    marginTop: Spacing.lg,
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: Spacing.lg,
  },
  hintText: {
    color: Colors.gold,
    fontSize: Fonts.size.sm,
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
    fontStyle: 'italic',
  },
  errorText: {
    color: Colors.error,
    fontSize: Fonts.size.sm,
    textAlign: 'center',
    marginBottom: Spacing.xs,
    maxWidth: 320,
  },
  errorBig: {
    color: Colors.error,
    fontSize: Fonts.size.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  inputRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    width: '100%',
    maxWidth: 360,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.tileBg,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.darkGreen,
    fontSize: Fonts.size.lg,
    fontFamily: Fonts.mono,
    borderWidth: 2,
    borderColor: Colors.tileBorder,
  },
  btnEnter: {
    backgroundColor: Colors.darkGreen,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnEnterText: {
    color: Colors.bg,
    fontWeight: '700',
    fontSize: Fonts.size.sm,
    letterSpacing: 1.5,
  },
  btnHint: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    borderWidth: 2,
    borderColor: Colors.tileBorder,
    borderRadius: Radius.md,
  },
  btnHintText: {
    color: Colors.textMuted,
    fontWeight: '700',
    fontSize: Fonts.size.xs,
    letterSpacing: 2,
  },
  btnHintExhausted: {
    borderColor: Colors.tileBorder,
    opacity: 0.45,
  },
  btnHintTextExhausted: {
    color: Colors.textMuted,
    letterSpacing: 1.5,
  },

  // Done / victory
  doneBox: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    width: '90%',
    maxWidth: 360,
    borderWidth: 1.5,
    borderColor: Colors.midGreen,
  },
  doneTitle: {
    color: Colors.darkGreen,
    fontSize: Fonts.size.xxl,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  doneSub: {
    color: Colors.textMuted,
    fontSize: Fonts.size.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  chain: {
    alignSelf: 'stretch',
    marginBottom: Spacing.md,
  },
  chainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 3,
  },
  chainEmoji: {
    fontSize: Fonts.size.md,
    width: 24,
  },
  chainWord: {
    color: Colors.darkGreen,
    fontWeight: '700',
    fontSize: Fonts.size.md,
    fontFamily: Fonts.mono,
    letterSpacing: 2,
  },
  chainNew: {
    color: Colors.pinkDark,
    backgroundColor: Colors.pinkLight,
    fontSize: Fonts.size.xs,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  btnPrimary: {
    backgroundColor: Colors.darkGreen,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
  },
  btnPrimaryText: {
    color: Colors.bg,
    fontWeight: '700',
    fontSize: Fonts.size.sm,
    letterSpacing: 2,
  },

  // Seed picker modal
  modalOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: Colors.bg,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    width: 300,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.tileBorder,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  modalTitle: {
    color: Colors.darkGreen,
    fontWeight: '700',
    fontSize: Fonts.size.lg,
    marginBottom: Spacing.md,
  },
  modalInput: {
    backgroundColor: Colors.tileBg,
    borderWidth: 2,
    borderColor: Colors.tileActiveBorder,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.darkGreen,
    fontFamily: Fonts.mono,
    fontSize: Fonts.size.xxl,
    width: '100%',
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: Spacing.sm,
  },
  modalHint: {
    color: Colors.textMuted,
    fontSize: Fonts.size.xs,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  modalBtns: {
    flexDirection: 'row',
    gap: Spacing.sm,
    width: '100%',
  },
  modalBtnCancel: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.tileBorder,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  modalBtnCancelText: {
    color: Colors.textMuted,
    fontWeight: '700',
    fontSize: Fonts.size.sm,
    letterSpacing: 1,
  },
  modalBtnGo: {
    flex: 1,
    backgroundColor: Colors.darkGreen,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  modalBtnGoText: {
    color: Colors.bg,
    fontWeight: '700',
    fontSize: Fonts.size.sm,
    letterSpacing: 1.5,
  },

  // Garden modal
  gardenGrid: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  gardenStat: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.tileBorder,
  },
  gardenStatValue: {
    color: Colors.darkGreen,
    fontSize: Fonts.size.xl,
    fontWeight: '700',
  },
  gardenStatLabel: {
    color: Colors.textMuted,
    fontSize: Fonts.size.xs,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  gardenDist: {
    width: '100%',
    marginBottom: Spacing.sm,
  },
  gardenDistTitle: {
    color: Colors.textMuted,
    fontSize: Fonts.size.xs,
    letterSpacing: 1,
    fontWeight: '700',
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
  },
  gardenDistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
    gap: Spacing.xs,
  },
  gardenDistLabel: {
    color: Colors.darkGreen,
    fontSize: Fonts.size.xs,
    width: 56,
    fontWeight: '600',
  },
  gardenDistBar: {
    flex: 1,
    height: 16,
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  gardenDistFill: {
    backgroundColor: Colors.midGreen,
    borderRadius: Radius.sm,
  },
  gardenDistCount: {
    color: Colors.textMuted,
    fontSize: Fonts.size.xs,
    width: 36,
    textAlign: 'right',
  },
  gardenEmpty: {
    color: Colors.textMuted,
    fontSize: Fonts.size.sm,
    textAlign: 'center',
    fontStyle: 'italic',
    marginVertical: Spacing.md,
    lineHeight: 20,
  },
});
