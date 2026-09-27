import type { ImageStudy } from '../../lib/image-studio-contract';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import AppCredits from './AppCredits';
import AIRenderPanel from './AIRenderPanel';
import { Disclosure } from './toolbar/disclosure';
import { ColorField, GroupLabel, Hint, SelectField, Subsection, SwitchField } from './toolbar/fields';
import { PresetGrid, Segmented } from './toolbar/segmented';
import { SliderField } from './toolbar/slider-field';
import { Textarea } from '@/components/ui/textarea';
import { TexturePicker } from './toolbar/texture-picker';
import { TopBar } from './toolbar/top-bar';
import { AI_RENDER_BACKGROUNDS } from '../../lib/ai-render-contract';
import type {
  AIRenderParams,
  AIRenderResult,
  AISuggestResult,
} from '../../lib/ai-render-contract';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  FLATTEN_EPSILON_MIN,
  FLATTEN_EPSILON_MAX,
  FLATTEN_RESOLUTION_MIN,
  FLATTEN_RESOLUTION_MAX,
  GOO_STD_MIN,
  GOO_STD_MAX,
  GOO_THRESHOLD_MIN,
  GOO_THRESHOLD_MAX,
  INWARD_PULL_MIN,
  INWARD_PULL_MAX,
  PNG_SCALES,
  PRESETS,
  SURFACE_SAMPLER_COUNT_MAX,
  SURFACE_SAMPLER_COUNT_MIN,
  SURFACE_SAMPLER_POINT_SIZE_MAX,
  SURFACE_SAMPLER_POINT_SIZE_MIN,
  SURFACE_SAMPLER_SPHERE_SIZE_MAX,
  SURFACE_SAMPLER_SPHERE_SIZE_MIN,
  THEME_PRESETS,
  TUBE_FACTOR_MIN,
  TUBE_FACTOR_MAX,
  CANVAS_THEMES,
  canvasThemeId,
  type CanvasThemeId,
  type Mode,
  type PngScale,
  type Size,
  TEXTURE_SCALE_MIN,
  TEXTURE_SCALE_MAX,
  type SurfaceSamplerMode,
  type Theme,
  type LookMode,
  type LiquidParams,
} from '../lib/model';
import { MATERIAL_PRESETS } from '../lib/materialPresets';
import { LIQUID_IOR_MAX, LIQUID_IOR_MIN, LIQUID_PRESETS } from '../lib/liquidPresets';
import { LIQUID_BACKDROPS } from '../lib/liquidBackdrops';
import { allLoopMotions, type LoopMotionId } from '../lib/motion';
import type { CausticDance } from '../lib/liquidPresets';

type ViewMode = '2d' | '3d';

