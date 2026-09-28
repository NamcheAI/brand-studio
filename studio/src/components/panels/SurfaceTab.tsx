import { Fragment } from 'react';

import { Expert } from '../toolbar/disclosure';
import { ColorField, Hint, SwitchField } from '../toolbar/fields';
import { PresetGrid, Segmented } from '../toolbar/segmented';
import { SliderField } from '../toolbar/slider-field';
import { TexturePicker } from '../toolbar/texture-picker';
import {
  SURFACE_SAMPLER_COUNT_MAX,
  SURFACE_SAMPLER_COUNT_MIN,
  SURFACE_SAMPLER_POINT_SIZE_MAX,
  SURFACE_SAMPLER_POINT_SIZE_MIN,
  SURFACE_SAMPLER_SPHERE_SIZE_MAX,
  SURFACE_SAMPLER_SPHERE_SIZE_MIN,
  TEXTURE_SCALE_MAX,
  TEXTURE_SCALE_MIN,
} from '../../lib/model';
import { MATERIAL_PRESETS } from '../../lib/materialPresets';
import {
  LIQUID_IOR_MAX,
  LIQUID_IOR_MIN,
  LIQUID_PRESETS,
  type CausticDance,
} from '../../lib/liquidPresets';
import type { LiquidParams } from '../../lib/model';
import type { SurfaceProps } from './types';

/** Unit-range liquid sliders, in panel order, with the hint that follows each. */
const LIQUID_SLIDERS: Array<{
  key: 'transmission' | 'bloom' | 'causticStrength';
  label: string;
  hint?: string;
}> = [
  {
    key: 'transmission',
    label: 'Transmission',
    hint: 'How much environment light passes through the body.',
  },
  { key: 'bloom', label: 'Glow' },
  { key: 'causticStrength', label: 'Caustics', hint: 'Light dance and caustic intensity.' },
];

function LiquidFineTune({ liquid }: { liquid: SurfaceProps['liquid'] }) {
  const { params, onParamsScrub, onParamsCommit } = liquid;
  const unit = (key: keyof LiquidParams, label: string) => (
    <SliderField
      label={label}
      value={params[key] as number}
      min={0}
      max={1}
      step={0.01}
      onChange={(v) => onParamsScrub({ [key]: v })}
      onCommit={onParamsCommit}
    />
  );
  return (
    <Expert label="Fine-tune liquid">
      {LIQUID_SLIDERS.map(({ key, label, hint }) => (
        <Fragment key={key}>
          {unit(key, label)}
          {hint && <Hint>{hint}</Hint>}
        </Fragment>
      ))}
      <Segmented
        label="Caustic dance"
        value={params.causticDance}
        onValueChange={(id: CausticDance) => {
          onParamsScrub({ causticDance: id });
          onParamsCommit();
        }}
        options={[
          { value: 'calm', label: 'Calm' },
          { value: 'lively', label: 'Lively' },
          { value: 'wild', label: 'Wild' },
        ]}
      />
      {unit('waveStrength', 'Waves')}
      <Hint>Surface distortion and wobble.</Hint>
      {unit('rimStrength', 'Rim')}
      {unit('roughness', 'Roughness')}
      <SliderField
        label="IOR"
        value={params.ior}
        min={LIQUID_IOR_MIN}
        max={LIQUID_IOR_MAX}
        step={0.01}
        onChange={(v) => onParamsScrub({ ior: v })}
        onCommit={onParamsCommit}
      />
      {unit('dispersion', 'Dispersion')}
      {unit('opacity', 'Opacity')}
      <Hint>Residual body density, independent of tint.</Hint>
      <ColorField
        label="Tint"
        value={params.tint}
        onChange={(v) => onParamsScrub({ tint: v })}
        onCommit={onParamsCommit}
      />
      <Hint>A light color wash rather than an opaque gel.</Hint>
    </Expert>
  );
}

