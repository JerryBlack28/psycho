import { Platform, useColorScheme } from 'react-native';

export const palette = {
  ink: '#15221F',
  forest: '#214A40',
  moss: '#6F8B75',
  sage: '#A9B9A2',
  cream: '#F4EFE5',
  paper: '#FBF8F1',
  sand: '#DED4C2',
  rust: '#A85D43',
  gold: '#C09A58',
  mist: '#E8EFEA',
  white: '#FFFFFF',
  danger: '#A4473C',
};

export const themes = {
  light: {
    background: palette.cream,
    surface: palette.paper,
    elevated: palette.white,
    text: palette.ink,
    secondaryText: '#60706B',
    border: '#D8D2C7',
    accent: palette.forest,
    softAccent: palette.mist,
    tab: '#F8F4EC',
  },
  dark: {
    background: '#101A18',
    surface: '#172521',
    elevated: '#21312D',
    text: '#F4EFE5',
    secondaryText: '#AABAB4',
    border: '#34443F',
    accent: '#9BB9A7',
    softAccent: '#263B34',
    tab: '#17231F',
  },
};

export type AppTheme = (typeof themes)['light'];

export function useAppTheme(): AppTheme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? themes.dark : themes.light;
}

export const radius = {
  small: 12,
  medium: 20,
  large: 28,
  pill: 999,
};

export const spacing = {
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 20,
  six: 24,
  eight: 32,
  ten: 40,
};

export const shadow = Platform.select({
  web: { boxShadow: '0 18px 54px rgba(24, 39, 34, 0.10)' },
  default: {
    shadowColor: '#10211C',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 4,
  },
});
