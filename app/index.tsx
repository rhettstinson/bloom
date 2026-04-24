import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Colors, Fonts, Spacing, Radius } from '../constants/theme';
import { loadProgress } from '../lib/storage';

function todayIndex(): number {
  const epoch = new Date('2025-01-01T00:00:00Z');
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - epoch.getTime()) / 86_400_000);
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export default function HomeScreen() {
  const router = useRouter();
  const [played, setPlayed] = useState(false);

  useEffect(() => {
    loadProgress(todayIndex()).then(p => setPlayed(p?.done ?? false));
  }, []);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.hero}>
        <Text style={styles.icon}>🌸</Text>
        <Text style={styles.title}>BLOOM</Text>
        <Text style={styles.date}>{formatDate()}</Text>
      </View>

      <View style={styles.body}>
        {played ? (
          <Text style={styles.message}>
            {"You've bloomed today.\nCome back tomorrow\nfor a fresh puzzle."}
          </Text>
        ) : (
          <Text style={styles.message}>
            {"Start with a 3-letter seed.\nAdd one letter at a time.\nGrow your word all the way to bloom."}
          </Text>
        )}

        <TouchableOpacity
          style={[styles.btn, played && styles.btnSoft]}
          onPress={() => router.push('/bloom')}
          activeOpacity={0.82}
        >
          <Text style={[styles.btnText, played && styles.btnTextSoft]}>
            {played ? 'Admire Puzzle' : 'Play'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    gap: Spacing.xl,
  },

  hero: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  icon: {
    fontSize: 72,
    lineHeight: 84,
  },
  title: {
    color: Colors.darkGreen,
    fontSize: Fonts.size.title,
    fontWeight: '800',
    letterSpacing: 6,
  },
  date: {
    color: Colors.textMuted,
    fontSize: Fonts.size.sm,
    letterSpacing: 0.5,
    marginTop: Spacing.xs,
  },

  body: {
    alignItems: 'center',
    gap: Spacing.lg,
  },
  message: {
    color: Colors.midGreen,
    fontSize: Fonts.size.md,
    textAlign: 'center',
    lineHeight: 24,
  },

  btn: {
    backgroundColor: Colors.pink,
    borderRadius: Radius.full,
    paddingVertical: 14,
    paddingHorizontal: 44,
    borderWidth: 1.5,
    borderColor: Colors.pinkDark,
    marginTop: Spacing.sm,
  },
  btnSoft: {
    backgroundColor: Colors.surface,
    borderColor: Colors.tileBorder,
  },
  btnText: {
    color: Colors.darkGreen,
    fontSize: Fonts.size.lg,
    fontWeight: '700',
    letterSpacing: 1,
  },
  btnTextSoft: {
    color: Colors.textMuted,
    fontWeight: '600',
  },
});
