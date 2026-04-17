/** Shared design tokens — matches bloom.html botanical palette */

export const Colors = {
  // Background / surface
  bg: '#faf8f2',          // cream
  surface: '#e8f5d0',     // pale green
  surfaceAlt: '#d0e8b0',

  // Brand greens
  darkGreen: '#2d5016',
  midGreen: '#4a7c28',
  lightGreen: '#8fbc45',
  paleGreen: '#e8f5d0',

  // Accent
  pink: '#e8a0b0',
  pinkDark: '#c97a90',
  pinkLight: '#f5d0db',
  gold: '#d4a843',
  goldLight: '#f0c96a',
  goldPale: '#fdf3d8',

  // Text
  textPrimary: '#2d5016',
  textMuted: '#7a9a55',

  // Tiles
  tileBg: '#ffffff',
  tileBorder: '#c8dba0',
  tileActive: '#fdf3d8',   // gold-pale when typing
  tileActiveBorder: '#d4a843',
  tileBloomed: '#e8a0b0',  // pink when completed
  tileBloomedBorder: '#c97a90',
  tileSeed: '#2d5016',     // dark green for seed row
  tileSeedBorder: '#2d5016',

  // States
  error: '#c0392b',

  // Keep dark aliases for modal/overlay
  overlay: 'rgba(0,0,0,0.4)',
};

export const Fonts = {
  mono: 'monospace',
  size: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 20,
    xxl: 28,
    title: 36,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const Radius = {
  sm: 4,
  md: 8,
  lg: 12,
  full: 999,
};
