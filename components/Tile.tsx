/**
 * Tile.tsx — A single letter tile, botanical style
 *
 * states:
 *   'empty'   — white, pale-green border
 *   'active'  — gold-pale bg, gold border (active ring, no letter yet)
 *   'typing'  — gold-pale bg, gold border, has letter (scales up slightly)
 *   'bloomed' — pink bg, pink-dark border, white text (ring completed)
 *   'seed'    — dark-green bg, white text
 *   'hint'    — gold bg, white text (revealed hint letter)
 */

import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  cancelAnimation,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
} from 'react-native-reanimated';
import { Colors, Fonts } from '../constants/theme';

export type TileState = 'empty' | 'active' | 'typing' | 'bloomed' | 'seed' | 'hint';

interface TileProps {
  letter?: string;
  state?: TileState;
  size?: number;
  delay?: number;   // stagger delay for bloom animation (ms)
}

const BG: Record<TileState, string> = {
  empty:   Colors.tileBg,
  active:  Colors.tileBg,
  typing:  Colors.tileActive,
  bloomed: Colors.tileBloomed,
  seed:    Colors.tileSeed,
  hint:    Colors.gold,
};

const BORDER: Record<TileState, string> = {
  empty:   Colors.tileBorder,
  active:  Colors.tileActiveBorder,
  typing:  Colors.tileActiveBorder,
  bloomed: Colors.tileBloomedBorder,
  seed:    Colors.tileSeedBorder,
  hint:    Colors.gold,
};

const TEXT: Record<TileState, string> = {
  empty:   Colors.darkGreen,
  active:  Colors.darkGreen,
  typing:  Colors.darkGreen,
  bloomed: '#ffffff',
  seed:    '#faf8f2',
  hint:    '#ffffff',
};

export default function Tile({ letter = '', state = 'empty', size = 44, delay = 0 }: TileProps) {
  const scale = useSharedValue(1);

  // Track previous values in refs (not shared values) to avoid UI-thread races
  const prevLetterRef = useRef('');
  const hasBloomedRef = useRef(false);

  // Pop when a letter is freshly typed ('' → letter, not letter → letter)
  useEffect(() => {
    const wasEmpty = !prevLetterRef.current;
    prevLetterRef.current = letter;
    if (letter && wasEmpty && (state === 'typing' || state === 'active')) {
      cancelAnimation(scale);
      scale.value = withSequence(
        withTiming(1.08, { duration: 80 }),
        withTiming(1,    { duration: 100 }),
      );
    }
  }, [letter, state]);

  // Bloom pop fires exactly once when state first transitions to 'bloomed'
  useEffect(() => {
    if (state === 'bloomed' && !hasBloomedRef.current) {
      hasBloomedRef.current = true;
      cancelAnimation(scale);
      scale.value = withDelay(delay, withSequence(
        withTiming(1.12, { duration: 120 }),
        withTiming(1,    { duration: 200 }),
      ));
    }
  }, [state]); // intentionally excludes delay — use the value captured at first bloom

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: BG[state],
    borderColor: BORDER[state],
  }));

  const fontSize = size * 0.42;

  return (
    <Animated.View style={[styles.tile, { width: size, height: size * 1.1, borderRadius: size * 0.2 }, animStyle]}>
      <Text style={[styles.letter, { fontSize, color: TEXT[state] }]}>
        {letter.toUpperCase()}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
  },
  letter: {
    fontWeight: '700',
    fontFamily: Fonts.mono,
  },
});