type Props = {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  view: ViewMode;
  materialPreset: string;
  onMaterialPresetChange: (id: string) => void;
  textureSlug: string | null;
  onTextureSlugChange: (slug: string | null) => void;
  textureScale: number;
  onTextureScaleChange: (value: number) => void;
  textureAmount: number;
  onTextureAmountChange: (value: number) => void;
  lookMode: LookMode;
  onLookModeChange: (mode: LookMode) => void;
  liquidPreset: string;
  onLiquidPresetChange: (id: string) => void;
  liquidBackdrop: string;
  onLiquidBackdropChange: (id: string) => void;
  liquidParams: LiquidParams;
  onLiquidParamsChange: (patch: Partial<LiquidParams>) => void;
  onLiquidParamsCommit: () => void;
  surfaceSamplerEnabled: boolean;
  onSurfaceSamplerEnabledChange: (value: boolean) => void;
  surfaceSamplerMode: SurfaceSamplerMode;
  onSurfaceSamplerModeChange: (mode: SurfaceSamplerMode) => void;
  surfaceSamplerCount: number;
  onSurfaceSamplerCountChange: (value: number) => void;
  onSurfaceSamplerCountCommit: () => void;
  surfaceSamplerPointSize: number;
  onSurfaceSamplerPointSizeChange: (value: number) => void;
  onSurfaceSamplerPointSizeCommit: () => void;
  surfaceSamplerSphereSize: number;
  onSurfaceSamplerSphereSizeChange: (value: number) => void;
  onSurfaceSamplerSphereSizeCommit: () => void;
  surfaceSamplerShowMesh: boolean;
  onSurfaceSamplerShowMeshChange: (value: boolean) => void;
  surfaceSamplerAnimate: boolean;
  onSurfaceSamplerAnimateChange: (value: boolean) => void;
  selectedSize: Size | null;
  onSizeChange: (size: Size) => void;
  selectedRadius: number | null;
  radiusOverridden: boolean;
  onRadiusChange: (value: number) => void;
  onRadiusCommit: () => void;
  onRadiusReset: () => void;
  radiusMin: number;
  radiusMax: number;
  onDeleteSelected: () => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onThemeCommit: () => void;
  showGrid: boolean;
  onShowGridChange: (value: boolean) => void;
  fullGrid: boolean;
  onFullGridChange: (value: boolean) => void;
  gooStd: number;
  onGooStdChange: (value: number) => void;
  onGooStdCommit: () => void;
  gooThreshold: number;
  onGooThresholdChange: (value: number) => void;
  onGooThresholdCommit: () => void;
  tubeFactor: number;
  onTubeFactorChange: (value: number) => void;
  onTubeFactorCommit: () => void;
  inwardPull: number;
  onInwardPullChange: (value: number) => void;
  onInwardPullCommit: () => void;
  flattenEpsilon: number;
  onFlattenEpsilonChange: (value: number) => void;
  onFlattenEpsilonCommit: () => void;
  flattenResolution: number;
  onFlattenResolutionChange: (value: number) => void;
  onFlattenResolutionCommit: () => void;
  showExportPreview: boolean;
  onShowExportPreviewChange: (value: boolean) => void;
  selectedEdge: string | null;
  edgeFactor: number | null;
  edgeFactorOverridden: boolean;
  onEdgeFactorChange: (value: number) => void;
  onEdgeFactorCommit: () => void;
  onEdgeFactorReset: () => void;
  edgePull: number | null;
  edgePullOverridden: boolean;
  onEdgePullChange: (value: number) => void;
  onEdgePullCommit: () => void;
  onEdgePullReset: () => void;
  onEnableEdgeStyle: () => void;
  onDisableEdgeStyle: () => void;
  onRemoveEdge: () => void;
  markOnly: boolean;
  onMarkOnlyChange: (value: boolean) => void;
  pngScale: PngScale;
  onPngScaleChange: (value: PngScale) => void;
  canUndo: boolean;
  canRedo: boolean;
  activePresetId: string | null;
  onUndo: () => void;
  onRedo: () => void;
  onApplyPreset: (id: string) => void;
  onClear: () => void;
  onExportSvg: () => void;
  onExportPng: () => void;
  onCopySvg: () => Promise<boolean>;
  onExportJson: () => void;
  onExportGlb: () => void;
  onExportBlenderHandoff: () => void;
  restoredRender?: { id: string; params: AIRenderParams };
  onApplyAIPrompt: (study: ImageStudy) => void;
  onSaveAIPrompt: (params: AIRenderParams) => Promise<ImageStudy>;
  canAIRender: boolean;
  onAIRender: (params: AIRenderParams) => Promise<AIRenderResult>;
  onSuggestMetamorph: () => Promise<AISuggestResult>;
  onExportRenderBundle: (result: AIRenderResult, params: AIRenderParams) => void;
  sceneLighting: string;
  onSceneLightingChange: (value: string) => void;
  sceneBackground: string;
  onSceneBackgroundChange: (value: string) => void;
  sceneCanvas: AIRenderParams['background'];
  onSceneCanvasChange: (value: AIRenderParams['background']) => void;
  refImageName: string | null;
  onAttachRefImageClick: () => void;
  onClearRefImage: () => void;
  onImportJsonClick: () => void;
  growing: boolean;
  onGrowToggle: () => void;
  canGrow: boolean;
  activeMotion: LoopMotionId | null;
  onMotionToggle: (id: LoopMotionId) => void;
  canMotion: boolean;
  breakNecks: boolean;
  onBreakNecksChange: (value: boolean) => void;
};

const SIZES: Size[] = ['S', 'M', 'L', 'XL'];
const LOOP_MOTIONS = allLoopMotions();
const NO_MOTION = 'none';

/** Every section key, so a section revealed by a view switch opens expanded. */
const ALL_SECTIONS = [
  'shape',
  'motion',
  'connection',
  'node',
  'appearance',
  'material',
  'advanced-3d',
  'authoring',
  'style',
  'ai',
  'export',
  'reset',
];

function Section({
  value,
  title,
  children,
}: {
  value: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <AccordionItem value={value} className="border-b last:border-b-0">
      <AccordionTrigger className="py-2.5 font-mono text-xs tracking-wider text-muted-foreground uppercase hover:text-foreground hover:no-underline">
        {title}
      </AccordionTrigger>
      <AccordionContent className="flex flex-col gap-3 px-1 pb-3">{children}</AccordionContent>
    </AccordionItem>
  );
}

