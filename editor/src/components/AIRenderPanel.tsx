import { Loader2Icon, SparklesIcon } from 'lucide-react';

import { PromptAssistant } from './PromptAssistant';
import { Disclosure, Expert } from './toolbar/disclosure';
import { GroupLabel, Hint, SelectField, SwitchField } from './toolbar/fields';
import { SliderField } from './toolbar/slider-field';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  buildAIRenderPrompt,
  AI_RENDER_QUALITIES,
  AI_RENDER_SIZES,
  DEFAULT_AI_METAMORPH_PARAMS,
  type AIMetamorphParams,
  type AIRenderParams,
} from '../../lib/ai-render-contract';
import type { RenderProps } from './panels/types';

// The Studio's 3D preview is square, so the square sizes are the useful
// high-res targets; 2880 and 3840 are gpt-image-2's ceiling.
const SIZE_LABELS: Record<string, string> = {
  '2048x2048': '2048 × 2048',
  '2880x2880': '2880 × 2880 (max)',
  '3840x2160': '3840 × 2160 (4K)',
  '2160x3840': '2160 × 3840 (4K)',
};

const METAMORPH_SLIDERS: Array<{ key: keyof AIMetamorphParams; label: string }> = [
  { key: 'deformAmount', label: 'Deform amount' },
  { key: 'nubDensity', label: 'Nub density' },
  { key: 'porosityAmount', label: 'Porosity' },
  { key: 'poreSize', label: 'Pore size' },
  { key: 'heightVariation', label: 'Height variation' },
  // Optics: what separates wet stone from chalk, or a few big dots from a
  // fine speckle -- structurally identical materials that must not render alike.
  { key: 'glossiness', label: 'Glossiness' },
  { key: 'translucency', label: 'Translucency' },
  { key: 'patternScale', label: 'Pattern scale' },
];

/**
 * Object step 4 — the AI material render. All state lives in the
 * `useAIRenders` session owned by App, so results survive tab switches and
 * the stage can show them large; this component only edits it.
 */
