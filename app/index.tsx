/**
 * Home screen — game suite hub
 * Currently only BLOOM; add more games here as cards.
 */

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Fonts, Spacing, Radius } from '../constants/theme';

interface GameCard {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  route: string;
  available: boolean;
}

const GAMES: GameCard[] = [
  {
    id: 'bloom',
    title: 'BLOOM',
    subtitle: 'Grow a word from 3 to 7 letters',
    emoji: '🌸',
    route: '/bloom',
    available: true,
  },
];

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Game Suite</Text>
      <Text style={styles.subtitle}>Daily word puzzles</Text>

      <View style={styles.grid}>
        {GAMES.map(game => (
          <TouchableOpacity
            key={game.id}
            style={[styles.card, !game.available && styles.cardDisabled]}
            onPress={() => game.available && router.push(game.route as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.cardEmoji}>{game.emoji}</Text>
            <Text style={styles.cardTitle}>{game.title}</Text>
            <Text style={styles.cardSubtitle}>{game.subtitle}</Text>
            {!game.available && <Text style={styles.comingSoon}>Coming soon</Text>}
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
  },
  title: {
    color: Colors.primary,
    fontSize: Fonts.size.title,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 4,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: Fonts.size.md,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    marginTop: Spacing.xs,
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
    borderWidth: 1,
    borderColor: Colors.surfaceAlt,
  },
  cardDisabled: {
    opacity: 0.5,
  },
  cardEmoji: {
    fontSize: 40,
    marginBottom: Spacing.sm,
  },
  cardTitle: {
    color: Colors.primary,
    fontSize: Fonts.size.lg,
    fontWeight: '700',
    letterSpacing: 2,
  },
  cardSubtitle: {
    color: Colors.textMuted,
    fontSize: Fonts.size.xs,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  comingSoon: {
    color: Colors.yellow,
    fontSize: Fonts.size.xs,
    marginTop: Spacing.sm,
  },
});
