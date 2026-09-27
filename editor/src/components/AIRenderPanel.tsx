import { PromptAssistant } from './PromptAssistant';
import { libraryUrl } from '../lib/asset-api';
import type { ImageStudy } from '../../lib/image-studio-contract';
import { useEffect, useState } from 'react';

import { Hint, SelectField, SwitchField } from './toolbar/fields';
import { SliderField } from './toolbar/slider-field';
import { Segmented } from './toolbar/segmented';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  buildAIRenderPrompt,
  AI_ENHANCE_SCALES,
  DEFAULT_AI_ENHANCE,
  type AIEnhanceScale,
  AI_RENDER_QUALITIES,
  AI_RENDER_SIZES,
  DEFAULT_AI_METAMORPH_PARAMS,
  DEFAULT_AI_RENDER_PARAMS,
  type AIMetamorphParams,
  type AIRenderParams,
  type AIRenderResult,
  type AISuggestResult,
} from '../../lib/ai-render-contract';
import { downloadAIRender, enhanceAIRender } from '../lib/aiRender';

type Props = {
  restoredRender?: { id: string; params: AIRenderParams };
  onApplyPrompt: (study: ImageStudy) => void;
  onSavePrompt: (params: AIRenderParams) => Promise<ImageStudy>;
  sceneLighting: string;
  sceneBackground: string;
  sceneCanvas: AIRenderParams['background'];
  canRender: boolean;
  referenceName: string | null;
  textureSlug: string | null;
  onAttachReference: () => void;
  onClearReference: () => void;
  onRender: (params: AIRenderParams) => Promise<AIRenderResult>;
  onSuggestMetamorph: () => Promise<AISuggestResult>;
  onExportBundle: (result: AIRenderResult, params: AIRenderParams) => void;
};

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

