/**
 * FlowerGrowth — illustrated botanical flower animation
 * Grows from seed to full bloom as rings complete (ringsComplete 0-4).
 * Uses React Native Animated API (supports Animated.Value arrays + stagger).
 *
 *  0 → seed breathing in soil
 *  1 → sprout emerges, cotyledon leaves spread
 *  2 → taller stem, true leaves unfurl
 *  3 → full stem, bud swells at tip
 *  4 → petals burst open, gold center pops
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

// ── Layout ────────────────────────────────────────────────────────────────

const W = 90;
const H = 320;
const CX = W / 2; // 45

const SOIL_H = 34;
const STEM_W = 6;
const STEM_LEFT = Math.round(CX - STEM_W / 2); // 42
const STEM_BOT = SOIL_H - 5; // 29 — inset into soil

// Stem height at each completed ring
const STEM_HEIGHTS = [0, 74, 138, 184, 198] as const;

// Element centers in "px from container bottom"
const COTY_BOT     = STEM_BOT + STEM_HEIGHTS[1] - 4; // 99
const LEAF_LO_BOT  = 120;
const LEAF_HI_BOT  = 150;
const BUD_BOT      = STEM_BOT + STEM_HEIGHTS[3] + 4; // 217
const FLOWER_BOT   = STEM_BOT + STEM_HEIGHTS[4] + 8; // 235

// Petal geometry
const PETAL_W     = 16;
const PETAL_H     = 30;
const PETAL_DIST  = 17;
const PETAL_ANGLES = [0, 60, 120, 180, 240, 300] as const;
const PETAL_COLORS = [
  '#e8a0b0', '#d490a5', '#eeaabf',
  '#d490a5', '#e8a0b0', '#eeaabf',
] as const;

// Leaf geometry
const LEAF_W = 28;
const LEAF_H = 13;

// ── Component ─────────────────────────────────────────────────────────────

interface Props {
  ringsComplete: number;
}

export default function FlowerGrowth({ ringsComplete }: Props) {
  const stemH       = useRef(new Animated.Value(0)).current;
  const seedOpacity = useRef(new Animated.Value(1)).current;
  const seedScale   = useRef(new Animated.Value(1)).current;
  const cotyL       = useRef(new Animated.Value(0)).current;
  const cotyR       = useRef(new Animated.Value(0)).current;
  const leafLoL     = useRef(new Animated.Value(0)).current;
  const leafLoR     = useRef(new Animated.Value(0)).current;
  const leafHiL     = useRef(new Animated.Value(0)).current;
  const leafHiR     = useRef(new Animated.Value(0)).current;
  const budScale    = useRef(new Animated.Value(0)).current;
  const petalAnims  = useRef(
    PETAL_ANGLES.map(() => new Animated.Value(0))
  ).current;
  const centerScale = useRef(new Animated.Value(0)).current;

  const breathRef   = useRef<Animated.CompositeAnimation | null>(null);
  const didBreath   = useRef(false);

  // Seed breathing loop — starts on mount
  useEffect(() => {
    if (!didBreath.current) {
      didBreath.current = true;
      breathRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(seedScale, { toValue: 1.18, duration: 1000, useNativeDriver: true }),
          Animated.timing(seedScale, { toValue: 0.88, duration: 1100, useNativeDriver: true }),
        ])
      );
      breathRef.current.start();
    }
  }, []);

  // Stage transitions
  useEffect(() => {
    // Stem grows with a springy bounce
    Animated.spring(stemH, {
      toValue: STEM_HEIGHTS[ringsComplete],
      damping: 18,
      stiffness: 60,
      useNativeDriver: false,
    }).start();

    if (ringsComplete >= 1) {
      breathRef.current?.stop();
      Animated.timing(seedOpacity, { toValue: 0, duration: 600, useNativeDriver: true }).start();
      // Cotyledons spread from stem tip
      Animated.sequence([
        Animated.delay(350),
        Animated.stagger(90, [
          Animated.spring(cotyL, { toValue: 1, damping: 5, stiffness: 220, useNativeDriver: true }),
          Animated.spring(cotyR, { toValue: 1, damping: 5, stiffness: 220, useNativeDriver: true }),
        ]),
      ]).start();
    }

    if (ringsComplete >= 2) {
      Animated.sequence([
        Animated.delay(420),
        Animated.parallel([
          Animated.spring(leafLoL, { toValue: 1, damping: 8, stiffness: 150, useNativeDriver: true }),
          Animated.spring(leafLoR, { toValue: 1, damping: 8, stiffness: 150, useNativeDriver: true }),
        ]),
        Animated.delay(170),
        Animated.parallel([
          Animated.spring(leafHiL, { toValue: 1, damping: 8, stiffness: 150, useNativeDriver: true }),
          Animated.spring(leafHiR, { toValue: 1, damping: 8, stiffness: 150, useNativeDriver: true }),
        ]),
      ]).start();
    }

    if (ringsComplete >= 3) {
      Animated.sequence([
        Animated.delay(520),
        Animated.spring(budScale, { toValue: 1, damping: 6, stiffness: 150, useNativeDriver: true }),
      ]).start();
    }

    if (ringsComplete >= 4) {
      Animated.sequence([
        Animated.delay(500),
        Animated.stagger(55,
          petalAnims.map(p =>
            Animated.spring(p, { toValue: 1, damping: 7, stiffness: 125, useNativeDriver: true })
          )
        ),
        Animated.spring(centerScale, { toValue: 1, damping: 5, stiffness: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [ringsComplete]);

  // Petal translations (radially outward via rotated-frame translateY)
  const petalTY = petalAnims.map(p =>
    p.interpolate({ inputRange: [0, 1], outputRange: [0, -PETAL_DIST] })
  );

  // Bud rises up slightly as it appears
  const budTY = budScale.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });

  return (
    <View style={styles.wrap}>

      {/* ── Soil ───────────────────────────────────────────────────────── */}
      <View style={styles.soil}>
        <View style={styles.soilRidge} />
      </View>

      {/* ── Seed ───────────────────────────────────────────────────────── */}
      <Animated.View style={[
        styles.seed,
        { opacity: seedOpacity, transform: [{ scale: seedScale }] },
      ]} />

      {/* ── Stem ───────────────────────────────────────────────────────── */}
      <Animated.View style={[styles.stem, { height: stemH }]} />
      {/* Stem highlight stripe */}
      <Animated.View style={[styles.stemHighlight, { height: stemH }]} />

      {/* ── Cotyledons ─────────────────────────────────────────────────── */}
      <Animated.View style={[styles.cotyL, {
        opacity: cotyL,
        transform: [{ scale: cotyL }, { rotate: '12deg' }],
      }]} />
      <Animated.View style={[styles.cotyR, {
        opacity: cotyR,
        transform: [{ scale: cotyR }, { rotate: '-12deg' }],
      }]} />

      {/* ── Lower leaves ───────────────────────────────────────────────── */}
      <Animated.View style={[styles.leafBase, styles.leafL, styles.leafLo, {
        opacity: leafLoL,
        transform: [{ scale: leafLoL }, { rotate: '22deg' }],
      }]} />
      <Animated.View style={[styles.leafBase, styles.leafR, styles.leafLo, {
        opacity: leafLoR,
        transform: [{ scale: leafLoR }, { rotate: '-22deg' }],
      }]} />

      {/* ── Upper leaves ───────────────────────────────────────────────── */}
      <Animated.View style={[styles.leafBase, styles.leafL, styles.leafHi, {
        opacity: leafHiL,
        transform: [{ scale: leafHiL }, { rotate: '26deg' }],
      }]} />
      <Animated.View style={[styles.leafBase, styles.leafR, styles.leafHi, {
        opacity: leafHiR,
        transform: [{ scale: leafHiR }, { rotate: '-26deg' }],
      }]} />

      {/* ── Bud ────────────────────────────────────────────────────────── */}
      <Animated.View style={[styles.bud, {
        opacity: budScale,
        transform: [{ translateY: budTY }, { scale: budScale }],
      }]}>
        <View style={styles.budPink} />
        <View style={styles.budSheen} />
      </Animated.View>

      {/* ── Petals ─────────────────────────────────────────────────────── */}
      {PETAL_ANGLES.map((angle, i) => (
        <Animated.View
          key={i}
          style={[
            styles.petal,
            { backgroundColor: PETAL_COLORS[i] },
            {
              opacity: petalAnims[i],
              transform: [
                { scale: petalAnims[i] },
                { rotate: `${angle}deg` },
                { translateY: petalTY[i] },
              ],
            },
          ]}
        />
      ))}

      {/* ── Gold center ────────────────────────────────────────────────── */}
      <Animated.View style={[styles.center, {
        opacity: centerScale,
        transform: [{ scale: centerScale }],
      }]}>
        <View style={styles.centerInner} />
      </Animated.View>

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: {
    width: W,
    height: H,
    flexShrink: 0,
  },

  // Soil
  soil: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SOIL_H,
    backgroundColor: '#7a5430',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    overflow: 'hidden',
  },
  soilRidge: {
    height: 5,
    backgroundColor: '#9a7040',
    marginTop: 6,
    marginHorizontal: 6,
    borderRadius: 3,
    opacity: 0.55,
  },

  // Seed — golden teardrop
  seed: {
    position: 'absolute',
    bottom: 8,
    left: CX - 9,
    width: 18,
    height: 23,
    backgroundColor: '#c9a84c',
    borderTopLeftRadius: 9,
    borderTopRightRadius: 7,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    borderWidth: 1.5,
    borderColor: '#8b6410',
  },

  // Stem
  stem: {
    position: 'absolute',
    bottom: STEM_BOT,
    left: STEM_LEFT,
    width: STEM_W,
    backgroundColor: '#4e8018',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#336010',
  },
  stemHighlight: {
    position: 'absolute',
    bottom: STEM_BOT,
    left: STEM_LEFT + 1,
    width: 2,
    backgroundColor: 'rgba(150,220,60,0.25)',
    borderRadius: 1,
  },

  // Cotyledons — small rounded seed leaves
  cotyL: {
    position: 'absolute',
    bottom: COTY_BOT,
    left: STEM_LEFT - 15,
    width: 15,
    height: 9,
    backgroundColor: '#90d450',
    borderTopLeftRadius: 7,
    borderBottomLeftRadius: 7,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
    borderWidth: 1,
    borderColor: '#5a8a1f',
  },
  cotyR: {
    position: 'absolute',
    bottom: COTY_BOT,
    left: STEM_LEFT + STEM_W,
    width: 15,
    height: 9,
    backgroundColor: '#90d450',
    borderTopRightRadius: 7,
    borderBottomRightRadius: 7,
    borderTopLeftRadius: 2,
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: '#5a8a1f',
  },

  // True leaves — base shape + left/right/position variants
  leafBase: {
    position: 'absolute',
    width: LEAF_W,
    height: LEAF_H,
    backgroundColor: '#6ab84c',
    borderWidth: 1,
    borderColor: '#448828',
  },
  leafL: {
    left: STEM_LEFT - LEAF_W,
    borderTopLeftRadius: LEAF_H / 2,
    borderBottomLeftRadius: LEAF_H / 2,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  leafR: {
    left: STEM_LEFT + STEM_W,
    borderTopRightRadius: LEAF_H / 2,
    borderBottomRightRadius: LEAF_H / 2,
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
  },
  leafLo: { bottom: LEAF_LO_BOT },
  leafHi: { bottom: LEAF_HI_BOT },

  // Bud — green oval with pink top
  bud: {
    position: 'absolute',
    bottom: BUD_BOT - 14,
    left: CX - 8,
    width: 16,
    height: 28,
    backgroundColor: '#4e8018',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
    borderWidth: 1,
    borderColor: '#336010',
    overflow: 'hidden',
  },
  budPink: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 12,
    backgroundColor: '#e090a8',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  budSheen: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: 4,
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 2,
  },

  // Petals — centered at flower center, spread via rotate+translateY
  petal: {
    position: 'absolute',
    bottom: FLOWER_BOT - PETAL_H / 2,
    left: CX - PETAL_W / 2,
    width: PETAL_W,
    height: PETAL_H,
    borderRadius: PETAL_W / 2,
    borderWidth: 1,
    borderColor: 'rgba(180,70,100,0.2)',
  },

  // Gold center
  center: {
    position: 'absolute',
    bottom: FLOWER_BOT - 9,
    left: CX - 9,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#d4a434',
    borderWidth: 1.5,
    borderColor: '#a07818',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerInner: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#f4d060',
  },
});
