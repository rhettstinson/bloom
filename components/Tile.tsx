/**
 * Tile.tsx — A single letter tile
 *
 * Props:
 *   letter     — character to display ('' = empty)
 *   state      — 'empty' | 'filled' | 'valid' | 'active' | 'hint'
 *   size       — tile edge length in px (default 44)
 *   delay      — stagger delay in ms for flip animation
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Colors, Fonts, Radius } from '../constants/theme';

type TileState = 'empty' | 'filled' | 'valid' | 'active' | 'hint';

interface TileProps {
  letter?: string;
  state?: TileState;
  size?: number;
  delay?: number;
}

const BG: Record<TileState, string> = {
  empty:  Colors.tileEmpty,
  filled: Colors.tileFilled,
  valid:  Colors.tileValid,
  active: Colors.yellow,
  hint:   '#8b5cf6',  // purple hint tile
};

const TEXT_COLOR: Record<TileState, string> = {
  empty:  Colors.textMuted,
  filled: Colors.textPrimary,
  valid:  '#1a1a2e',
  active: '#1a1a2e',
  hint:   '#ffffff',
};

export default function Tile({ letter = '', state = 'empty', size = 44, delay = 0 }: TileProps) {
  const flip = useSharedValue(0);
  const scale = useSharedValue(1);

  // Flip when the state changes to 'valid'
  useEffect(() => {
    if (state === 'valid') {
      flip.value = withDelay(delay, withTiming(1, { duration: 400 }));
    } else {
      flip.value = withTiming(0, { duration: 200 });
    }
  }, [state, delay]);

  // Pop when a letter is typed
  useEffect(() => {
    if (letter && state === 'filled') {
      scale.value = withTiming(1.15, { duration: 80 }, () => {
        scale.value = withTiming(1, { duration: 80 });
      });
    }
  }, [letter]);

  const animStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flip.value, [0, 0.5, 1], [0, 90, 0], Extrapolation.CLAMP);
    const bg = flip.value < 0.5 ? BG[state] : BG['valid'];
    return {
      transform: [{ rotateY: `${rotateY}deg` }, { scale: scale.value }],
      backgroundColor: bg,
    };
  });

  const fontSize = size * 0.45;

  return (
    <Animated.View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: size * 0.18 },
        animStyle,
      ]}
    >
      <Text style={[styles.letter, { fontSize, color: TEXT_COLOR[state] }]}>
        {letter.toUpperCase()}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.tileBorder,
  },
  letter: {
    fontFamily: Fonts.mono,
    fontWeight: '700',
  },
});
