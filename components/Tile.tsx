/**
 * Tile.tsx — A single letter tile, botanical style
 *
 * states:
 *   'empty'   — white, pale-green border
 *   'active'  — gold-pale bg, gold border (active ring, no letter yet)
 *   'typing'  — gold-pale bg, gold border, has letter (scales up slightly)
 *   'bloomed' — pink bg, pink-dark border, white text (ring completed)
 *   'seed'    — dark-green bg, white text
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { Colors, Fonts, Radius } from '../constants/theme';

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
  const prevState = useSharedValue(state);

  // Pop when letter is typed
  useEffect(() => {
    if (letter && (state === 'typing' || state === 'active')) {
      scale.value = withSpring(1.08, { damping: 6, stiffness: 300 }, () => {
        scale.value = withTiming(1, { duration: 100 });
      });
    }
  }, [letter]);

  // Bloom pop when ring is completed
  useEffect(() => {
    if (state === 'bloomed' && prevState.value !== 'bloomed') {
      scale.value = withDelay(delay, withSpring(1.12, { damping: 5, stiffness: 200 }, () => {
        scale.value = withTiming(1, { duration: 150 });
      }));
    }
    prevState.value = state;
  }, [state, delay]);

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
