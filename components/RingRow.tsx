/**
 * RingRow.tsx — One row of tiles for a single ring (word length stage)
 *
 * ring 1 = 4 tiles, ring 2 = 5, ring 3 = 6, ring 4 = 7
 */

import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Tile from './Tile';
import { Colors, Fonts, Spacing } from '../constants/theme';

type RowStatus = 'future' | 'active' | 'done';

interface RingRowProps {
  ringIndex: number;    // 1–4
  word: string;         // submitted word (empty if not yet done)
  hint?: string;        // letter to highlight in hint color
  status: RowStatus;
  tileSize?: number;
}

export default function RingRow({ ringIndex, word, hint, status, tileSize = 44 }: RingRowProps) {
  const tileCount = ringIndex + 3;  // ring 1 → 4 tiles, ring 4 → 7 tiles
  const letters = word.toUpperCase().split('');

  return (
    <View style={styles.row}>
      <Text style={[styles.label, status === 'future' && styles.labelMuted]}>
        {ringIndex}
      </Text>
      <View style={styles.tiles}>
        {Array.from({ length: tileCount }).map((_, i) => {
          const letter = letters[i] ?? '';
          let tileState: 'empty' | 'filled' | 'valid' | 'hint' = 'empty';
          if (status === 'done') {
            tileState = 'valid';
          } else if (letter) {
            tileState = hint && letter === hint.toUpperCase() ? 'hint' : 'filled';
          }

          return (
            <Tile
              key={i}
              letter={letter}
              state={tileState}
              size={tileSize}
              delay={i * 80}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.xs,
  },
  label: {
    width: 20,
    color: Colors.primary,
    fontFamily: Fonts.mono,
    fontSize: Fonts.size.sm,
    textAlign: 'center',
    marginRight: Spacing.xs,
  },
  labelMuted: {
    color: Colors.textMuted,
  },
  tiles: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
});