function SurfaceSampling({ sampler }: { sampler: SurfaceProps['sampler'] }) {
  const { values, set, scrub, commit } = sampler;
  const enabled = values.surfaceSamplerEnabled;
  return (
    <Expert label="Surface sampling">
      <SwitchField
        label="Enable sampler"
        checked={enabled}
        onCheckedChange={(v) => set('surfaceSamplerEnabled', v)}
      />
      <Segmented
        label="Sampler mode"
        value={values.surfaceSamplerMode}
        disabled={!enabled}
        onValueChange={(v) => set('surfaceSamplerMode', v)}
        options={[
          { value: 'points', label: 'Points' },
          { value: 'spheres', label: 'Spheres' },
          { value: 'both', label: 'Both' },
        ]}
      />
      <SliderField
        label="Count"
        value={values.surfaceSamplerCount}
        min={SURFACE_SAMPLER_COUNT_MIN}
        max={SURFACE_SAMPLER_COUNT_MAX}
        step={100}
        disabled={!enabled}
        onChange={(v) => scrub('surfaceSamplerCount', v)}
        onCommit={commit}
      />
      <SliderField
        label="Point size"
        value={values.surfaceSamplerPointSize}
        min={SURFACE_SAMPLER_POINT_SIZE_MIN}
        max={SURFACE_SAMPLER_POINT_SIZE_MAX}
        step={0.001}
        disabled={!enabled || values.surfaceSamplerMode === 'spheres'}
        onChange={(v) => scrub('surfaceSamplerPointSize', v)}
        onCommit={commit}
      />
      <SliderField
        label="Sphere size"
        value={values.surfaceSamplerSphereSize}
        min={SURFACE_SAMPLER_SPHERE_SIZE_MIN}
        max={SURFACE_SAMPLER_SPHERE_SIZE_MAX}
        step={0.001}
        disabled={!enabled || values.surfaceSamplerMode === 'points'}
        onChange={(v) => scrub('surfaceSamplerSphereSize', v)}
        onCommit={commit}
      />
      <SwitchField
        label="Show mesh"
        checked={values.surfaceSamplerShowMesh}
        disabled={!enabled}
        onCheckedChange={(v) => set('surfaceSamplerShowMesh', v)}
      />
      <SwitchField
        label="Animate reveal"
        checked={values.surfaceSamplerAnimate}
        disabled={!enabled}
        onCheckedChange={(v) => set('surfaceSamplerAnimate', v)}
      />
      <Hint>
        {enabled
          ? 'Pink points / spheres bloom onto the whole isosurface.'
          : 'Enable to scatter pink samples on the 3D mark.'}
      </Hint>
    </Expert>
  );
}

/** Object step 2 — what the object is made of (3D only). */
export function SurfaceTab({ lookMode, onLookModeChange, material, liquid, sampler }: SurfaceProps) {
  return (
    <>
      <Segmented
        label="Look mode"
        value={lookMode}
        onValueChange={onLookModeChange}
        options={[
          { value: 'material', label: 'Organic' },
          { value: 'liquid', label: 'Liquid' },
        ]}
      />

      {lookMode === 'material' && (
        <>
          <PresetGrid
            label="Material presets"
            value={material.preset}
            onValueChange={material.onPresetChange}
            options={MATERIAL_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))}
          />
          <Hint>{MATERIAL_PRESETS.find((p) => p.id === material.preset)?.hint ?? ''}</Hint>
          <TexturePicker value={material.textureSlug} onValueChange={material.onTextureSlugChange} />
          {material.textureSlug !== null && (
            <>
              <SliderField
                label="Texture scale"
                value={material.textureScale}
                min={TEXTURE_SCALE_MIN}
                max={TEXTURE_SCALE_MAX}
                step={0.1}
                onChange={material.onTextureScaleChange}
              />
              <SliderField
                label="Texture amount"
                value={material.textureAmount}
                min={0}
                max={1}
                step={0.05}
                onChange={material.onTextureAmountChange}
              />
              <Hint>Curated imagery, projected triplanar — pairs well with clay and rock.</Hint>
            </>
          )}
        </>
      )}

      {lookMode === 'liquid' && (
        <>
          <PresetGrid
            label="Liquid presets"
            value={liquid.preset}
            onValueChange={liquid.onPresetChange}
            options={LIQUID_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))}
          />
          <Hint>{LIQUID_PRESETS.find((p) => p.id === liquid.preset)?.hint ?? ''}</Hint>
          <LiquidFineTune liquid={liquid} />
        </>
      )}

      <SurfaceSampling sampler={sampler} />
    </>
  );
}
