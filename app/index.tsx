/**
 * Home screen — game suite hub
 */

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Colors, Fonts, Spacing, Radius } from '../constants/theme';

const GAMES = [
  {
    id: 'bloom',
    title: 'BLOOM',
    subtitle: 'Grow a word\nfrom 3 to 7 letters',
    emoji: '🌸',
    route: '/bloom',
    available: true,
  },
];

export default function HomeScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false, title: '' }} />
      <Text style={styles.title}>🌱 Game Suite</Text>
      <Text style={styles.sub}>Daily word puzzles</Text>
      <View style={styles.grid}>
        {GAMES.map(g => (
          <TouchableOpacity
            key={g.id}
            style={[styles.card, !g.available && styles.cardDim]}
            onPress={() => g.available && router.push(g.route as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.emoji}>{g.emoji}</Text>
            <Text style={styles.cardTitle}>{g.title}</Text>
            <Text style={styles.cardSub}>{g.subtitle}</Text>
            {!g.available && <Text style={styles.soon}>Coming soon</Text>}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
    alignItems: 'center',
  },
  title: {
    color: Colors.darkGreen,
    fontSize: Fonts.size.xxl,
    fontWeight: '700',
    letterSpacing: 2,
  },
  sub: {
    color: Colors.textMuted,
    fontSize: Fonts.size.sm,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
    letterSpacing: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    width: 160,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.tileBorder,
  },
  cardDim: { opacity: 0.5 },
  emoji: { fontSize: 40, marginBottom: Spacing.sm },
  cardTitle: {
    color: Colors.darkGreen,
    fontSize: Fonts.size.lg,
    fontWeight: '700',
    letterSpacing: 3,
  },
  cardSub: {
    color: Colors.textMuted,
    fontSize: Fonts.size.xs,
    textAlign: 'center',
    marginTop: Spacing.xs,
    lineHeight: 16,
  },
  soon: {
    color: Colors.gold,
    fontSize: Fonts.size.xs,
    marginTop: Spacing.sm,
    fontWeight: '600',
  },
});
