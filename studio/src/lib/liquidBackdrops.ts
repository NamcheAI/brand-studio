// Switchable test backdrops for Liquid look mode (2D grid + 3D floor/scene).

export type LiquidBackdropTheme = {
  pink: string;
  blue: string;
  ink: string;
  bg: string;
};

export type LiquidBackdropPattern = 'cells' | 'checker' | 'stripes';

export type LiquidBackdrop = {
  id: string;
  label: string;
  hint: string;
  /** 2D grid / page colors while Liquid is active. */
  theme: LiquidBackdropTheme;
  pattern: LiquidBackdropPattern;
  /** 3D clear-color / floor base. */
  sceneBg: string;
};

export const DEFAULT_LIQUID_BACKDROP = 'soft';

export const LIQUID_BACKDROPS: LiquidBackdrop[] = [
  {
    id: 'soft',
    label: 'Soft',
    hint: 'Video-like gray — body blends with bg, rim stays readable.',
    theme: {
      bg: '#e6e9ef',
      pink: '#d4d9e2',
      blue: '#c9d0dc',
      ink: '#5c6578',
    },
    pattern: 'cells',
    sceneBg: '#e6e9ef',
  },
  {
    id: 'studio',
    label: 'Studio',
    hint: 'Neutral light studio — good for clear / frosted transmission.',
    theme: {
      bg: '#f2f3f5',
      pink: '#e4e6ea',
      blue: '#d9dce2',
      ink: '#3a3f4a',
    },
    pattern: 'cells',
    sceneBg: '#f2f3f5',
  },
  {
    id: 'checker',
    label: 'Checker',
    hint: 'High-contrast checker — best for refraction / distort tests.',
    theme: {
      bg: '#ececec',
      pink: '#1f1f1f',
      blue: '#f7f7f7',
      ink: '#111111',
    },
    pattern: 'checker',
    sceneBg: '#ececec',
  },
  {
    id: 'stripes',
    label: 'Stripes',
    hint: 'Vertical chroma stripes — shows bend + chromatic fringe.',
    theme: {
      bg: '#f5f5f8',
      pink: '#ff5a8a',
      blue: '#3ad0c8',
      ink: '#1a1a22',
    },
    pattern: 'stripes',
    sceneBg: '#f5f5f8',
  },
  {
    id: 'dark',
    label: 'Dark',
    hint: 'Dark stage — bloom, rim and caustics pop.',
    theme: {
      bg: '#16181e',
      pink: '#2a2e38',
      blue: '#22262f',
      ink: '#9aa3b5',
    },
    pattern: 'cells',
    sceneBg: '#16181e',
  },
  {
    id: 'warm',
    label: 'Warm',
    hint: 'Warm paper — tint / frost read against cream.',
    theme: {
      bg: '#f3ebe2',
      pink: '#e8d5c4',
      blue: '#dcc9b4',
      ink: '#4a3a2e',
    },
    pattern: 'cells',
    sceneBg: '#f3ebe2',
  },
];

export function getLiquidBackdrop(id: string): LiquidBackdrop {
  return (
    LIQUID_BACKDROPS.find((b) => b.id === id) ??
    LIQUID_BACKDROPS.find((b) => b.id === DEFAULT_LIQUID_BACKDROP)!
  );
}

export function normalizeLiquidBackdropId(v: unknown): string {
  return typeof v === 'string' ? getLiquidBackdrop(v).id : DEFAULT_LIQUID_BACKDROP;
}
