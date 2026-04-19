/**
 * BloomKeyboard — custom QWERTY keyboard for BLOOM
 *
 * Always visible, letters only, all-caps, no autocomplete/emoji/numbers.
 * Mirrors the Wordle keyboard layout.
 *
 *   Row 1: Q W E R T Y U I O P
 *   Row 2:   A S D F G H J K L
 *   Row 3: ENTER  Z X C V B N M  ⌫
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, Radius } from '../constants/theme';

const ROW1 = ['Q','W','E','R','T','Y','U','I','O','P'] as const;
const ROW2 = ['A','S','D','F','G','H','J','K','L'] as const;
const ROW3 = ['Z','X','C','V','B','N','M'] as const;

interface BloomKeyboardProps {
  onKey: (letter: string) => void;
  onEnter: () => void;
  onDelete: () => void;
}

export default function BloomKeyboard({ onKey, onEnter, onDelete }: BloomKeyboardProps) {
  const { width } = useWindowDimensions();
  const { bottom: safeBottom } = useSafeAreaInsets();

  // Key width: fit 10 keys + 9 gaps in screen width with small horizontal padding
  const keyW = Math.floor((width - 24) / 10) - 4;
  const keyH = Math.round(keyW * 1.45);

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(8, safeBottom) }]}>
      {/* Row 1 */}
      <View style={styles.row}>
        {ROW1.map(k => (
          <TouchableOpacity
            key={k}
            style={[styles.key, { width: keyW, height: keyH }]}
            onPress={() => onKey(k)}
            activeOpacity={0.65}
          >
            <Text style={[styles.keyLabel, { fontSize: keyW * 0.38 }]}>{k}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Row 2 — centered */}
      <View style={[styles.row, styles.rowCenter]}>
        {ROW2.map(k => (
          <TouchableOpacity
            key={k}
            style={[styles.key, { width: keyW, height: keyH }]}
            onPress={() => onKey(k)}
            activeOpacity={0.65}
          >
            <Text style={[styles.keyLabel, { fontSize: keyW * 0.38 }]}>{k}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Row 3: ENTER … letters … ⌫ */}
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.key, styles.keyWide, { width: keyW * 1.6, height: keyH }]}
          onPress={onEnter}
          activeOpacity={0.65}
        >
          <Text style={[styles.keyLabelWide, { fontSize: keyW * 0.28 }]}>ENTER</Text>
        </TouchableOpacity>

        {ROW3.map(k => (
          <TouchableOpacity
            key={k}
            style={[styles.key, { width: keyW, height: keyH }]}
            onPress={() => onKey(k)}
            activeOpacity={0.65}
          >
            <Text style={[styles.keyLabel, { fontSize: keyW * 0.38 }]}>{k}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[styles.key, styles.keyWide, { width: keyW * 1.6, height: keyH }]}
          onPress={onDelete}
          activeOpacity={0.65}
        >
          <Text style={[styles.keyLabel, { fontSize: keyW * 0.5 }]}>⌫</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    paddingHorizontal: 6,
    paddingBottom: 8,
    paddingTop: 4,
    gap: 6,
    backgroundColor: Colors.bg,
    borderTopWidth: 1,
    borderTopColor: Colors.tileBorder,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  rowCenter: {
    // slight indent to visually center the 9-key row
    paddingHorizontal: 8,
  },
  key: {
    backgroundColor: Colors.tileBg,
    borderRadius: Radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.tileBorder,
  },
  keyWide: {
    backgroundColor: Colors.surface,
  },
  keyLabel: {
    color: Colors.darkGreen,
    fontWeight: '700',
    fontFamily: Fonts.mono,
  },
  keyLabelWide: {
    color: Colors.darkGreen,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
