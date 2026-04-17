/** Shared design tokens — matches bloom.html palette */

export const Colors = {
  // Background / surface
  bg: '#1a1a2e',
  surface: '#16213e',
  surfaceAlt: '#0f3460',

  // Accent / brand
  primary: '#4ecca3',       // teal — valid tile, petals
  primaryDark: '#2a9d8f',
  yellow: '#e2b714',        // selected / active tile
  yellowDark: '#c9a20e',

  // Text
  textPrimary: '#eaeaea',
  textMuted: '#a0a0b0',

  // States
  error: '#e74c3c',
  errorDark: '#c0392b',
  success: '#4ecca3',

  // Tiles
  tileEmpty: '#2a2a4a',
  tileFilled: '#0f3460',
  tileValid: '#4ecca3',
  tileBorder: '#4a4a6a',
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
