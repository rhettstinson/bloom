import { Stack } from 'expo-router';
import { Colors } from '../../constants/theme';

export default function BloomLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.bg },
        headerTintColor: Colors.darkGreen,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: Colors.bg },
      }}
    />
  );
}
