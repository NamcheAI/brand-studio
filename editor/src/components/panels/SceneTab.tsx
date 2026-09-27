import { Textarea } from '@/components/ui/textarea';
import { GroupLabel, Hint, SelectField } from '../toolbar/fields';
import { PresetGrid } from '../toolbar/segmented';
import { AI_RENDER_BACKGROUNDS, type AIRenderParams } from '../../../lib/ai-render-contract';
import { LIQUID_BACKDROPS } from '../../lib/liquidBackdrops';
import type { SceneProps } from './types';

/**
 * Object step 3 — how the object is presented. One description of the scene:
 * the AI render reads canvas, background and lighting from here, and the
 * liquid look's environment lives here too. Parametric live-view lighting is
 * deliberately out of scope (#49).
 */
export function SceneTab({
  scene,
  onSceneChange,
  lookMode,
  liquidBackdrop,
  onLiquidBackdropChange,
}: SceneProps) {
  return (
    <>
      <Hint>Canvas, background and lighting feed the AI render.</Hint>
      <SelectField
        label="Canvas"
        value={scene.canvas}
        onValueChange={(value) => onSceneChange({ canvas: value as AIRenderParams['background'] })}
        options={AI_RENDER_BACKGROUNDS.map((background) => ({
          value: background,
          label: background,
        }))}
      />
      <div className="flex flex-col gap-1.5">
        <GroupLabel>Background / ground</GroupLabel>
        <Textarea
          aria-label="Background"
          rows={2}
          className="min-h-14 font-mono text-xs"
          disabled={scene.canvas === 'transparent'}
          value={scene.background}
          onChange={(event) => onSceneChange({ background: event.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <GroupLabel>Lighting</GroupLabel>
        <Textarea
          aria-label="Lighting"
          rows={2}
          className="min-h-14 font-mono text-xs"
          value={scene.lighting}
          onChange={(event) => onSceneChange({ lighting: event.target.value })}
        />
      </div>
      {lookMode === 'liquid' && (
        <div className="flex flex-col gap-1.5">
          <GroupLabel>Environment</GroupLabel>
          <PresetGrid
            label="Environment"
            value={liquidBackdrop}
            onValueChange={onLiquidBackdropChange}
            options={LIQUID_BACKDROPS.map((backdrop) => ({
              value: backdrop.id,
              label: backdrop.label,
              hint: backdrop.hint,
            }))}
          />
          <Hint>{LIQUID_BACKDROPS.find((b) => b.id === liquidBackdrop)?.hint ?? ''}</Hint>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <GroupLabel>Viewpoint</GroupLabel>
        <Hint>Drag to orbit, scroll to zoom — the AI render uses exactly this camera view.</Hint>
      </div>
    </>
  );
}
