import type {
  Document,
  LiquidParams,
  LookMode,
  Mode,
  PngScale,
  Size,
  Theme,
} from '../../lib/model';
import type { AIRenderParams, AIRenderResult } from '../../../lib/ai-render-contract';
import type { ImageStudy } from '../../../lib/image-studio-contract';
import type { AIRenderSession } from '../../lib/useAIRenders';

/**
 * Grouped, typed props for the side-panel tabs. App stays the owner of the
 * document and its history semantics: `set` commits one undo step, `scrub`
 * live-updates during a gesture and `commit` closes that gesture.
 */

/** Global form parameters shared by 2D and 3D ("Fine-tune form"). */
export type FormValues = {
  tubeFactor: number;
  gooStd: number;
  gooThreshold: number;
  inwardPull: number;
};

export type FormTuning = {
  values: FormValues;
  scrub: <K extends keyof FormValues>(key: K, value: FormValues[K]) => void;
  commit: () => void;
};

export type ShapePresets = {
  activePresetId: string | null;
  onApply: (id: string) => void;
};

export type SelectedNode = {
  size: Size;
  radius: number | null;
  radiusOverridden: boolean;
  radiusMin: number;
  radiusMax: number;
  onSizeChange: (size: Size) => void;
  onRadiusChange: (value: number) => void;
  onRadiusCommit: () => void;
  onRadiusReset: () => void;
  onDelete: () => void;
};

export type SelectedEdge = {
  factor: number;
  factorOverridden: boolean;
  pull: number;
  pullOverridden: boolean;
  onFactorChange: (value: number) => void;
  onFactorCommit: () => void;
  onFactorReset: () => void;
  onPullChange: (value: number) => void;
  onPullCommit: () => void;
  onPullReset: () => void;
  onEnableStyle: () => void;
  onDisableStyle: () => void;
  onRemove: () => void;
};

export type MarkShapeProps = {
  mode: Mode;
  presets: ShapePresets;
  form: FormTuning;
  /** Present only while a node is selected on the canvas. */
  node: SelectedNode | null;
  /** Present only while a connection is selected on the canvas. */
  edge: SelectedEdge | null;
  fullGrid: boolean;
  onFullGridChange: (value: boolean) => void;
};

export type MarkStyleProps = {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onThemeCommit: () => void;
  rasterEnabled: boolean;
  onRasterEnabledChange: (value: boolean) => void;
};

export type MarkExportProps = {
  mode: Mode;
  markOnly: boolean;
  onMarkOnlyChange: (value: boolean) => void;
  pngScale: PngScale;
  onPngScaleChange: (value: PngScale) => void;
  onExportSvg: () => void;
  onExportPng: () => void;
  onCopySvg: () => Promise<boolean>;
  showExportPreview: boolean;
  onShowExportPreviewChange: (value: boolean) => void;
  flattenEpsilon: number;
  flattenResolution: number;
  onFlattenScrub: (key: 'flattenEpsilon' | 'flattenResolution', value: number) => void;
  onFlattenCommit: () => void;
};

export type MarkPanelProps = {
  /** Selected node id or edge key; a new selection opens the Shape tab. */
  selectionId: string | null;
  shape: MarkShapeProps;
  style: MarkStyleProps;
  export: MarkExportProps;
};

export type SurfaceSamplerValues = Pick<
  Document,
  | 'surfaceSamplerEnabled'
  | 'surfaceSamplerMode'
  | 'surfaceSamplerCount'
  | 'surfaceSamplerPointSize'
  | 'surfaceSamplerSphereSize'
  | 'surfaceSamplerShowMesh'
  | 'surfaceSamplerAnimate'
>;

type SamplerDiscrete =
  | 'surfaceSamplerEnabled'
  | 'surfaceSamplerMode'
  | 'surfaceSamplerShowMesh'
  | 'surfaceSamplerAnimate';
type SamplerContinuous = 'surfaceSamplerCount' | 'surfaceSamplerPointSize' | 'surfaceSamplerSphereSize';

export type SurfaceProps = {
  lookMode: LookMode;
  onLookModeChange: (mode: LookMode) => void;
  material: {
    preset: string;
    onPresetChange: (id: string) => void;
    textureSlug: string | null;
    onTextureSlugChange: (slug: string | null) => void;
    textureScale: number;
    onTextureScaleChange: (value: number) => void;
    textureAmount: number;
    onTextureAmountChange: (value: number) => void;
  };
  liquid: {
    preset: string;
    onPresetChange: (id: string) => void;
    params: LiquidParams;
    onParamsScrub: (patch: Partial<LiquidParams>) => void;
    onParamsCommit: () => void;
  };
  sampler: {
    values: SurfaceSamplerValues;
    set: <K extends SamplerDiscrete>(key: K, value: Document[K]) => void;
    scrub: (key: SamplerContinuous, value: number) => void;
    commit: () => void;
  };
};

export type SceneValues = {
  lighting: string;
  background: string;
  canvas: AIRenderParams['background'];
};

export type SceneProps = {
  scene: SceneValues;
  onSceneChange: (patch: Partial<SceneValues>) => void;
  lookMode: LookMode;
  liquidBackdrop: string;
  onLiquidBackdropChange: (id: string) => void;
};

export type RenderProps = {
  session: AIRenderSession;
  canRender: boolean;
  scene: SceneValues;
  textureSlug: string | null;
  referenceName: string | null;
  onAttachReference: () => void;
  onClearReference: () => void;
  onSavePrompt: (params: AIRenderParams) => Promise<ImageStudy>;
  onApplyPrompt: (study: ImageStudy) => void;
};

export type ObjectPanelProps = {
  shape: { presets: ShapePresets; form: FormTuning };
  surface: SurfaceProps;
  scene: SceneProps;
  render: RenderProps;
};

/** Stage actions on one AI render result. */
export type RenderResultActions = {
  onExportBundle: (result: AIRenderResult, params: AIRenderParams) => void;
};
