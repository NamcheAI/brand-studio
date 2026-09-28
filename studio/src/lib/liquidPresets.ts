// Liquid look-mode presets for the 3D preview and exported material.

export type LookMode = 'material' | 'liquid';

export type CausticDance = 'calm' | 'lively' | 'wild';

export type LiquidParams = {
  /** 0–1 clearness / light pass-through (reduces body fill coverage). */
  transmission: number;
  /** 0–1 matte ↔ glossy surface. */
  roughness: number;
  /** 0–1 chromatic rim strength. */
  rimStrength: number;
  /** 0–1 post-processing glow / bloom. */
  bloom: number;
  /** Legacy 2D setting retained so older saved documents still load cleanly. */
  edgeSoftness: number;
  /** Index of refraction ~1.2–1.6. */
  ior: number;
  /** 0–1 spectral dispersion. */
  dispersion: number;
  /** Body tint hex (color only — does not set opacity). */
  tint: string;
  /** 0–1 residual body density (independent of tint; lowered further by transmission). */
  opacity: number;
  /** 0–1 app-only caustics intensity / orbit amplitude (3D). */
  causticStrength: number;
  /** App-only caustic light choreography preset (3D). */
  causticDance: CausticDance;
  /** 0–1 surface wave / distortion modulation (3D). */
  waveStrength: number;
};

/** Blend hex toward light so tint is a wash, not a solid gel fill. */
export function mixHexToward(hex: string, toward: string, t: number): string {
  const parse = (h: string) => {
    const m = /^#([0-9a-fA-F]{6})$/.exec(h);
    if (!m) return [247, 248, 250] as const;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff] as const;
  };
  const a = parse(hex);
  const b = parse(toward);
  const u = clamp01(t);
  const toHex = (c: number) => Math.round(c).toString(16).padStart(2, '0');
  return `#${toHex(a[0] + (b[0] - a[0]) * u)}${toHex(a[1] + (b[1] - a[1]) * u)}${toHex(a[2] + (b[2] - a[2]) * u)}`;
}

/** 3D surface color: keep nearly white so attenuation tint carries the hue. */
export function liquidSurfaceColor(tint: string): string {
  return mixHexToward(tint, '#ffffff', 0.88);
}

/** Volume attenuation distance from opacity + transmission (shorter = stronger tint). */
export function liquidAttenuationDistance(
  params: Pick<LiquidParams, 'opacity' | 'transmission'>,
): number {
  const density = clamp01(params.opacity * (1 - 0.65 * params.transmission));
  // Longer distances = subtler volume tint (less “colored glass”).
  return 0.55 + (1 - density) * 2.2;
}

export type LiquidPreset = {
  id: string;
  label: string;
  hint: string;
  params: LiquidParams;
};

export const LIQUID_IOR_MIN = 1.2;
export const LIQUID_IOR_MAX = 1.6;

export const DEFAULT_LIQUID_PRESET = 'liquid';

export const LIQUID_PRESETS: LiquidPreset[] = [
  {
    id: 'clear',
    label: 'Transparent',
    hint: 'Clear liquid — high transmission, soft reflections, weak rim.',
    params: {
      transmission: 0.97,
      roughness: 0.04,
      rimStrength: 0.22,
      bloom: 0.18,
      edgeSoftness: 0.1,
      ior: 1.33,
      dispersion: 0.1,
      tint: '#f7f9fc',
      opacity: 0.22,
      causticStrength: 0.45,
      causticDance: 'calm',
      waveStrength: 0.35,
    },
  },
  {
    id: 'frosted',
    label: 'Frosted',
    hint: 'Milky frost — soft matte body, barely tinted, muted rim.',
    params: {
      transmission: 0.42,
      roughness: 0.62,
      rimStrength: 0.18,
      bloom: 0.22,
      edgeSoftness: 0.4,
      ior: 1.38,
      dispersion: 0.06,
      tint: '#eef1f5',
      opacity: 0.72,
      causticStrength: 0.15,
      causticDance: 'calm',
      waveStrength: 0.12,
    },
  },
  {
    id: 'liquid',
    label: 'Liquid',
    hint: 'Video goo — body near bg, hot prism rim, lively caustics.',
    params: {
      transmission: 0.9,
      roughness: 0.1,
      rimStrength: 1,
      bloom: 0.68,
      edgeSoftness: 0.16,
      ior: 1.36,
      dispersion: 0.58,
      tint: '#d6dbe4',
      opacity: 0.42,
      causticStrength: 0.88,
      causticDance: 'lively',
      waveStrength: 0.55,
    },
  },
  {
    id: 'blur',
    label: 'Blur',
    hint: 'Soft glowing blob — soft edges and strong outer glow.',
    params: {
      transmission: 0.75,
      roughness: 0.5,
      rimStrength: 0.28,
      bloom: 0.88,
      edgeSoftness: 0.72,
      ior: 1.34,
      dispersion: 0.12,
      tint: '#e8ecf2',
      opacity: 0.36,
      causticStrength: 0.35,
      causticDance: 'calm',
      waveStrength: 0.4,
    },
  },
  {
    id: 'prism',
    label: 'Prism',
    hint: 'Almost clear body, max chromatic halo + caustics.',
    params: {
      transmission: 0.95,
      roughness: 0.05,
      rimStrength: 1,
      bloom: 0.72,
      edgeSoftness: 0.12,
      ior: 1.38,
      dispersion: 0.78,
      tint: '#e8ecf2',
      opacity: 0.28,
      causticStrength: 0.95,
      causticDance: 'wild',
      waveStrength: 0.7,
    },
  },
];

