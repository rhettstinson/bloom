/**
 * FlowerStem.tsx — Animated vertical stem that grows as rings complete.
 *
 * ringsComplete: 0–4
 *   0 → stem at 0 %
 *   1 → stem at 25 %  + leaf1 appears
 *   2 → stem at 50 %  + leaf2 appears
 *   3 → stem at 75 %
 *   4 → stem at 100 %
 */

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { Colors } from '../constants/theme';

interface Props {
  ringsComplete: number;  // 0–4
  height?: number;
}

export default function FlowerStem({ ringsComplete, height = 280 }: Props) {
  const fillPct  = useSharedValue(0);
  const leaf1    = useSharedValue(0);
  const leaf2    = useSharedValue(0);

  useEffect(() => {
    const pct = (ringsComplete / 4) * 100;
    fillPct.value = withTiming(pct, { duration: 600 });
    if (ringsComplete >= 1) leaf1.value = withSpring(1, { damping: 5, stiffness: 180 });
    if (ringsComplete >= 2) leaf2.value = withSpring(1, { damping: 5, stiffness: 180 });
  }, [ringsComplete]);

  const fillStyle = useAnimatedStyle(() => ({
    height: `${fillPct.value}%` as any,
  }));

  const leaf1Style = useAnimatedStyle(() => ({
    transform: [{ scale: leaf1.value }],
    opacity: leaf1.value,
  }));

  const leaf2Style = useAnimatedStyle(() => ({
    transform: [{ scale: leaf2.value }],
    opacity: leaf2.value,
  }));

  return (
    <View style={[styles.wrap, { height }]}>
      {/* track */}
      <View style={styles.track} />
      {/* fill — grows from bottom */}
      <Animated.View style={[styles.fill, fillStyle]} />
      {/* leaf 1 — right side, lower */}
      <Animated.View style={[styles.leaf, styles.leaf1, leaf1Style]} />
      {/* leaf 2 — left side, upper */}
      <Animated.View style={[styles.leaf, styles.leaf2, leaf2Style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 36,
    alignItems: 'center',
    position: 'relative',
    flexShrink: 0,
  },
  track: {
    position: 'absolute',
    bottom: 0,
    width: 4,
    height: '100%',
    backgroundColor: Colors.paleGreen,
    borderRadius: 2,
  },
  fill: {
    position: 'absolute',
    bottom: 0,
    width: 4,
    backgroundColor: Colors.midGreen,
    borderRadius: 2,
  },
  leaf: {
    position: 'absolute',
    width: 18,
    height: 10,
    backgroundColor: Colors.lightGreen,
    borderRadius: 0,
  },
  leaf1: {
    // right side, ~25% up from bottom
    bottom: '25%',
    left: 4,
    borderRadius: 0,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    transformOrigin: 'left center' as any,
  },
  leaf2: {
    // left side, ~55% up from bottom
    bottom: '55%',
    right: 4,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    transformOrigin: 'right center' as any,
  },
});
