/**
 * RingRow.tsx — One horizontal row of tiles for a ring stage
 *
 * Ring ordering (bottom to top in the game layout):
 *   ring 0 = seed (3 letters)
 *   ring 1 = 4 letters
 *   ring 2 = 5 letters
 *   ring 3 = 6 letters
 *   ring 4 = 7 letters  ← top / "full bloom"
 */

import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Tile, { TileState } from './Tile';
import { Colors, Fonts } from '../constants/theme';

type RowStatus = 'future' | 'active' | 'bloomed' | 'seed';

interface RingRowProps {
  ringIndex: number;      // 0 = seed, 1–4 = rings
  word: string;           // submitted/current word ('' if not yet reached)
  typingInput?: string;   // live input text (only used when status === 'active')
  status: RowStatus;
  tileSize?: number;
  label?: string;         // e.g. "7 letters"
}

export default function RingRow({
  ringIndex,
  word,
  typingInput = '',
  status,
  tileSize = 44,
  label,
}: RingRowProps) {
  const tileCount = ringIndex + 3;  // 3 for seed, 4 for ring1 … 7 for ring4
  const displayWord = status === 'active' ? typingInput : word;
  const letters = displayWord.toUpperCase().split('');

  return (
    <View style={[styles.row, status === 'future' && styles.rowFuture]}>
      {label ? (
        <Text style={[styles.label, status === 'future' && styles.labelMuted]}>
          {label}
        </Text>
      ) : null}

      <View style={styles.tiles}>
        {Array.from({ length: tileCount }).map((_, i) => {
          const letter = letters[i] ?? '';
          let tileState: TileState = 'empty';

          if (status === 'seed') {
            tileState = 'seed';
          } else if (status === 'bloomed') {
            tileState = 'bloomed';
          } else if (status === 'active') {
            tileState = letter ? 'typing' : 'active';
          }
          // status === 'future' → empty

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
    marginVertical: 5,
  },
  rowFuture: {
    opacity: 0.35,
  },
  label: {
    width: 58,
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: Fonts.size.xs,
    textAlign: 'right',
    marginRight: 8,
    fontStyle: 'italic',
    letterSpacing: 0.5,
  },
  labelMuted: {
    color: Colors.tileBorder,
  },
  tiles: {
    flexDirection: 'row',
    gap: 4,
  },
});