export function getLiquidPreset(id: string): LiquidPreset {
  return (
    LIQUID_PRESETS.find((p) => p.id === id) ??
    LIQUID_PRESETS.find((p) => p.id === DEFAULT_LIQUID_PRESET)!
  );
}

export function defaultLiquidParams(): LiquidParams {
  return { ...getLiquidPreset(DEFAULT_LIQUID_PRESET).params };
}

export function cloneLiquidParams(params: LiquidParams): LiquidParams {
  return { ...params };
}

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function clampLiquidIor(v: number): number {
  return Math.min(LIQUID_IOR_MAX, Math.max(LIQUID_IOR_MIN, v));
}

export function normalizeCausticDance(v: unknown, causticStrength: number): CausticDance {
  if (v === 'calm' || v === 'lively' || v === 'wild') return v;
  if (causticStrength >= 0.75) return 'wild';
  if (causticStrength >= 0.4) return 'lively';
  return 'calm';
}

export function normalizeLiquidParams(
  input: Partial<LiquidParams> | undefined,
  fallback: LiquidParams,
): LiquidParams {
  const tint =
    typeof input?.tint === 'string' && /^#[0-9a-fA-F]{6}$/.test(input.tint)
      ? input.tint
      : fallback.tint;
  const roughness =
    typeof input?.roughness === 'number' ? clamp01(input.roughness) : fallback.roughness;
  const transmission =
    typeof input?.transmission === 'number' ? clamp01(input.transmission) : fallback.transmission;
  const bloom = typeof input?.bloom === 'number' ? clamp01(input.bloom) : fallback.bloom;
  // Old saves lacked edgeSoftness; derive a mild default from roughness.
  const edgeSoftness =
    typeof input?.edgeSoftness === 'number'
      ? clamp01(input.edgeSoftness)
      : typeof input?.roughness === 'number'
        ? clamp01(roughness * 0.5)
        : fallback.edgeSoftness;
  // Old saves lacked causticStrength; derive from transmission × bloom.
  const causticStrength =
    typeof input?.causticStrength === 'number'
      ? clamp01(input.causticStrength)
      : clamp01(transmission * bloom * 1.15);
  const waveStrength =
    typeof input?.waveStrength === 'number'
      ? clamp01(input.waveStrength)
      : typeof input?.dispersion === 'number'
        ? clamp01((input.dispersion ?? 0) * 0.7 + causticStrength * 0.25)
        : fallback.waveStrength;
  return {
    transmission,
    roughness,
    rimStrength:
      typeof input?.rimStrength === 'number' ? clamp01(input.rimStrength) : fallback.rimStrength,
    bloom,
    edgeSoftness,
    ior: typeof input?.ior === 'number' ? clampLiquidIor(input.ior) : fallback.ior,
    dispersion:
      typeof input?.dispersion === 'number' ? clamp01(input.dispersion) : fallback.dispersion,
    tint,
    opacity: typeof input?.opacity === 'number' ? clamp01(input.opacity) : fallback.opacity,
    causticStrength,
    causticDance: normalizeCausticDance(input?.causticDance, causticStrength),
    waveStrength,
  };
}

export function normalizeLookMode(v: unknown): LookMode {
  return v === 'liquid' ? 'liquid' : 'material';
}