export default function AIRenderPanel({
  restoredRender, onSavePrompt, onApplyPrompt, sceneLighting, sceneBackground, sceneCanvas,
  canRender,
  referenceName,
  textureSlug,
  onAttachReference,
  onClearReference,
  onRender,
  onSuggestMetamorph,
  onExportBundle,
}: Props) {
  const [params, setParams] = useState<AIRenderParams>(DEFAULT_AI_RENDER_PARAMS);
  useEffect(() => { if (restoredRender) setParams(restoredRender.params); }, [restoredRender]);
  const [status, setStatus] = useState<'idle' | 'rendering' | 'done' | 'error'>('idle');
  const [suggesting, setSuggesting] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [enhance, setEnhance] = useState({ ...DEFAULT_AI_ENHANCE });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AIRenderResult | null>(null);

  const patch = <K extends keyof AIRenderParams>(key: K, value: AIRenderParams[K]) =>
    setParams((current) => ({ ...current, [key]: value }));

  const patchMetamorph = (key: keyof AIMetamorphParams, value: number) =>
    setParams((current) => ({
      ...current,
      metamorph: { ...(current.metamorph ?? DEFAULT_AI_METAMORPH_PARAMS), [key]: value },
    }));

  const runEnhance = async () => {
    if (!result) return;
    setEnhancing(true);
    setError(null);
    try {
      const enhanced = await enhanceAIRender({ image: result.image, ...enhance }, result.assetId);
      // The enhanced image replaces the card; prompt and request id stay from
      // the composing render, the model label records both stages.
      setResult((current) =>
        current
          ? { ...current, image: enhanced.image, assetId: enhanced.assetId, model: `${current.model} + ${enhanced.model}` }
          : current,
      );
    } catch (enhanceError) {
      setError(
        enhanceError instanceof Error ? enhanceError.message : 'Detail enhancement failed.',
      );
    } finally {
      setEnhancing(false);
    }
  };

  const suggest = async () => {
    setSuggesting(true);
    setError(null);
    try {
      const suggestion = await onSuggestMetamorph();
      setParams((current) => ({
        ...current,
        metamorph: suggestion.params,
        materialDescription: suggestion.materialDescription,
        structureDescription: suggestion.structureDescription,
      }));
    } catch (suggestError) {
      setError(suggestError instanceof Error ? suggestError.message : 'AI suggestion failed.');
    } finally {
      setSuggesting(false);
    }
  };

  const render = async () => {
    setStatus('rendering');
    setError(null);
    try {
      const next = await onRender(params);
      setResult(next);
      setStatus('done');
    } catch (renderError) {
      setError(renderError instanceof Error ? renderError.message : 'AI material render failed.');
      setStatus('error');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Hint>
        Image 1 locks the current shape and camera. An optional Image 2 supplies any material —
        nacre, coral, moss, grass, fur or something entirely new.
      </Hint>


      {textureSlug && (
        <div className="flex flex-col gap-3 rounded-md border border-border p-3">
          <SwitchField
            label="Metamorph with surface texture"
            checked={params.metamorph != null}
            onCheckedChange={(on) => patch('metamorph', on ? DEFAULT_AI_METAMORPH_PARAMS : null)}
          />
          {params.metamorph && (
            <>
              <Hint>
                Image 2 is the surface texture selected above — nothing to upload. The metamorph
                template lets that material reshape the form: deformation, budding nubs, porosity.
              </Hint>
              <Button
                variant="outline"
                size="sm"
                disabled={suggesting}
                onClick={() => void suggest()}
              >
                {suggesting ? 'Analyzing texture…' : 'Suggest parameters from texture'}
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
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-normal text-muted-foreground">Material direction</Label>
        <Textarea
          rows={4}
          className="min-h-20 font-mono text-xs"
          value={params.materialDescription}
          onChange={(event) => patch('materialDescription', event.target.value)}
        />
      </div>

      <PromptAssistant disabled={!canRender || status === 'rendering'} onSnapshot={() => onSavePrompt(params)} onApply={study => { if (study.object) { setParams(study.object.params); onApplyPrompt(study); } }} />
      <details className="rounded border p-3 text-xs"><summary className="cursor-pointer">Scenic direction & full generation prompt</summary><p className="mt-3 whitespace-pre-wrap leading-relaxed">{buildAIRenderPrompt({ ...params, lightingDescription: sceneLighting, backgroundDescription: sceneBackground, background: sceneCanvas }, Boolean(referenceName || (params.metamorph && textureSlug)))}</p><p className="mt-3 text-muted-foreground">Lighting and background are edited in Scene.</p></details>
      <a href="/studio/library?studio=object" className="text-xs underline underline-offset-4">Browse saved Metaball combinations →</a>
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
        Sizes above 1536px are rendered natively at that resolution — slower and
        more expensive per render, no upscaling pass. Pair with quality “high”.
      </Hint>

      {params.metamorph && textureSlug ? (
        <Hint>Material reference: surface texture {textureSlug} (selected above).</Hint>
      ) : (
        <>
          <Hint>
            {referenceName ? `Material reference: ${referenceName}` : 'No material image attached.'}
          </Hint>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={onAttachReference}>
              {referenceName ? 'Replace reference' : 'Attach material image'}
            </Button>
            <Button variant="outline" size="sm" disabled={!referenceName} onClick={onClearReference}>
              Clear
            </Button>
          </div>
        </>
      )}

      <Button
        className="w-full"
        disabled={!canRender || status === 'rendering'}
        onClick={() => void render()}
      >
        {status === 'rendering' ? 'Rendering…' : 'Render with AI'}
      </Button>
      {!canRender && <Hint>Open the 3D view and wait for the shape.</Hint>}
      {error && (
        <p className="text-xs leading-snug text-destructive" role="alert">
          {error}
        </p>
      )}

      {result && (
        <Card size="sm" className="gap-0 py-0">
          {result.assetId && <a className="p-3 text-xs underline" href={libraryUrl(result.assetId)}>Open saved prompt + image →</a>}
          <CardContent className="px-0">
            <img
              src={result.image}
              alt="AI-rendered metaball material study"
              className="block aspect-square w-full bg-muted object-contain"
            />
          </CardContent>
          <CardFooter className="flex flex-col gap-2 border-t px-3 py-2">
            <div className="flex w-full items-center justify-between gap-2">
              <span className="truncate font-mono text-[0.625rem] text-muted-foreground">
                {result.model}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="xs" onClick={() => downloadAIRender(result)}>
                  Image
                </Button>
                {result.assetId ? <Button nativeButton={false} variant="outline" size="xs" render={<a href={`/api/images/${result.assetId}/bundle`} download />}>Bundle</Button> : <Button variant="outline" size="xs" onClick={() => onExportBundle(result, params)}>Bundle</Button>}
              </div>
            </div>
            {/* Compose small, then re-synthesize micro-detail at scale — the
                role Magnific played in the original Weave graph. */}
            <div className="flex w-full items-center gap-2">
              <Button
                variant="outline"
                size="xs"
                disabled={enhancing}
                onClick={() => void runEnhance()}
              >
                {enhancing ? 'Enhancing…' : 'Enhance detail'}
              </Button>
              <Segmented
                label="Enhance scale"
                value={String(enhance.scaleFactor) as '2' | '4'}
                onValueChange={(value) =>
                  setEnhance((current) => ({
                    ...current,
                    scaleFactor: Number(value) as AIEnhanceScale,
                  }))
                }
                className="w-auto"
                options={AI_ENHANCE_SCALES.map((scale) => ({
                  value: String(scale) as '2' | '4',
                  label: `${scale}×`,
                }))}
              />
            </div>
            <div className="grid w-full grid-cols-2 gap-2">
              <SliderField
                label="Creativity"
                value={enhance.creativity}
                min={0}
                max={1}
                step={0.05}
                onChange={(value) => setEnhance((current) => ({ ...current, creativity: value }))}
              />
              <SliderField
                label="Resemblance"
                value={enhance.resemblance}
                min={0}
                max={1}
                step={0.05}
                onChange={(value) => setEnhance((current) => ({ ...current, resemblance: value }))}
              />
            </div>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
