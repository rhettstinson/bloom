/**
 * BLOOM game screen — botanical design, graph-based validation
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import RingRow from '../../components/RingRow';
import FlowerGrowth from '../../components/FlowerGrowth';
import BloomKeyboard from '../../components/BloomKeyboard';
import { fetchTodaysPuzzle, fetchPuzzleBySeed, type PuzzleResponse } from '../../lib/api';
import { isValidMove, isAnagramPlusOne, findNewLetter, findPathToBloom, type Graph } from '../../lib/gameLogic';
import { loadProgress, saveProgress, recordResult, loadStats, type Stats } from '../../lib/storage';
import { Colors, Fonts, Spacing, Radius } from '../../constants/theme';

// ── Types ─────────────────────────────────────────────────────────────────

const TOTAL_RINGS = 4;
const MAX_HINTS = 3;
const MAX_MISSES = 4;

interface GameState {
  puzzle: PuzzleResponse;
  words: string[];           // completed ring words [ring1, ring2, ring3, ring4]
  currentRing: number;       // 1–4 while playing, 5 = done
  hintsUsed: number;
  misses: number;            // invalid submissions used (0–MAX_MISSES)
  revealedLetters: string[]; // letters revealed by hints for current ring
  won: boolean;
  lost: boolean;             // true when misses === MAX_MISSES or dead-end submitted
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
  const [howToModal, setHowToModal] = useState(false);
  const [streak, setStreak]     = useState(0);
  const devSeedRef              = useRef('');
  const shakeAnim               = useRef(new Animated.Value(0)).current;

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
          misses: saved.misses ?? 0,
          revealedLetters: [],
          won: saved.won,
          lost: saved.done && !saved.won,
        });
      } else {
        setGame({
          puzzle,
          words: [],
          currentRing: 1,
          hintsUsed: 0,
          misses: 0,
          revealedLetters: [],
          won: false,
          lost: false,
        });
      }
    } catch (e) {
      setError(`Could not load puzzle — make sure the API server is running (cd bloom-api && npm start)\n\n${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPuzzle(fetchTodaysPuzzle); }, [loadPuzzle]);
  useEffect(() => { loadStats().then(s => setStreak(s.streak)); }, []);

  const triggerShake = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 9, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -9, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 7, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -7, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

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
        misses: 0,
        revealedLetters: [],
        won: false,
        lost: false,
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

  // ── Responsive tile size ─────────────────────────────────────────────
  // Fit ring 4 (7 tiles) exactly within the available horizontal space:
  //   screen - padding(8×2) - flower(90) - gap(8) - tile-gaps(6×4)
  const { width: screenWidth } = useWindowDimensions();
  const tileSize = Math.max(28, Math.floor((screenWidth - 16 - 90 - 8 - 24) / 7));

  // ── Derived state ────────────────────────────────────────────────────

  const currentWord = (): string => {
    if (!game) return '';
    if (game.currentRing === 1) return game.puzzle.seed;
    return game.words[game.currentRing - 2] ?? game.puzzle.seed;
  };

  const ringsComplete = game ? Math.min(game.currentRing - 1, TOTAL_RINGS) : 0;
  const isPlaying = !!game && game.currentRing <= TOTAL_RINGS && !game.lost;

  // ── Keyboard handlers ───────────────────────────────────────────────

  const handleKey = useCallback((letter: string) => {
    if (!isPlaying || !game) return;
    const maxLen = game.currentRing + 3; // ring 1→4 letters, ring 4→7 letters
    setInputError('');
    setInput(prev => prev.length < maxLen ? prev + letter.toUpperCase() : prev);
  }, [isPlaying, game]);

  const handleDelete = useCallback(() => {
    if (!isPlaying) return;
    setInput(prev => prev.slice(0, -1));
    setInputError('');
  }, [isPlaying]);

  // ── Submit ───────────────────────────────────────────────────────────

  const submitWord = useCallback(() => {
    if (!game || !isPlaying) return;
    const candidate = input.trim().toLowerCase();
    if (!candidate) return;

    // ── Unified miss handler ──────────────────────────────────────────
    const recordMiss = (msg: string) => {
      const newMisses = game.misses + 1;
      setInputError(msg);
      setInput('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      triggerShake();

      if (newMisses >= MAX_MISSES) {
        // Out of lives — end game
        setGame({ ...game, misses: newMisses, currentRing: TOTAL_RINGS + 1, won: false, lost: true });
        setInputError('');
        saveProgress({
          dayIndex: game.puzzle.dayIndex,
          seed: game.puzzle.seed,
          words: game.words,
          hintsUsed: game.hintsUsed,
          misses: newMisses,
          done: true,
          won: false,
        });
        recordResult(game.puzzle.dayIndex, false, game.hintsUsed)
          .then(s => setStreak(s.streak));
      } else {
        setGame({ ...game, misses: newMisses });
        saveProgress({
          dayIndex: game.puzzle.dayIndex,
          seed: game.puzzle.seed,
          words: game.words,
          hintsUsed: game.hintsUsed,
          misses: newMisses,
          done: false,
          won: false,
        });
      }
    };

    // Error type 1: not a real word in the graph at all
    if (!(candidate in game.puzzle.graph)) {
      recordMiss('Not a word in the dictionary');
      return;
    }

    // Error type 2: valid word but violates the anagram+1 rule
    if (!isAnagramPlusOne(currentWord(), candidate)) {
      recordMiss('Must use all previous letters plus exactly one new letter');
      return;
    }

    // Error type 3: valid word and valid rule, but dead end on non-final ring
    const isFinalRing = game.currentRing === TOTAL_RINGS;
    if (!isFinalRing) {
      const children = game.puzzle.graph[candidate];
      if (!children || children.length === 0) {
        recordMiss('That word leads nowhere — no path to full bloom');
        return;
      }
    }

    // ── Valid move — advance ring ─────────────────────────────────────
    setInputError('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const newWords = [...game.words, candidate];
    const newRing  = game.currentRing + 1;
    const won      = newRing > TOTAL_RINGS;

    const next: GameState = {
      ...game,
      words: newWords,
      currentRing: newRing,
      revealedLetters: [],
      won,
      lost: false,
    };
    setGame(next);
    setInput('');

    saveProgress({
      dayIndex: game.puzzle.dayIndex,
      seed: game.puzzle.seed,
      words: newWords,
      hintsUsed: game.hintsUsed,
      misses: game.misses,
      done: won,
      won,
    });

    if (won) {
      recordResult(game.puzzle.dayIndex, true, game.hintsUsed)
        .then(s => setStreak(s.streak));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [game, input, isPlaying, triggerShake]);

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

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <Stack.Screen options={{
        headerStyle: { backgroundColor: Colors.bg },
        headerTintColor: Colors.darkGreen,
        headerShadowVisible: false,
        headerBackTitleVisible: false,
        headerTitle: () => (
          <Text style={{ color: Colors.darkGreen, fontFamily: Fonts.mono, fontSize: Fonts.size.xl, fontWeight: '700', letterSpacing: 2 }}>
            bloom
          </Text>
        ),
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <TouchableOpacity onPress={() => setHowToModal(true)} style={{ paddingHorizontal: 10 }}>
              <Text style={{ color: Colors.darkGreen, fontWeight: '700', fontSize: 18 }}>?</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={openGarden} style={{ paddingHorizontal: 10 }}>
              <Text style={{ fontSize: 20 }}>🌱</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setSeedModal(true); devSeedRef.current = ''; }} style={{ paddingHorizontal: 10 }}>
              <Text style={{ color: Colors.darkGreen, fontWeight: '700', fontSize: Fonts.size.sm, letterSpacing: 1.5 }}>NEW</Text>
            </TouchableOpacity>
          </View>
        ),
      }} />

      <ScrollView
        key={gameKey}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Main game area: flower + rings */}
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
                  tileSize={tileSize}
                />
              );
            })}

            {/* Seed row */}
            <RingRow
              ringIndex={0}
              word={seed}
              status="seed"
              tileSize={tileSize}
            />
          </View>
        </View>

        {/* Miss indicator — always visible while a game is loaded */}
        {game && (
          <View style={styles.missRow}>
            {Array.from({ length: MAX_MISSES }).map((_, i) => (
              <View key={i} style={[styles.missDot, i < game.misses && styles.missDotUsed]} />
            ))}
          </View>
        )}

        {/* Input area */}
        {isPlaying ? (
          <View style={styles.inputArea}>
            {/* Word prompt */}
            <Text style={styles.wordPrompt}>
              {currentWord().toUpperCase()} + one letter
            </Text>

            {/* Hint display */}
            {game.revealedLetters.length > 0 && (
              <Text style={styles.hintText}>
                hint: contains {game.revealedLetters.map(l => `"${l}"`).join(', ')}
              </Text>
            )}

            {/* Error — shakes with the error message */}
            {inputError ? (
              <Animated.Text style={[styles.errorText, { transform: [{ translateX: shakeAnim }] }]}>
                {inputError}
              </Animated.Text>
            ) : null}

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
        ) : game.won ? (
          /* ── Win screen ───────────────────────────────────────────────── */
          <View style={styles.doneBox}>
            <Text style={styles.doneTitle}>Full Bloom! 🌸</Text>
            <Text style={styles.doneSub}>
              {game.hintsUsed === 0 ? 'No hints used! 🌟' : `Hints used: ${game.hintsUsed}`}
              {'\n'}Day {game.puzzle.dayIndex} · Seed: {game.puzzle.seed.toUpperCase()}
            </Text>

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
        ) : (
          /* ── Loss screen ──────────────────────────────────────────────── */
          (() => {
            const deadWord = game.words[game.words.length - 1] ?? '';
            const correctWords = game.words.slice(0, -1);
            const parentWord = correctWords.length > 0
              ? correctWords[correctWords.length - 1]
              : game.puzzle.seed;
            const suggested = findPathToBloom(parentWord, game.puzzle.graph) ?? [];
            const allCorrect = [game.puzzle.seed.toLowerCase(), ...correctWords];

            return (
              <View style={styles.lossBox}>
                <Text style={styles.lossTitle}>Dead End 🥀</Text>
                <Text style={styles.lossSub}>
                  {game.misses >= MAX_MISSES
                    ? `You used all ${MAX_MISSES} attempts.`
                    : `"${deadWord.toUpperCase()}" leads nowhere.`}
                  {'\n'}Streak reset.
                </Text>

                {/* Player's path up to dead end */}
                <View style={styles.chain}>
                  {allCorrect.map((w, i) => {
                    const prev = i === 0 ? '' : allCorrect[i - 1];
                    const newLetter = i === 0 ? '' : findNewLetter(prev, w);
                    return (
                      <View key={`c${i}`} style={styles.chainRow}>
                        <Text style={styles.chainEmoji}>{i === 0 ? '🌱' : '✅'}</Text>
                        <Text style={styles.chainWord}>{w.toUpperCase()}</Text>
                        {newLetter ? <Text style={styles.chainNew}>+{newLetter.toUpperCase()}</Text> : null}
                      </View>
                    );
                  })}
                  {/* Dead-end word */}
                  <View style={styles.chainRow}>
                    <Text style={styles.chainEmoji}>🥀</Text>
                    <Text style={[styles.chainWord, styles.chainWordDead]}>
                      {deadWord.toUpperCase()}
                    </Text>
                    <Text style={[styles.chainNew, styles.chainNewDead]}>
                      +{findNewLetter(parentWord, deadWord).toUpperCase()}
                    </Text>
                  </View>

                  {/* Suggested continuation */}
                  {suggested.length > 0 && (
                    <>
                      <View style={styles.lossDivider}>
                        <Text style={styles.lossDividerText}>one valid path</Text>
                      </View>
                      {suggested.map((w, i) => {
                        const prev = i === 0 ? parentWord : suggested[i - 1];
                        const newLetter = findNewLetter(prev, w);
                        return (
                          <View key={`s${i}`} style={styles.chainRow}>
                            <Text style={styles.chainEmoji}>
                              {w.length === 7 ? '🌸' : '💡'}
                            </Text>
                            <Text style={[styles.chainWord, styles.chainWordSuggest]}>
                              {w.toUpperCase()}
                            </Text>
                            {newLetter ? (
                              <Text style={[styles.chainNew, styles.chainNewSuggest]}>
                                +{newLetter.toUpperCase()}
                              </Text>
                            ) : null}
                          </View>
                        );
                      })}
                    </>
                  )}
                </View>

                <TouchableOpacity style={styles.btnPrimary} onPress={() => loadPuzzle(fetchTodaysPuzzle, true)}>
                  <Text style={styles.btnPrimaryText}>TRY AGAIN</Text>
                </TouchableOpacity>
              </View>
            );
          })()
        )}

      </ScrollView>

      {/* Custom keyboard — always visible while playing */}
      {isPlaying && (
        <BloomKeyboard
          onKey={handleKey}
          onEnter={submitWord}
          onDelete={handleDelete}
        />
      )}

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

      {/* How-to-play modal */}
      {howToModal && (
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg }}>
            <View style={[styles.modal, { width: 320 }]}>
              <Text style={[styles.modalTitle, { fontFamily: Fonts.mono }]}>how to play</Text>

              {/* Goal */}
              <Text style={styles.howToSection}>Goal</Text>
              <Text style={styles.howToBody}>
                Grow a word from 3 letters to 7 letters, one letter at a time.
              </Text>

              {/* Rules */}
              <Text style={styles.howToSection}>Rules</Text>
              <Text style={styles.howToBody}>
                Each guess must contain all the letters from the previous word, plus exactly one new letter — rearranged in any order.
              </Text>

              {/* Example chain */}
              <View style={styles.howToChain}>
                {['ACE','RACE','TRACE','CRATES','SCATTER'].map((w, i, arr) => (
                  <View key={w} style={styles.howToChainRow}>
                    <Text style={styles.howToChainWord}>{w}</Text>
                    {i < arr.length - 1 && <Text style={styles.howToChainArrow}>→</Text>}
                  </View>
                ))}
              </View>

              {/* Misses */}
              <Text style={styles.howToSection}>Attempts</Text>
              <Text style={styles.howToBody}>
                You have {MAX_MISSES} attempts per puzzle. Each invalid submission uses one.
              </Text>
              <View style={[styles.missRow, { marginVertical: Spacing.xs }]}>
                {Array.from({ length: MAX_MISSES }).map((_, i) => (
                  <View key={i} style={styles.missDot} />
                ))}
              </View>

              {/* Hints */}
              <Text style={styles.howToSection}>Hints</Text>
              <Text style={styles.howToBody}>
                Use up to {MAX_HINTS} hints per puzzle. Each hint reveals one possible new letter.
              </Text>

              <TouchableOpacity
                style={[styles.modalBtnGo, { marginTop: Spacing.md, width: '100%' }]}
                onPress={() => setHowToModal(false)}
              >
                <Text style={styles.modalBtnGoText}>GOT IT</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      )}
    </View>
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

  // Miss indicator
  missRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: Spacing.md,
    marginBottom: 2,
  },
  missDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.tileBorder,
    backgroundColor: 'transparent',
  },
  missDotUsed: {
    backgroundColor: Colors.error,
    borderColor: Colors.error,
  },

  // Game area: flower + rings side-by-side
  gameArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 8,
    width: '100%',
  },
  rings: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'flex-end',
  },

  // Input
  inputArea: {
    marginTop: Spacing.sm,
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: Spacing.lg,
  },
  wordPrompt: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: Fonts.size.sm,
    letterSpacing: 1.5,
    marginBottom: Spacing.xs,
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
  btnHint: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 2,
    borderColor: Colors.tileBorder,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
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
  chainWordDead: {
    color: '#c0392b',
    textDecorationLine: 'line-through',
  },
  chainNewDead: {
    color: '#c0392b',
    backgroundColor: '#fde8e8',
  },
  chainWordSuggest: {
    color: Colors.textMuted,
  },
  chainNewSuggest: {
    color: Colors.textMuted,
    backgroundColor: Colors.surface,
  },

  // Loss screen
  lossBox: {
    marginTop: Spacing.lg,
    backgroundColor: '#fff8f8',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    width: '90%',
    maxWidth: 360,
    borderWidth: 1.5,
    borderColor: '#e8c0c0',
  },
  lossTitle: {
    color: '#c0392b',
    fontSize: Fonts.size.xxl,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  lossSub: {
    color: Colors.textMuted,
    fontSize: Fonts.size.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  lossDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.sm,
  },
  lossDividerText: {
    color: Colors.textMuted,
    fontSize: Fonts.size.xs,
    letterSpacing: 1,
    fontStyle: 'italic',
    backgroundColor: '#fff8f8',
    paddingHorizontal: 6,
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

  // How-to-play modal
  howToSection: {
    color: Colors.darkGreen,
    fontWeight: '700',
    fontSize: Fonts.size.sm,
    letterSpacing: 1,
    textTransform: 'uppercase',
    alignSelf: 'flex-start',
    marginTop: Spacing.md,
    marginBottom: 3,
  },
  howToBody: {
    color: Colors.textMuted,
    fontSize: Fonts.size.sm,
    lineHeight: 19,
    alignSelf: 'flex-start',
  },
  howToChain: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.xs,
    alignSelf: 'flex-start',
  },
  howToChainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  howToChainWord: {
    color: Colors.darkGreen,
    fontFamily: Fonts.mono,
    fontWeight: '700',
    fontSize: Fonts.size.xs,
    backgroundColor: Colors.surface,
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.tileBorder,
    letterSpacing: 1,
  },
  howToChainArrow: {
    color: Colors.textMuted,
    fontSize: Fonts.size.xs,
  },
});
