/**
 * Design tokens.
 *
 * Constraints from §8: large touch targets (users are stressed and rushing),
 * full parity between light and dark, sizes always in KB. The palette is warm
 * and paper-like rather than another blue utility app — the thing being handled
 * is a document, and the accent is reserved for the one action that matters on
 * each screen.
 */
export interface Theme {
  mode: 'light' | 'dark';
  background: string;
  /** Behind the hero: a deeper tone so the page is not one flat field. */
  backgroundDeep: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentText: string;
  accentSoft: string;
  /** Hero and primary-button gradient, dark end last. */
  accentGradient: readonly [string, string];
  /** A cooler second colour, for data that is not a call to action. */
  info: string;
  infoSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  overlay: string;
}

export const lightTheme: Theme = {
  mode: 'light',
  background: '#F4EFE7',
  backgroundDeep: '#EBE3D7',
  surface: '#FFFFFF',
  surfaceRaised: '#FBF7F1',
  border: '#E0D6C7',
  borderStrong: '#C9BBA7',
  text: '#17120F',
  textMuted: '#655A4E',
  textFaint: '#9A8C7C',
  accent: '#A32E1C',
  accentText: '#FFFFFF',
  accentSoft: '#F8E6E1',
  accentGradient: ['#B8391F', '#7C1F12'] as const,
  info: '#1F5C6B',
  infoSoft: '#E1EFF2',
  success: '#1F6B3A',
  successSoft: '#E2F0E6',
  warning: '#8A5A00',
  warningSoft: '#FBEEDA',
  danger: '#A3231B',
  dangerSoft: '#FAE4E2',
  overlay: 'rgba(24, 20, 17, 0.45)',
};

export const darkTheme: Theme = {
  mode: 'dark',
  background: '#141210',
  backgroundDeep: '#0D0B0A',
  surface: '#1E1B19',
  surfaceRaised: '#282422',
  border: '#37312C',
  borderStrong: '#50473F',
  text: '#F7F3ED',
  textMuted: '#B6AB9E',
  textFaint: '#857A6E',
  accent: '#F0744F',
  accentText: '#1A0C07',
  accentSoft: '#3A211A',
  accentGradient: ['#C9452A', '#7A2214'] as const,
  info: '#6FC3D6',
  infoSoft: '#12292F',
  success: '#6FD08C',
  successSoft: '#17301F',
  warning: '#E8B15C',
  warningSoft: '#33260F',
  danger: '#F08A7E',
  dangerSoft: '#3A1D1A',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

/**
 * Elevation. Android draws shadows from `elevation`, iOS from the shadow*
 * props, and react-native-web from boxShadow — all three are needed for a card
 * to look the same everywhere.
 */
export function elevation(level: 0 | 1 | 2, theme: Theme) {
  if (level === 0) return {};
  const opacity = theme.mode === 'dark' ? 0.4 : 0.09;
  const height = level === 1 ? 1 : 4;
  const radiusPx = level === 1 ? 3 : 12;
  return {
    elevation: level === 1 ? 2 : 6,
    shadowColor: '#000000',
    shadowOpacity: opacity,
    shadowRadius: radiusPx,
    shadowOffset: { width: 0, height },
  } as const;
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

/** Minimum tap area, per §8's "large touch targets". */
export const TOUCH_TARGET = 52;

/**
 * Maximum content width. On a phone this never binds; in a desktop browser it
 * stops the layout stretching into a thin band of text across 2000px, which is
 * what made the web build look unfinished.
 */
export const CONTENT_MAX_WIDTH = 520;

export const typography = {
  display: { fontSize: 38, fontWeight: '800' as const, letterSpacing: -1 },
  title: { fontSize: 23, fontWeight: '700' as const, letterSpacing: -0.4 },
  heading: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  label: { fontSize: 12, fontWeight: '700' as const, letterSpacing: 0.8 },
  caption: { fontSize: 12, fontWeight: '400' as const },
  /** For the big before/after readout on Preview. */
  readout: { fontSize: 34, fontWeight: '800' as const, letterSpacing: -1 },
} as const;