export default function AIRenderPanel({
  session,
  canRender,
  scene,
  textureSlug,
  referenceName,
  onAttachReference,
  onClearReference,
  onSavePrompt,
  onApplyPrompt,
}: RenderProps) {
  const { params, patch, patchMetamorph, status, error, entries, selected } = session;
  const rendering = status === 'rendering';
  const metamorphOn = params.metamorph != null && textureSlug !== null;

  return (
    <>
      <Hint>
        The current shape and camera view are locked in; an optional material image supplies any
        surface — nacre, coral, moss, grass, fur or something entirely new.
      </Hint>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-normal text-muted-foreground">Material direction</Label>
        <Textarea
          rows={4}
          className="min-h-20 font-mono text-xs"
          value={params.materialDescription}
          onChange={(event) => patch('materialDescription', event.target.value)}
        />
      </div>

      {metamorphOn ? (
        <Hint>Material reference: uses the selected surface texture ({textureSlug}).</Hint>
      ) : (
        <div className="flex flex-col gap-2">
          <Hint>
            {referenceName ? `Material reference: ${referenceName}` : 'No material image attached.'}
          </Hint>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Button variant="outline" size="sm" onClick={onAttachReference}>
              {referenceName ? 'Replace reference' : 'Attach material image'}
            </Button>
            <Button variant="outline" size="sm" disabled={!referenceName} onClick={onClearReference}>
              Clear
            </Button>
          </div>
        </div>
      )}

      <Button
        size="lg"
        className="w-full"
        disabled={!canRender || rendering}
        onClick={() => void session.render()}
      >
        {rendering ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
        {rendering ? 'Rendering…' : 'Render with AI'}
      </Button>
      {!canRender && <Hint>Open the 3D view and wait for the shape.</Hint>}
      {error && (
        <p className="text-xs leading-snug text-destructive" role="alert">
          {error}
        </p>
      )}

      {entries.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <GroupLabel>This session’s renders</GroupLabel>
          <div className="grid grid-cols-4 gap-1.5">
            {entries.map((entry, index) => (
              <button
                key={entry.id}
                type="button"
                aria-pressed={selected?.id === entry.id && session.showRender}
                aria-label={`Show render ${entries.length - index} on the stage`}
                onClick={() => session.select(entry.id)}
                className={cn(
                  'aspect-square overflow-hidden rounded-md border bg-muted transition-colors',
                  selected?.id === entry.id
                    ? 'border-primary ring-2 ring-primary'
                    : 'hover:border-foreground/40',
                )}
              >
                <img src={entry.result.image} alt="" className="size-full object-cover" />
              </button>
            ))}
          </div>
          <Hint>Click a render to show it on the stage, then make it bigger from there.</Hint>
        </div>
      )}

      <Disclosure label="Refine prompt with AI">
        <PromptAssistant
          disabled={!canRender || rendering}
          onSnapshot={() => onSavePrompt(params)}
          onApply={(study) => {
            if (study.object) {
              session.setParams(study.object.params);
              onApplyPrompt(study);
            }
          }}
        />
      </Disclosure>

      <Disclosure label="Metamorph with surface texture">
        {textureSlug ? (
          <>
            <SwitchField
              label="Metamorph with surface texture"
              checked={params.metamorph != null}
              onCheckedChange={(on) => patch('metamorph', on ? DEFAULT_AI_METAMORPH_PARAMS : null)}
            />
            {params.metamorph && (
              <>
                <Hint>
                  The material image is the surface texture selected in Surface — nothing to
                  upload. The metamorph template lets that material reshape the form:
                  deformation, budding nubs, porosity.
                </Hint>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={session.suggesting}
                  onClick={() => void session.suggest()}
                >
                  {session.suggesting ? 'Analyzing texture…' : 'Suggest parameters from texture'}
                </Button>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-normal text-muted-foreground">
                    Structure — what the growths and openings are
                  </Label>
                  <Textarea
                    rows={2}
                    className="min-h-14 font-mono text-xs"
                    value={params.structureDescription}
                    onChange={(event) => patch('structureDescription', event.target.value)}
                  />
                </div>
              </>
            )}
          </>
        ) : (
          <Hint>Pick a surface texture in step 2 (Surface) to let it reshape the form.</Hint>
        )}
      </Disclosure>

      <Expert>
        <SliderField
          label="Shape fidelity"
          value={params.geometryFidelity}
          min={0}
          max={100}
          step={1}
          onChange={(value) => patch('geometryFidelity', value)}
        />
        <SliderField
          label="Material influence"
          value={params.materialInfluence}
          min={0}
          max={100}
          step={1}
          onChange={(value) => patch('materialInfluence', value)}
        />
        <SelectField
          label="Quality"
          value={params.quality}
          onValueChange={(value) => patch('quality', value as AIRenderParams['quality'])}
          options={AI_RENDER_QUALITIES.map((quality) => ({ value: quality, label: quality }))}
        />
        <SelectField
          label="Size"
          value={params.size}
          onValueChange={(value) => patch('size', value as AIRenderParams['size'])}
          options={AI_RENDER_SIZES.map((size) => ({
            value: size,
            label: SIZE_LABELS[size] ?? size.replace('x', ' × '),
          }))}
        />
        <Hint>
          Sizes above 1536px are rendered natively at that resolution — slower and more expensive
          per render, no upscaling pass. Pair with quality “high”.
        </Hint>

        {metamorphOn && (
          <>
            <GroupLabel>Metamorph</GroupLabel>
            {METAMORPH_SLIDERS.map(({ key, label }) => (
              <SliderField
                key={key}
                label={label}
                value={params.metamorph?.[key] ?? DEFAULT_AI_METAMORPH_PARAMS[key]}
                min={0}
                max={100}
                step={1}
                onChange={(value) => patchMetamorph(key, value)}
              />
            ))}
          </>
        )}

        <GroupLabel>Make it bigger</GroupLabel>
        <div className="grid grid-cols-2 gap-2">
          <SliderField
            label="Creativity"
            value={session.enhance.creativity}
            min={0}
            max={1}
            step={0.05}
            onChange={(value) => session.setEnhance({ creativity: value })}
          />
          <SliderField
            label="Resemblance"
            value={session.enhance.resemblance}
            min={0}
            max={1}
            step={0.05}
            onChange={(value) => session.setEnhance({ resemblance: value })}
          />
        </div>

        <details className="rounded border p-3 text-xs">
          <summary className="cursor-pointer">Full generation prompt</summary>
          <p className="mt-3 leading-relaxed whitespace-pre-wrap">
            {buildAIRenderPrompt(
              {
                ...params,
                lightingDescription: scene.lighting,
                backgroundDescription: scene.background,
                background: scene.canvas,
              },
              Boolean(referenceName || metamorphOn),
            )}
          </p>
          <p className="mt-3 text-muted-foreground">Lighting and background are edited in Scene.</p>
        </details>
        <a href="/studio/library?studio=object" className="text-xs underline underline-offset-4">
          Browse saved combinations →
        </a>
      </Expert>
    </>
  );
}
