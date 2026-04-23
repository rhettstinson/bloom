/**
 * BLOOM game screen — botanical design, graph-based validation
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import RingRow from '../../components/RingRow';
import FlowerGrowth from '../../components/FlowerGrowth';
import BloomKeyboard from '../../components/BloomKeyboard';
import { fetchTodaysPuzzle, fetchPuzzleBySeed, type PuzzleResponse } from '../../lib/api';
import { isAnagramPlusOne, findPathToBloom, findPathToBloomViaLetter, findNewLetter, type Graph } from '../../lib/gameLogic';
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
  misses: number;
  revealedLetters: string[]; // hint letters revealed for current ring
  won: boolean;
  lost: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

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
  const [gameKey, setGameKey]   = useState(0);
  const [seedModal, setSeedModal] = useState(false);
  const [gardenModal, setGardenModal] = useState(false);
  const [gardenStats, setGardenStats] = useState<Stats | null>(null);
  const [howToModal, setHowToModal] = useState(false);
  const [streak, setStreak]     = useState(0);
  // Tracks how many solution rings have animated in after a loss
  const [revealedSolutionCount, setRevealedSolutionCount] = useState(0);
  const devSeedRef              = useRef('');
  const shakeAnim               = useRef(new Animated.Value(0)).current;

  // ── Load puzzle ──────────────────────────────────────────────────────

  const loadPuzzle = useCallback(async (
    fetcher: () => Promise<PuzzleResponse>,
    fresh = false,
  ) => {
    setGameKey(k => k + 1);
    setGame(null);
    setLoading(true);
    setError('');
    setInput('');
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
      setError('');
    } catch (e) {
      setError(`Seed "${seed}" not found. Available: ACE LAP NAG EAR RAN TOE ORE PIE ALE ODE APE ARC ARM ART ASH BAD BAG BAN BAR BAT`);
    }
  }, []);

  const openGarden = useCallback(async () => {
    const s = await loadStats();
    setGardenStats(s);
    setGardenModal(true);
  }, []);

  // ── Responsive tile size ─────────────────────────────────────────────
  const { width: screenWidth } = useWindowDimensions();
  const tileSize = Math.max(28, Math.floor((screenWidth - 16 - 90 - 8 - 24) / 7));

  // ── Derived state ────────────────────────────────────────────────────

  const currentWord = (): string => {
    if (!game) return '';
    if (game.currentRing === 1) return game.puzzle.seed;
    return game.words[game.currentRing - 2] ?? game.puzzle.seed;
  };

  // On loss, freeze the flower at the player's actual completed rings
  // (don't grow as solution is revealed). On win, show full bloom.
  const ringsComplete = game
    ? game.lost
      ? game.words.length
      : Math.min(game.currentRing - 1, TOTAL_RINGS)
    : 0;
  const isPlaying = !!game && game.currentRing <= TOTAL_RINGS && !game.lost;

  // Solution path for loss screen — computed once when lost, stable until game changes
  const solutionPath = useMemo(() => {
    if (!game?.lost) return [];
    const lastWord = game.words.length > 0
      ? game.words[game.words.length - 1]
      : game.puzzle.seed;
    const hintLetter = game.revealedLetters[0];
    return (hintLetter
      ? findPathToBloomViaLetter(lastWord, hintLetter, game.puzzle.graph)
      : findPathToBloom(lastWord, game.puzzle.graph)) ?? [];
  }, [game?.lost, game?.words, game?.revealedLetters, game?.puzzle]);

  // Reset solution animation counter when a new game starts
  useEffect(() => {
    setRevealedSolutionCount(0);
  }, [gameKey]);

  // Stagger-reveal solution rings after a loss (one ring every 700 ms)
  useEffect(() => {
    if (!game?.lost || revealedSolutionCount >= solutionPath.length) return;
    const timer = setTimeout(
      () => setRevealedSolutionCount(c => c + 1),
      revealedSolutionCount === 0 ? 400 : 700, // slight initial pause
    );
    return () => clearTimeout(timer);
  }, [game?.lost, revealedSolutionCount, solutionPath.length]);

  // ── Keyboard handlers ───────────────────────────────────────────────

  const handleKey = useCallback((letter: string) => {
    if (!isPlaying || !game) return;
    const maxLen = game.currentRing + 3;
    setInput(prev => prev.length < maxLen ? prev + letter.toUpperCase() : prev);
  }, [isPlaying, game]);

  const handleDelete = useCallback(() => {
    if (!isPlaying) return;
    setInput(prev => prev.slice(0, -1));
  }, [isPlaying]);

  // ── Submit ───────────────────────────────────────────────────────────

  const submitWord = useCallback(() => {
    if (!game || !isPlaying) return;
    const candidate = input.trim().toLowerCase();
    if (!candidate) return;
    if (candidate.length < currentWord().length + 1) return;

    const recordMiss = () => {
      const newMisses = game.misses + 1;
      setInput('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      triggerShake();

      if (newMisses >= MAX_MISSES) {
        setGame({ ...game, misses: newMisses, currentRing: TOTAL_RINGS + 1, won: false, lost: true });
        saveProgress({
          dayIndex: game.puzzle.dayIndex,
          seed: game.puzzle.seed,
          words: game.words,
          hintsUsed: game.hintsUsed,
          misses: newMisses,
          done: true,
          won: false,
        });
        recordResult(game.puzzle.dayIndex, false, game.hintsUsed, newMisses)
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

    if (!(candidate in game.puzzle.graph)) { recordMiss(); return; }
    if (!isAnagramPlusOne(currentWord(), candidate)) { recordMiss(); return; }

    const isFinalRing = game.currentRing === TOTAL_RINGS;
    if (!isFinalRing) {
      const children = game.puzzle.graph[candidate];
      if (!children || children.length === 0) { recordMiss(); return; }
    }

    // ── Valid move ────────────────────────────────────────────────────
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const newWords = [...game.words, candidate];
    const newRing  = game.currentRing + 1;
    const won      = newRing > TOTAL_RINGS;

    setGame({ ...game, words: newWords, currentRing: newRing, revealedLetters: [], won, lost: false });
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
      recordResult(game.puzzle.dayIndex, true, game.hintsUsed, game.misses)
        .then(s => setStreak(s.streak));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [game, input, isPlaying, triggerShake]);

  // ── Hint ─────────────────────────────────────────────────────────────

  const requestHint = useCallback(() => {
    if (!game || !isPlaying) return;
    if (game.hintsUsed >= MAX_HINTS) return;
    if (game.revealedLetters.length >= 1) return;
    const letter = pickHintLetter(currentWord(), game.puzzle.graph, game.revealedLetters);
    if (!letter) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setGame(g => g ? { ...g, hintsUsed: g.hintsUsed + 1, revealedLetters: [...g.revealedLetters, letter] } : g);
  }, [game, isPlaying]);

  // ── Render ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'bloom', headerStyle: { backgroundColor: Colors.bg }, headerTintColor: Colors.darkGreen }} />
        <ActivityIndicator size="large" color={Colors.midGreen} />
      </View>
    );
  }

  if (error || !game) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'bloom', headerStyle: { backgroundColor: Colors.bg }, headerTintColor: Colors.darkGreen }} />
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
        {/* Result banner — above the board, compact */}
        {game.won && (
          <View style={styles.resultBanner}>
            <Text style={styles.resultTitle}>Full Bloom! 🌸</Text>
            <Text style={styles.resultSub}>
              {game.hintsUsed === 0 ? 'Flawless — no hints needed 🌟' : `${game.hintsUsed} hint${game.hintsUsed > 1 ? 's' : ''} used`}
            </Text>
          </View>
        )}
        {game.lost && (
          <View style={[styles.resultBanner, styles.resultBannerLoss]}>
            <Text style={[styles.resultTitle, styles.resultTitleLoss]}>Almost in Bloom 🌿</Text>
            <Text style={styles.resultSub}>Here's one valid path ↓</Text>
          </View>
        )}

        {/* Main game area: flower (hidden when game ends) + rings */}
        <View style={styles.gameArea}>
          {(isPlaying || game.lost) && <FlowerGrowth ringsComplete={ringsComplete} />}

          <View style={[styles.rings, game.won && styles.ringsFull]}>
            {[4, 3, 2, 1].map(ring => {
              const playerCompleted = ring <= game.words.length;
              const solutionIdx     = ring - (game.words.length + 1); // 0-based into solutionPath
              const isRevealed      = game.lost && solutionIdx >= 0 && solutionIdx < revealedSolutionCount;

              let status: 'future' | 'active' | 'bloomed' | 'revealed' = 'future';
              if (playerCompleted)                           status = 'bloomed';
              else if (isRevealed)                          status = 'revealed';
              else if (isPlaying && ring === game.currentRing) status = 'active';

              const word = playerCompleted
                ? (game.words[ring - 1] ?? '')
                : isRevealed
                  ? (solutionPath[solutionIdx] ?? '')
                  : '';

              return (
                <RingRow
                  key={ring}
                  ringIndex={ring}
                  word={word}
                  typingInput={isPlaying && ring === game.currentRing ? input : ''}
                  status={status}
                  tileSize={tileSize}
                  hintLetters={isPlaying && ring === game.currentRing ? game.revealedLetters : []}
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

        {/* Miss indicator */}
        <Animated.View style={[styles.missRow, { transform: [{ translateX: shakeAnim }] }]}>
          <Text style={styles.missLabel}>Attempts</Text>
          {Array.from({ length: MAX_MISSES }).map((_, i) => (
            <View key={i} style={[styles.missDot, i < game.misses && styles.missDotUsed]} />
          ))}
        </Animated.View>

        {/* Input area — hint button while playing */}
        {isPlaying && (
          <View style={styles.inputArea}>
            {game.hintsUsed < MAX_HINTS ? (
              <TouchableOpacity style={styles.btnHint} onPress={requestHint}>
                <Text style={styles.btnHintText}>HINT ({MAX_HINTS - game.hintsUsed} left)</Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.btnHint, styles.btnHintExhausted]}>
                <Text style={[styles.btnHintText, styles.btnHintTextExhausted]}>NO HINTS LEFT</Text>
              </View>
            )}
          </View>
        )}

        {/* Action buttons — shown when game is over */}
        {(game.won || game.lost) && (
          <View style={styles.actionRow}>
            {game.won ? (
              <TouchableOpacity style={styles.btnPrimary} onPress={openGarden}>
                <Text style={styles.btnPrimaryText}>YOUR GARDEN 🌱</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.btnPrimary} onPress={() => loadPuzzle(fetchTodaysPuzzle, true)}>
                <Text style={styles.btnPrimaryText}>TRY AGAIN</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* Word prompt + keyboard — pinned above home indicator */}
      {isPlaying && (
        <>
          <View style={styles.wordPromptBar}>
            <Text style={styles.wordPrompt}>
              {currentWord().toUpperCase()} + 1 letter
            </Text>
          </View>
          <BloomKeyboard
            onKey={handleKey}
            onEnter={submitWord}
            onDelete={handleDelete}
          />
        </>
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

      {/* Your Garden — full-screen modal */}
      <Modal
        visible={gardenModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setGardenModal(false)}
      >
        <SafeAreaView style={styles.fullModal}>
          <View style={styles.fullModalHeader}>
            <Text style={styles.fullModalTitle}>Your Garden 🌱</Text>
            <TouchableOpacity onPress={() => setGardenModal(false)} style={styles.fullModalCloseBtn}>
              <Text style={styles.fullModalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.fullModalContent}>
            {gardenStats && gardenStats.played > 0 ? (
              <>
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

                <View style={styles.gardenDist}>
                  <Text style={styles.gardenDistTitle}>Misses per win</Text>
                  {Array.from({ length: MAX_MISSES }, (_, i) => i).map(i => {
                    const count = gardenStats.missDistribution?.[i] ?? 0;
                    const isPerfect = i === 0;
                    const fillRatio = gardenStats.won > 0 ? count / gardenStats.won : 0;
                    return (
                      <View key={i} style={styles.gardenDistRow}>
                        <Text style={[styles.gardenDistLabel, isPerfect && styles.gardenDistLabelBest]}>
                          {i === 0 ? 'Perfect' : `${i} miss${i > 1 ? 'es' : ''}`}
                        </Text>
                        <View style={styles.gardenDistBar}>
                          {fillRatio > 0 && (
                            <View style={[
                              styles.gardenDistFill,
                              isPerfect && styles.gardenDistFillBest,
                              { flex: fillRatio },
                            ]} />
                          )}
                        </View>
                        <Text style={[styles.gardenDistCount, isPerfect && styles.gardenDistLabelBest]}>
                          {count > 0 ? `${count}${isPerfect ? ' ⭐' : ''}` : '—'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : (
              <Text style={styles.gardenEmpty}>
                No games yet — play your first puzzle!
              </Text>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* How-to-play — full-screen modal */}
      <Modal
        visible={howToModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setHowToModal(false)}
      >
        <SafeAreaView style={styles.fullModal}>
          <View style={styles.fullModalHeader}>
            <Text style={[styles.fullModalTitle, { fontFamily: Fonts.mono }]}>how to play</Text>
            <TouchableOpacity onPress={() => setHowToModal(false)} style={styles.fullModalCloseBtn}>
              <Text style={styles.fullModalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.fullModalContent}>
            <Text style={styles.howToSection}>Goal</Text>
            <Text style={styles.howToBody}>
              Grow a word from 3 letters to 7 letters, one letter at a time.
            </Text>

            <Text style={styles.howToSection}>Rules</Text>
            <Text style={styles.howToBody}>
              Each guess must contain all the letters from the previous word, plus exactly one new letter — rearranged in any order.
            </Text>

            <View style={styles.howToChain}>
              {['ACE', 'RACE', 'TRACE', 'CRATES', 'SCATTER'].map((w, i, arr) => (
                <View key={w} style={styles.howToChainRow}>
                  <Text style={styles.howToChainWord}>{w}</Text>
                  {i < arr.length - 1 && <Text style={styles.howToChainArrow}>→</Text>}
                </View>
              ))}
            </View>

            <Text style={styles.howToSection}>Attempts</Text>
            <Text style={styles.howToBody}>
              You have {MAX_MISSES} attempts per puzzle. Each invalid submission uses one.
            </Text>
            <View style={[styles.missRow, { marginVertical: Spacing.sm }]}>
              {Array.from({ length: MAX_MISSES }).map((_, i) => (
                <View key={i} style={styles.missDot} />
              ))}
            </View>

            <Text style={styles.howToSection}>Hints</Text>
            <Text style={styles.howToBody}>
              Use up to {MAX_HINTS} hints per puzzle. Each hint reveals one possible new letter as a gold tile beside the active row.
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },

  // Result banner — above the board
  resultBanner: {
    width: '100%',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    alignItems: 'center',
  },
  resultBannerLoss: {
    // keep same layout, colour handled by title
  },
  resultTitle: {
    color: Colors.darkGreen,
    fontSize: Fonts.size.xl,
    fontWeight: '700',
    letterSpacing: 1,
  },
  resultTitleLoss: {
    color: Colors.midGreen,
  },
  resultSub: {
    color: Colors.textMuted,
    fontSize: Fonts.size.sm,
    marginTop: 3,
    letterSpacing: 0.5,
  },

  // Miss indicator
  missRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
    marginBottom: 2,
  },
  missLabel: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: Fonts.size.sm,
    letterSpacing: 1,
    marginRight: 4,
  },
  missDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: Colors.tileBorder,
    backgroundColor: 'transparent',
  },
  missDotUsed: {
    backgroundColor: Colors.pinkDark,
    borderColor: Colors.pinkDark,
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
  ringsFull: {
    alignItems: 'center', // centre the board when the flower is hidden
  },

  // Action buttons (end-of-game)
  actionRow: {
    marginTop: Spacing.lg,
    alignItems: 'center',
  },

  // Input
  inputArea: {
    marginTop: Spacing.md,
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: Spacing.lg,
  },
  wordPromptBar: {
    width: '100%',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    alignItems: 'center',
    backgroundColor: Colors.bg,
  },
  wordPrompt: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: Fonts.size.lg,
    letterSpacing: 2,
    fontWeight: '600',
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

  // Seed picker modal (small overlay)
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

  // Full-screen modals (garden, how-to-play)
  fullModal: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  fullModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.tileBorder,
  },
  fullModalTitle: {
    color: Colors.darkGreen,
    fontWeight: '700',
    fontSize: Fonts.size.xl,
  },
  fullModalCloseBtn: {
    padding: Spacing.sm,
  },
  fullModalCloseText: {
    color: Colors.textMuted,
    fontSize: Fonts.size.lg,
    fontWeight: '700',
  },
  fullModalContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
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
    backgroundColor: 'transparent',
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: Colors.tileBorder,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  gardenDistFill: {
    backgroundColor: Colors.midGreen,
    borderRadius: Radius.sm,
  },
  gardenDistFillBest: {
    backgroundColor: Colors.gold,
  },
  gardenDistLabelBest: {
    color: Colors.darkGreen,
    fontWeight: '700',
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