export default function Toolbar({
  mode,
  onModeChange,
  view,
  materialPreset,
  onMaterialPresetChange,
  textureSlug,
  onTextureSlugChange,
  textureScale,
  onTextureScaleChange,
  textureAmount,
  onTextureAmountChange,
  lookMode,
  onLookModeChange,
  liquidPreset,
  onLiquidPresetChange,
  liquidBackdrop,
  onLiquidBackdropChange,
  liquidParams,
  onLiquidParamsChange,
  onLiquidParamsCommit,
  surfaceSamplerEnabled,
  onSurfaceSamplerEnabledChange,
  surfaceSamplerMode,
  onSurfaceSamplerModeChange,
  surfaceSamplerCount,
  onSurfaceSamplerCountChange,
  onSurfaceSamplerCountCommit,
  surfaceSamplerPointSize,
  onSurfaceSamplerPointSizeChange,
  onSurfaceSamplerPointSizeCommit,
  surfaceSamplerSphereSize,
  onSurfaceSamplerSphereSizeChange,
  onSurfaceSamplerSphereSizeCommit,
  surfaceSamplerShowMesh,
  onSurfaceSamplerShowMeshChange,
  surfaceSamplerAnimate,
  onSurfaceSamplerAnimateChange,
  selectedSize,
  onSizeChange,
  selectedRadius,
  radiusOverridden,
  onRadiusChange,
  onRadiusCommit,
  onRadiusReset,
  radiusMin,
  radiusMax,
  onDeleteSelected,
  theme,
  onThemeChange,
  onThemeCommit,
  showGrid,
  onShowGridChange,
  fullGrid,
  onFullGridChange,
  gooStd,
  onGooStdChange,
  onGooStdCommit,
  gooThreshold,
  onGooThresholdChange,
  onGooThresholdCommit,
  tubeFactor,
  onTubeFactorChange,
  onTubeFactorCommit,
  inwardPull,
  onInwardPullChange,
  onInwardPullCommit,
  flattenEpsilon,
  onFlattenEpsilonChange,
  onFlattenEpsilonCommit,
  flattenResolution,
  onFlattenResolutionChange,
  onFlattenResolutionCommit,
  showExportPreview,
  onShowExportPreviewChange,
  selectedEdge,
  edgeFactor,
  edgeFactorOverridden,
  onEdgeFactorChange,
  onEdgeFactorCommit,
  onEdgeFactorReset,
  edgePull,
  edgePullOverridden,
  onEdgePullChange,
  onEdgePullCommit,
  onEdgePullReset,
  onEnableEdgeStyle,
  onDisableEdgeStyle,
  onRemoveEdge,
  markOnly,
  onMarkOnlyChange,
  pngScale,
  onPngScaleChange,
  canUndo,
  canRedo,
  activePresetId,
  onUndo,
  onRedo,
  onApplyPreset,
  onClear,
  onExportSvg,
  onExportPng,
  onCopySvg,
  onExportJson,
  onExportGlb,
  onExportBlenderHandoff,
  restoredRender,
  onSaveAIPrompt,
  onApplyAIPrompt,
  canAIRender,
  onAIRender,
  onSuggestMetamorph,
  onExportRenderBundle,
  sceneLighting,
  onSceneLightingChange,
  sceneBackground,
  onSceneBackgroundChange,
  sceneCanvas,
  onSceneCanvasChange,
  refImageName,
  onAttachRefImageClick,
  onClearRefImage,
  onImportJsonClick,
  growing,
  onGrowToggle,
  canGrow,
  activeMotion,
  onMotionToggle,
  canMotion,
  breakNecks,
  onBreakNecksChange,
}: Props) {
  const [openSections, setOpenSections] = useState<string[]>(ALL_SECTIONS);
  const [confirmClear, setConfirmClear] = useState(false);

  const handleCopy = async () => {
    if (await onCopySvg()) toast.success('SVG copied to the clipboard.');
    else toast.error('Could not copy the SVG.');
  };

  const activeMotionHint = LOOP_MOTIONS.find((motion) => motion.id === activeMotion)?.hint;

  return (
    <TooltipProvider>
      <TopBar
        view={view}
        mode={mode}
        onModeChange={onModeChange}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={onUndo}
        onRedo={onRedo}
      />

      <aside className="flex max-h-[50vh] min-h-0 shrink-0 flex-col border-b md:max-h-none md:w-[340px] md:border-r md:border-b-0">
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col px-4 py-1">
            <Accordion
              multiple
              value={openSections}
              onValueChange={(next) => setOpenSections(next as string[])}
            >
              <Section value="shape" title="Shape">
                <PresetGrid
                  label="Shape presets"
                  value={activePresetId}
                  onValueChange={onApplyPreset}
                  options={PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))}
                />
              
                {(mode === 'metaball' || view === '3d') && (
                <Disclosure label="Fine-tune form">
                  <SliderField
                    label="Neck width"
                    value={tubeFactor}
                    min={TUBE_FACTOR_MIN}
                    max={TUBE_FACTOR_MAX}
                    step={0.01}
                    onChange={onTubeFactorChange}
                    onCommit={onTubeFactorCommit}
                  />
                  <Hint>Capsule thickness before blur.</Hint>
                  <SliderField
                    label="Blur"
                    value={gooStd}
                    min={GOO_STD_MIN}
                    max={GOO_STD_MAX}
                    step={0.5}
                    onChange={onGooStdChange}
                    onCommit={onGooStdCommit}
                  />
                  <Hint>Spread of the merge — softer, wider joins.</Hint>
                  <SliderField
                    label="Contrast"
                    value={gooThreshold}
                    min={GOO_THRESHOLD_MIN}
                    max={GOO_THRESHOLD_MAX}
                    step={0.5}
                    onChange={onGooThresholdChange}
                    onCommit={onGooThresholdCommit}
                  />
                  <Hint>Alpha cutoff — higher = sharper waist, tighter neck.</Hint>
                  <SliderField
                    label="Pinch / merge"
                    value={inwardPull}
                    min={INWARD_PULL_MIN}
                    max={INWARD_PULL_MAX}
                    step={0.01}
                    onChange={onInwardPullChange}
                    onCommit={onInwardPullCommit}
                  />
                  <Hint>
                    Barbell tubes at 0 → pinched metaball at 1. Also boosts effective blur as tubes
                    fade.
                  </Hint>

                  {view === '2d' && (
                    <Subsection>
                      {selectedEdge && edgeFactor !== null && edgePull !== null ? (
                        <>
                          <SwitchField
                            label="Customize selected connection"
                            checked={edgeFactorOverridden || edgePullOverridden}
                            onCheckedChange={(next) => {
                              if (next) onEnableEdgeStyle();
                              else onDisableEdgeStyle();
                            }}
                          />
                          {edgeFactorOverridden || edgePullOverridden ? (
                            <>
                              <SliderField
                                label="Neck width"
                                value={edgeFactor}
                                min={TUBE_FACTOR_MIN}
                                max={TUBE_FACTOR_MAX}
                                step={0.01}
                                onChange={onEdgeFactorChange}
                                onCommit={onEdgeFactorCommit}
                              />
                              <Hint>Capsule thickness for this connection before blur.</Hint>
                              <SliderField
                                label="Pinch"
                                value={edgePull}
                                min={INWARD_PULL_MIN}
                                max={INWARD_PULL_MAX}
                                step={0.01}
                                onChange={onEdgePullChange}
                                onCommit={onEdgePullCommit}
                              />
                              <Hint>
                                How much tube remains on this join — 0 keeps a barbell, 1 fades the
                                tube.
                              </Hint>
                              <div className="grid grid-cols-2 gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={!edgeFactorOverridden}
                                  onClick={onEdgeFactorReset}
                                >
                                  Reset neck
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={!edgePullOverridden}
                                  onClick={onEdgePullReset}
                                >
                                  Reset pinch
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="col-span-2"
                                  onClick={onRemoveEdge}
                                >
                                  Remove
                                </Button>
                              </div>
                            </>
                          ) : (
                            <Hint>
                              Turn on to override global Neck and Pinch for this join only. Blur and
                              Contrast stay global.
                            </Hint>
                          )}
                        </>
                      ) : (
                        <Hint>
                          Select a connection on the canvas to customize its neck and pinch.
                        </Hint>
                      )}
                    </Subsection>
                  )}
                </Disclosure>
                )}
              </Section>

              <Section value="motion" title="Motion">
                <SelectField
                  label="Loop"
                  value={activeMotion ?? NO_MOTION}
                  disabled={!canMotion && activeMotion === null}
                  onValueChange={(next) => {
                    if (next === NO_MOTION) {
                      if (activeMotion) onMotionToggle(activeMotion);
                      return;
                    }
                    onMotionToggle(next as LoopMotionId);
                  }}
                  options={[
                    { value: NO_MOTION, label: 'None' },
                    ...LOOP_MOTIONS.map((motion) => ({ value: motion.id, label: motion.label })),
                  ]}
                />
                {activeMotionHint && <Hint>{activeMotionHint}</Hint>}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canGrow && !growing}
                    onClick={onGrowToggle}
                  >
                    {growing ? 'Stop growth' : 'Grow once'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!activeMotion}
                    onClick={() => activeMotion && onMotionToggle(activeMotion)}
                  >
                    Stop loop
                  </Button>
                </div>
                <SwitchField
                  label="Allow necks to break while moving"
                  checked={breakNecks}
                  disabled={!activeMotion}
                  onCheckedChange={onBreakNecksChange}
                />
              </Section>

              {view === '2d' && mode === 'graph' && (
                <Section value="connection" title="Selected connection">
                  {selectedEdge ? (
                    <Button variant="destructive" size="sm" className="w-full" onClick={onRemoveEdge}>
                      Remove connection
                    </Button>
                  ) : (
                    <Hint>Click a connection between two nodes to select it.</Hint>
                  )}
                </Section>
              )}

              {view === '2d' && selectedSize !== null && (
                <Section value="node" title="Selected node">
                  <Segmented
                    label="Node size"
                    value={selectedSize}
                    onValueChange={onSizeChange}
                    options={SIZES.map((size) => ({ value: size, label: size }))}
                  />
                  {selectedRadius !== null && (
                    <>
                      <SliderField
                        label="Radius"
                        value={selectedRadius}
                        min={radiusMin}
                        max={radiusMax}
                        step={1}
                        onChange={onRadiusChange}
                        onCommit={onRadiusCommit}
                      />
                      <Hint>
                        {radiusOverridden
                          ? 'Custom radius active. Size presets reset it.'
                          : 'Using preset size radius.'}
                      </Hint>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        disabled={!radiusOverridden}
                        onClick={onRadiusReset}
                      >
                        Use preset radius
                      </Button>
                    </>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    disabled={selectedSize === null}
                    onClick={onDeleteSelected}
                  >
                    Delete node
                  </Button>
                  <Hint>
                    Arrow keys nudge (1 px). Shift+arrow nudges 5 px. Alt/Shift+drag moves a node to
                    another cell.
                  </Hint>
                </Section>
              )}

              {view === '2d' && (
                <Section value="appearance" title="Appearance">
                  {/* The canvas theme is part of the document, so what you see
                      here is what an export looks like — no presentation-only
                      dark mode for the artwork. */}
                  <div className="flex flex-col gap-1.5">
                    <GroupLabel>Canvas</GroupLabel>
                    <Segmented
                      label="Canvas theme"
                      value={canvasThemeId(theme)}
                      onValueChange={(id: CanvasThemeId) => {
                        onThemeChange({ ...CANVAS_THEMES[id] });
                        onThemeCommit();
                      }}
                      options={[
                        {
                          value: 'day',
                          label: 'Day',
                          hint: 'White ground, black mark, full-strength raster.',
                        },
                        {
                          value: 'night',
                          label: 'Night',
                          hint: 'Erebos ground, Selene mark, raster on the night ramp.',
                        },
                      ]}
                    />
                  </div>
                  <ColorField
                    label="Mark"
                    value={theme.ink}
                    onChange={(v) => onThemeChange({ ...theme, ink: v })}
                    onCommit={onThemeCommit}
                  />
                  <Subsection>
                    <SwitchField
                      label="Namche raster"
                      checked={showGrid}
                      onCheckedChange={onShowGridChange}
                    />
                    {showGrid && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            const preset = THEME_PRESETS[0];
                            if (!preset) return;
                            onThemeChange({ ...preset.theme, ink: theme.ink });
                            onThemeCommit();
                          }}
                        >
                          Reset raster colors
                        </Button>
                        <ColorField
                          label="Outer cells"
                          value={theme.pink}
                          onChange={(v) => onThemeChange({ ...theme, pink: v })}
                          onCommit={onThemeCommit}
                        />
                        <ColorField
                          label="Inner cells"
                          value={theme.blue}
                          onChange={(v) => onThemeChange({ ...theme, blue: v })}
                          onCommit={onThemeCommit}
                        />
                        <ColorField
                          label="Background"
                          value={theme.bg}
                          onChange={(v) => onThemeChange({ ...theme, bg: v })}
                          onCommit={onThemeCommit}
                        />
                      </>
                    )}
                  </Subsection>
                </Section>
              )}

              {view === '3d' && (
                <Section value="material" title="Look">
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
                        value={materialPreset}
                        onValueChange={onMaterialPresetChange}
                        options={MATERIAL_PRESETS.map((preset) => ({
                          value: preset.id,
                          label: preset.label,
                        }))}
                      />
                      <Hint>
                        {MATERIAL_PRESETS.find((p) => p.id === materialPreset)?.hint ?? ''}
                      </Hint>
                      <TexturePicker value={textureSlug} onValueChange={onTextureSlugChange} />
                      {textureSlug !== null && (
                        <>
                          <SliderField
                            label="Texture scale"
                            value={textureScale}
                            min={TEXTURE_SCALE_MIN}
                            max={TEXTURE_SCALE_MAX}
                            step={0.1}
                            onChange={onTextureScaleChange}
                          />
                          <SliderField
                            label="Texture amount"
                            value={textureAmount}
                            min={0}
                            max={1}
                            step={0.05}
                            onChange={onTextureAmountChange}
                          />
                          <Hint>
                            Curated imagery, projected triplanar — pairs well with clay and rock.
                          </Hint>
                        </>
                      )}
                    </>
                  )}

                  {lookMode === 'liquid' && (
                    <>
                      <PresetGrid
                        label="Liquid presets"
                        value={liquidPreset}
                        onValueChange={onLiquidPresetChange}
                        options={LIQUID_PRESETS.map((preset) => ({
                          value: preset.id,
                          label: preset.label,
                        }))}
                      />
                      <Hint>{LIQUID_PRESETS.find((p) => p.id === liquidPreset)?.hint ?? ''}</Hint>
                      <Disclosure label="Fine tune liquid">
                        <SliderField
                          label="Transmission"
                          value={liquidParams.transmission}
                          min={0}
                          max={1}
                          step={0.01}
                          onChange={(v) => onLiquidParamsChange({ transmission: v })}
                          onCommit={onLiquidParamsCommit}
                        />
                        <Hint>How much environment light passes through the body.</Hint>
                        <SliderField
                          label="Glow"
                          value={liquidParams.bloom}
                          min={0}
                          max={1}
                          step={0.01}
                          onChange={(v) => onLiquidParamsChange({ bloom: v })}
                          onCommit={onLiquidParamsCommit}
                        />
                        <SliderField
                          label="Caustics"
                          value={liquidParams.causticStrength}
                          min={0}
                          max={1}
                          step={0.01}
                          onChange={(v) => onLiquidParamsChange({ causticStrength: v })}
                          onCommit={onLiquidParamsCommit}
                        />
                        <Hint>Light dance and caustic intensity.</Hint>
                        <Segmented
                          label="Caustic dance"
                          value={liquidParams.causticDance}
                          onValueChange={(id: CausticDance) => {
                            onLiquidParamsChange({ causticDance: id });
                            onLiquidParamsCommit();
                          }}
                          options={[
                            { value: 'calm', label: 'Calm' },
                            { value: 'lively', label: 'Lively' },
                            { value: 'wild', label: 'Wild' },
                          ]}
                        />
                        <SliderField
                          label="Waves"
                          value={liquidParams.waveStrength}
                          min={0}
                          max={1}
                          step={0.01}
                          onChange={(v) => onLiquidParamsChange({ waveStrength: v })}
                          onCommit={onLiquidParamsCommit}
                        />
                        <Hint>Surface distortion and wobble.</Hint>
                        <SliderField
                          label="Rim"
                          value={liquidParams.rimStrength}
                          min={0}
                          max={1}
                          step={0.01}
                          onChange={(v) => onLiquidParamsChange({ rimStrength: v })}
                          onCommit={onLiquidParamsCommit}
                        />
                        <SliderField
                          label="Roughness"
                          value={liquidParams.roughness}
                          min={0}
                          max={1}
                          step={0.01}
                          onChange={(v) => onLiquidParamsChange({ roughness: v })}
                          onCommit={onLiquidParamsCommit}
                        />
                        <SliderField
                          label="IOR"
                          value={liquidParams.ior}
                          min={LIQUID_IOR_MIN}
                          max={LIQUID_IOR_MAX}
                          step={0.01}
                          onChange={(v) => onLiquidParamsChange({ ior: v })}
                          onCommit={onLiquidParamsCommit}
                        />
                        <SliderField
                          label="Dispersion"
                          value={liquidParams.dispersion}
                          min={0}
                          max={1}
                          step={0.01}
                          onChange={(v) => onLiquidParamsChange({ dispersion: v })}
                          onCommit={onLiquidParamsCommit}
                        />
                        <SliderField
                          label="Opacity"
                          value={liquidParams.opacity}
                          min={0}
                          max={1}
                          step={0.01}
                          onChange={(v) => onLiquidParamsChange({ opacity: v })}
                          onCommit={onLiquidParamsCommit}
                        />
                        <Hint>Residual body density, independent of tint.</Hint>
                        <ColorField
                          label="Tint"
                          value={liquidParams.tint}
                          onChange={(v) => onLiquidParamsChange({ tint: v })}
                          onCommit={onLiquidParamsCommit}
                        />
                        <Hint>A light color wash rather than an opaque gel.</Hint>
                      </Disclosure>
                    </>
                  )}
                </Section>
              )}

              {view === '3d' && (
                <Section value="scene" title="Scene">
                  {/* One description of how the object is presented — the AI
                      render reads lighting and background from here, and the
                      liquid look's environment lives here too. Parametric
                      live-view lighting is deliberately out of scope (#49). */}
                  {lookMode === 'liquid' && (
                    <>
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
                      <Hint>
                        {LIQUID_BACKDROPS.find((b) => b.id === liquidBackdrop)?.hint ?? ''}
                      </Hint>
                    </>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <GroupLabel>Lighting</GroupLabel>
                    <Textarea
                      rows={2}
                      className="min-h-14 font-mono text-xs"
                      value={sceneLighting}
                      onChange={(event) => onSceneLightingChange(event.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <GroupLabel>Background</GroupLabel>
                    <Textarea
                      rows={2}
                      className="min-h-14 font-mono text-xs"
                      disabled={sceneCanvas === 'transparent'}
                      value={sceneBackground}
                      onChange={(event) => onSceneBackgroundChange(event.target.value)}
                    />
                  </div>
                  <SelectField
                    label="Canvas"
                    value={sceneCanvas}
                    onValueChange={(value) =>
                      onSceneCanvasChange(value as AIRenderParams['background'])
                    }
                    options={AI_RENDER_BACKGROUNDS.map((background) => ({
                      value: background,
                      label: background,
                    }))}
                  />
                  <Hint>Lighting, background and canvas feed the AI material render.</Hint>
                </Section>
              )}

              {view === '3d' && (
                <Section value="advanced-3d" title="Advanced 3D">
                  <Disclosure label="Surface sampling">
                    <SwitchField
                      label="Enable sampler"
                      checked={surfaceSamplerEnabled}
                      onCheckedChange={onSurfaceSamplerEnabledChange}
                    />
                    <Segmented
                      label="Sampler mode"
                      value={surfaceSamplerMode}
                      disabled={!surfaceSamplerEnabled}
                      onValueChange={onSurfaceSamplerModeChange}
                      options={[
                        { value: 'points', label: 'Points' },
                        { value: 'spheres', label: 'Spheres' },
                        { value: 'both', label: 'Both' },
                      ]}
                    />
                    <SliderField
                      label="Count"
                      value={surfaceSamplerCount}
                      min={SURFACE_SAMPLER_COUNT_MIN}
                      max={SURFACE_SAMPLER_COUNT_MAX}
                      step={100}
                      disabled={!surfaceSamplerEnabled}
                      onChange={onSurfaceSamplerCountChange}
                      onCommit={onSurfaceSamplerCountCommit}
                    />
                    <SliderField
                      label="Point size"
                      value={surfaceSamplerPointSize}
                      min={SURFACE_SAMPLER_POINT_SIZE_MIN}
                      max={SURFACE_SAMPLER_POINT_SIZE_MAX}
                      step={0.001}
                      disabled={!surfaceSamplerEnabled || surfaceSamplerMode === 'spheres'}
                      onChange={onSurfaceSamplerPointSizeChange}
                      onCommit={onSurfaceSamplerPointSizeCommit}
                    />
                    <SliderField
                      label="Sphere size"
                      value={surfaceSamplerSphereSize}
                      min={SURFACE_SAMPLER_SPHERE_SIZE_MIN}
                      max={SURFACE_SAMPLER_SPHERE_SIZE_MAX}
                      step={0.001}
                      disabled={!surfaceSamplerEnabled || surfaceSamplerMode === 'points'}
                      onChange={onSurfaceSamplerSphereSizeChange}
                      onCommit={onSurfaceSamplerSphereSizeCommit}
                    />
                    <SwitchField
                      label="Show mesh"
                      checked={surfaceSamplerShowMesh}
                      disabled={!surfaceSamplerEnabled}
                      onCheckedChange={onSurfaceSamplerShowMeshChange}
                    />
                    <SwitchField
                      label="Animate reveal"
                      checked={surfaceSamplerAnimate}
                      disabled={!surfaceSamplerEnabled}
                      onCheckedChange={onSurfaceSamplerAnimateChange}
                    />
                    <Hint>
                      {surfaceSamplerEnabled
                        ? 'Pink points / spheres bloom onto the whole isosurface.'
                        : 'Enable to scatter pink samples on the 3D mark.'}
                    </Hint>
                  </Disclosure>
                </Section>
              )}

              {view === '2d' && (
                <Section value="authoring" title="Authoring">
                  <SwitchField
                    label="Allow nodes in outer cells"
                    checked={fullGrid}
                    onCheckedChange={onFullGridChange}
                  />
                </Section>
              )}

              {view === '3d' && (
                <Section value="ai" title="AI material render">
                  <AIRenderPanel
                    canRender={canAIRender}
                    restoredRender={restoredRender}
                    onSavePrompt={onSaveAIPrompt}
                    onApplyPrompt={onApplyAIPrompt}
                    sceneLighting={sceneLighting}
                    sceneBackground={sceneBackground}
                    sceneCanvas={sceneCanvas}
                    referenceName={refImageName}
                    textureSlug={textureSlug}
                    onAttachReference={onAttachRefImageClick}
                    onClearReference={onClearRefImage}
                    onRender={onAIRender}
                    onSuggestMetamorph={onSuggestMetamorph}
                    onExportBundle={onExportRenderBundle}
                  />
                </Section>
              )}

              <Section value="export" title="Export">
                {view === '2d' && mode === 'metaball' && (
                  <>
                    <SwitchField
                      label="Mark only (transparent)"
                      checked={markOnly}
                      onCheckedChange={onMarkOnlyChange}
                    />
                    <SelectField
                      label="PNG scale"
                      value={String(pngScale)}
                      onValueChange={(next) => onPngScaleChange(Number(next) as PngScale)}
                      options={PNG_SCALES.map((scale) => ({
                        value: String(scale),
                        label: `${scale}×`,
                      }))}
                    />
                  </>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {view === '2d' && mode === 'metaball' && (
                    <>
                      <Button size="sm" onClick={onExportSvg}>
                        Export SVG
                      </Button>
                      <Button variant="outline" size="sm" onClick={onExportPng}>
                        Export PNG
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void handleCopy()}>
                        Copy SVG
                      </Button>
                    </>
                  )}
                  <Button variant="outline" size="sm" onClick={onExportJson}>
                    Export JSON
                  </Button>
                  <Button variant="outline" size="sm" onClick={onImportJsonClick}>
                    Import JSON
                  </Button>
                  {view === '3d' && (
                    <>
                      <Button variant="outline" size="sm" onClick={onExportGlb}>
                        Export GLB
                      </Button>
                      <Button variant="outline" size="sm" onClick={onExportBlenderHandoff}>
                        Export for Blender
                      </Button>
                    </>
                  )}
                </div>
                {view === '2d' && mode === 'graph' && (
                  <Hint>
                    Switch to Form to export SVG or PNG. JSON remains available for editable graph
                    data.
                  </Hint>
                )}
                {view === '3d' && (
                  <Hint>
                    Export GLB = mesh only. Export for Blender = zip (mesh + preview + universal
                    prompt) for Blender MCP. The material reference above is reused for that
                    handoff.
                  </Hint>
                )}
                {view === '2d' && mode === 'metaball' && (
                  <Disclosure label="Advanced export">
                    <SwitchField
                      label="Show export preview overlay"
                      checked={showExportPreview}
                      onCheckedChange={onShowExportPreviewChange}
                    />
                    <SliderField
                      label="Flatten detail"
                      value={flattenEpsilon}
                      min={FLATTEN_EPSILON_MIN}
                      max={FLATTEN_EPSILON_MAX}
                      step={0.1}
                      onChange={onFlattenEpsilonChange}
                      onCommit={onFlattenEpsilonCommit}
                    />
                    <SliderField
                      label="Flatten res."
                      value={flattenResolution}
                      min={FLATTEN_RESOLUTION_MIN}
                      max={FLATTEN_RESOLUTION_MAX}
                      step={1}
                      onChange={onFlattenResolutionChange}
                      onCommit={onFlattenResolutionCommit}
                    />
                  </Disclosure>
                )}
              </Section>

              <Section value="reset" title="Reset">
                <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
                  <AlertDialogTrigger
                    render={
                      <Button variant="destructive" size="sm" className="w-full">
                        Clear canvas
                      </Button>
                    }
                  />
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear the canvas?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This removes every node. You can undo.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        onClick={() => {
                          onClear();
                          setConfirmClear(false);
                        }}
                      >
                        Clear canvas
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </Section>
            </Accordion>

            <AppCredits />
          </div>
        </ScrollArea>
      </aside>
    </TooltipProvider>
  );
}
