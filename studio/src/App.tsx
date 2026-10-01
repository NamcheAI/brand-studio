import { serializeDocument } from './lib/persistence';
import { getStudy } from './lib/asset-api';
import type { ImageStudy } from '../lib/image-studio-contract';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import MetaballCanvas from './components/MetaballCanvas';
import Toolbar from './components/Toolbar';
import type {
  FormTuning,
  MarkPanelProps,
  ObjectPanelProps,
  RenderResultActions,
  ShapePresets,
} from './components/panels/types';
import type { FileActions } from './components/toolbar/file-menu';
import { Segmented } from './components/toolbar/segmented';
import { PlaybackBar, type Playback } from './components/stage/PlaybackBar';
import { RenderBar, RenderOverlay, RenderViewSwitch } from './components/stage/RenderStage';
import { Stage, StageChip } from './components/stage/Stage';
import { Stage3DErrorBoundary } from './components/stage/Stage3DErrorBoundary';
import { classifyStageError } from './lib/stageErrors';
import { useAIRenders } from './lib/useAIRenders';
import { Toaster } from '@/components/ui/sonner';
import { copySvgToClipboard, exportPng, exportSvg, type FlattenSpec } from './lib/export';
import {
  applyGrowthDisplay,
  buildGrowthSchedule,
  GROWTH_DURATION_MS,
  scalesAtElapsed,
  type GrowthSchedule,
} from './lib/growth';
import { applyBreakableNecks, applyMotion, type LoopMotionId } from './lib/motion';
import {
  canRedo,
  canUndo,
  createHistory,
  pushHistory,
  redoHistory,
  replacePresent,
  undoHistory,
  type HistoryState,
} from './lib/history';
import { generate } from '@namche/metaball';
import { toGenerateParams } from './lib/coreDocument';
import {
  clampOffset,
  clampRadius,
  clampSurfaceSamplerCount,
  clampSurfaceSamplerPointSize,
  clampSurfaceSamplerSphereSize,
  applyPresetShape,
  cloneDocument,
  cloneLiquidParams,
  edgeKey,
  effectiveNodeRadius,
  filterEdgeRecordByNode,
  nodeId,
  omitEdgeRecordKey,
  parseNodeId,
  presetIdForDocument,
  remapEdgeRecord,
  PRESETS,
  RADIUS_MAX,
  RADIUS_MIN,
  type Document,
  type LiquidParams,
  type LookMode,
  type NodeId,
  type PngScale,
  type Size,
} from './lib/model';
import { getLiquidPreset } from './lib/liquidPresets';
import { downloadJson, initialDocument, parseDocumentJson, saveDocument } from './lib/persistence';
import type { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import { getLiveMarchingCubes, type Canvas3DHandle } from './lib/canvas3dHandle';
import type { RefImageBytes } from './lib/exportBlenderHandoff';
import { captureShapeDataUrl, fetchTextureReference, renderAIMaterial, saveMaterialStudy, suggestMetamorphParams } from './lib/aiRender';
import { isTextureSlug, textureWebUrl } from './lib/texturePresets';
import { exportRenderBundle } from './lib/renderBundle';
import { DEFAULT_AI_RENDER_PARAMS } from '../lib/ai-render-contract';
import type { AIRenderParams, AIRenderResult } from '../lib/ai-render-contract';

// Loaded on demand: keeps three.js / react-three-fiber out of the initial
// bundle for users who only ever use the 2D editor.
const loadMetaball3DPreview = () => import('./components/Metaball3DPreview');

const SIZE_KEYS: Record<string, Size> = {
  '1': 'S',
  '2': 'M',
  '3': 'L',
  '4': 'XL',
};
const EXPORT_PREVIEW_DEBOUNCE_MS = 180;
const MOTION_FRAME_MS = 1000 / 30;

/** Best-effort file extension for a packed reference image, from its MIME type. */
function refImageExtension(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

type ViewMode = '2d' | '3d';

export default function App({ initialView = '2d' }: { initialView?: ViewMode } = {}) {
  // React.lazy caches a rejected import forever; Retry swaps in a fresh one.
  const [Metaball3DPreview, setMetaball3DPreview] = useState(() => lazy(loadMetaball3DPreview));
  const retry3dStage = useCallback((error: unknown) => {
    if (classifyStageError(error) === 'module') setMetaball3DPreview(() => lazy(loadMetaball3DPreview));
  }, []);
  const [history, setHistory] = useState<HistoryState>(() =>
    // Only a first-ever document follows the interface into the dark; after
    // that the canvas theme is the document's own, switched from Appearance.
    createHistory(
      initialDocument(document.documentElement.classList.contains('dark') ? 'night' : 'day'),
    ),
  );
  const [selected, setSelected] = useState<NodeId | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  // The view is fixed per route (/studio/mark vs /studio/object): switching
  // dimension is a navigation, not a toolbar toggle.
  const view: ViewMode = initialView;
  const [markOnly, setMarkOnly] = useState(false);
  const [pngScale, setPngScale] = useState<PngScale>(4);
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [exportPreviewPath, setExportPreviewPath] = useState<string | null>(null);
  const [customRefImage, setCustomRefImage] = useState<RefImageBytes | null>(null);
  // Scene text lives with the Studio, not inside the AI panel: it describes
  // how the object is presented, and the AI render reads it from here.
  const [sceneLighting, setSceneLighting] = useState(
    DEFAULT_AI_RENDER_PARAMS.lightingDescription,
  );
  const [sceneBackground, setSceneBackground] = useState(
    DEFAULT_AI_RENDER_PARAMS.backgroundDescription,
  );
  const [sceneCanvas, setSceneCanvas] = useState<AIRenderParams['background']>(
    DEFAULT_AI_RENDER_PARAMS.background,
  );
  const [restoredRender, setRestoredRender] = useState<{ id: string; params: AIRenderParams }>();
  const [assetParentId, setAssetParentId] = useState<string>();
  const [restoredTexture, setRestoredTexture] = useState<{ slug: string | null; reference: RefImageBytes }>();
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('asset');
    if (!id || initialView !== '3d') return;
    const controller = new AbortController();
    void (async () => {
      try {
        const study = await getStudy(id, controller.signal);
        if (!study.object) throw new Error('This asset belongs in the image studio.');
        const restored = parseDocumentJson(study.object.document);
        let reference: RefImageBytes | null = null;
        if (study.referenceUrl) {
          const response = await fetch(study.referenceUrl, { signal: controller.signal });
          if (!response.ok) throw new Error('Saved material reference is unavailable.');
          reference = { bytes: new Uint8Array(await response.arrayBuffer()), fileName: 'Saved material reference' };
        }
        if (controller.signal.aborted) return;
        setHistory(createHistory(restored));
        setRestoredRender({ id, params: study.object.params });
        setAssetParentId(id);
        setSceneLighting(study.object.params.lightingDescription);
        setSceneBackground(study.object.params.backgroundDescription);
        setSceneCanvas(study.object.params.background);
        setCustomRefImage(reference);
        if (reference) setRestoredTexture({ slug: restored.textureSlug, reference });
        toast.info('Saved settings loaded. The library retains the original camera capture; the editable preview starts with its default camera.');
      } catch (error) { if (!controller.signal.aborted) toast.error(error instanceof Error ? error.message : 'Could not restore asset.'); }
    })();
    return () => controller.abort();
  }, [initialView]);
  const [growing, setGrowing] = useState(false);
  const [growthElapsed, setGrowthElapsed] = useState(0);
  const [activeMotion, setActiveMotion] = useState<LoopMotionId | null>(null);
  const [motionElapsed, setMotionElapsed] = useState(0);
  const [breakNecks, setBreakNecks] = useState(true);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const mesh3dRef = useRef<MarchingCubes | null>(null);
  const canvas3dHandleRef = useRef<Canvas3DHandle | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);
  const refImageInputRef = useRef<HTMLInputElement | null>(null);
  const skipSave = useRef(false);
  const scrubActive = useRef(false);
  const growthRafRef = useRef<number | null>(null);
  const growthEndTimerRef = useRef<number | null>(null);
  const growthStartRef = useRef(0);
  const growthScheduleRef = useRef<GrowthSchedule | null>(null);
  const growingRef = useRef(false);
  const motionRafRef = useRef<number | null>(null);
  const motionStartRef = useRef(0);
  const motionFrameRef = useRef(0);
  const activeMotionRef = useRef<LoopMotionId | null>(null);

  const doc = history.present;
  const activePresetId = useMemo(() => presetIdForDocument(doc), [doc]);

  const endScrub = useCallback(() => {
    scrubActive.current = false;
  }, []);

  const commit = useCallback((next: Document) => {
    scrubActive.current = false;
    setHistory((prev) => pushHistory(prev, next));
  }, []);

  const patch = useCallback(
    (fn: (d: Document) => Document) => {
      commit(fn(cloneDocument(doc)));
    },
    [commit, doc],
  );

  /** Live-update during a continuous gesture; first change pushes one undo step. */
  const scrub = useCallback((fn: (d: Document) => Document) => {
    const startsGesture = !scrubActive.current;
    if (startsGesture) scrubActive.current = true;
    setHistory((prev) => {
      const next = fn(cloneDocument(prev.present));
      return startsGesture ? pushHistory(prev, next) : replacePresent(prev, next);
    });
  }, []);

  // Autosave on document change.
  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    saveDocument(doc);
  }, [doc]);

  // Drop selection if the target no longer exists (e.g. after undo/redo).
  useEffect(() => {
    setSelected((prev) => {
      if (!prev) return null;
      const { r, c } = parseNodeId(prev);
      return doc.nodes.some((node) => node.r === r && node.c === c) ? prev : null;
    });
    setSelectedEdge((prev) => {
      if (!prev) return null;
      return doc.edges.some(([a, b]) => edgeKey(a, b) === prev) ? prev : null;
    });
  }, [doc.nodes, doc.edges]);

  // Debounced export preview path (marching squares is expensive while scrubbing).
  useEffect(() => {
    if (!showExportPreview || doc.mode !== 'metaball') {
      setExportPreviewPath(null);
      return;
    }
    const handle = window.setTimeout(() => {
      const { d } = generate(toGenerateParams(doc));
      setExportPreviewPath(d || null);
    }, EXPORT_PREVIEW_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [showExportPreview, doc]);

  const selectedNode = (() => {
    if (!selected) return null;
    const { r, c } = parseNodeId(selected);
    return doc.nodes.find((node) => node.r === r && node.c === c) ?? null;
  })();

  const effectiveEdgeFactor = selectedEdge
    ? (doc.edgeFactors[selectedEdge] ?? doc.tubeFactor)
    : null;
  const edgeFactorOverridden = selectedEdge ? selectedEdge in doc.edgeFactors : false;
  const effectiveEdgePull = selectedEdge ? (doc.edgePulls[selectedEdge] ?? doc.inwardPull) : null;
  const edgePullOverridden = selectedEdge ? selectedEdge in doc.edgePulls : false;

  const selectNode = (id: NodeId | null) => {
    setSelected(id);
    setSelectedEdge(null);
  };

  const selectEdge = (key: string) => {
    setSelectedEdge(key);
    setSelected(null);
  };

  const remapEdgeFactors = (
    factors: Record<string, number>,
    from: NodeId,
    to: NodeId,
  ): Record<string, number> => remapEdgeRecord(factors, from, to);

  const addNode = (r: number, c: number) => {
    const id = nodeId(r, c);
    patch((d) => {
      if (d.nodes.some((node) => node.r === r && node.c === c)) return d;
      return { ...d, nodes: [...d.nodes, { r, c, size: 'M' }] };
    });
    selectNode(id);
  };

  const removeNode = (id: NodeId) => {
    const { r, c } = parseNodeId(id);
    patch((d) => ({
      ...d,
      nodes: d.nodes.filter((node) => !(node.r === r && node.c === c)),
      edges: d.edges.filter(([a, b]) => a !== id && b !== id),
      edgeFactors: filterEdgeRecordByNode(d.edgeFactors, id),
      edgePulls: filterEdgeRecordByNode(d.edgePulls, id),
    }));
  };

  const moveNode = (from: NodeId, toR: number, toC: number) => {
    const to = nodeId(toR, toC);
    if (from === to) return;
    patch((d) => {
      const { r, c } = parseNodeId(from);
      const node = d.nodes.find((n) => n.r === r && n.c === c);
      if (!node || d.nodes.some((n) => n.r === toR && n.c === toC)) return d;
      const moved: typeof node = { ...node, r: toR, c: toC };
      return {
        ...d,
        nodes: d.nodes.map((n) => (n.r === r && n.c === c ? moved : n)),
        edges: d.edges.map(
          ([a, b]) => [a === from ? to : a, b === from ? to : b] as [NodeId, NodeId],
        ),
        edgeFactors: remapEdgeFactors(d.edgeFactors, from, to),
        edgePulls: remapEdgeRecord(d.edgePulls, from, to),
      };
    });
    selectNode(to);
  };

  const setSelectedSize = (size: Size) => {
    if (!selected) return;
    const { r, c } = parseNodeId(selected);
    patch((d) => ({
      ...d,
      nodes: d.nodes.map((node) =>
        node.r === r && node.c === c ? { ...node, size, radius: undefined } : node,
      ),
    }));
  };

  const setSelectedRadius = (radius: number) => {
    if (!selected) return;
    const { r, c } = parseNodeId(selected);
    scrub((d) => ({
      ...d,
      nodes: d.nodes.map((node) =>
        node.r === r && node.c === c ? { ...node, radius: clampRadius(radius) } : node,
      ),
    }));
  };

  const resetSelectedRadius = () => {
    if (!selected) return;
    const { r, c } = parseNodeId(selected);
    patch((d) => ({
      ...d,
      nodes: d.nodes.map((node) =>
        node.r === r && node.c === c ? { ...node, radius: undefined } : node,
      ),
    }));
  };

  const nudgeSelected = (dx: number, dy: number) => {
    if (!selected) return;
    const { r, c } = parseNodeId(selected);
    patch((d) => ({
      ...d,
      nodes: d.nodes.map((node) => {
        if (node.r !== r || node.c !== c) return node;
        return {
          ...node,
          offsetX: clampOffset((node.offsetX ?? 0) + dx),
          offsetY: clampOffset((node.offsetY ?? 0) + dy),
        };
      }),
    }));
  };

  const toggleEdge = (a: NodeId, b: NodeId) => {
    const key = edgeKey(a, b);
    let removed = false;
    patch((d) => {
      const exists = d.edges.some(([x, y]) => edgeKey(x, y) === key);
      removed = exists;
      return {
        ...d,
        edges: exists ? d.edges.filter(([x, y]) => edgeKey(x, y) !== key) : [...d.edges, [a, b]],
        edgeFactors: exists ? omitEdgeRecordKey(d.edgeFactors, key) : d.edgeFactors,
        edgePulls: exists ? omitEdgeRecordKey(d.edgePulls, key) : d.edgePulls,
      };
    });
    if (removed) setSelectedEdge((prev) => (prev === key ? null : prev));
  };

  const setEdgeFactor = (value: number) => {
    if (!selectedEdge) return;
    scrub((d) => ({
      ...d,
      edgeFactors: { ...d.edgeFactors, [selectedEdge]: value },
    }));
  };

  const resetEdgeFactor = () => {
    if (!selectedEdge) return;
    patch((d) => {
      if (!(selectedEdge in d.edgeFactors)) return d;
      return {
        ...d,
        edgeFactors: omitEdgeRecordKey(d.edgeFactors, selectedEdge),
      };
    });
  };

  const setEdgePull = (value: number) => {
    if (!selectedEdge) return;
    scrub((d) => ({
      ...d,
      edgePulls: { ...d.edgePulls, [selectedEdge]: value },
    }));
  };

  const resetEdgePull = () => {
    if (!selectedEdge) return;
    patch((d) => {
      if (!(selectedEdge in d.edgePulls)) return d;
      return { ...d, edgePulls: omitEdgeRecordKey(d.edgePulls, selectedEdge) };
    });
  };

  const enableEdgeStyle = () => {
    if (!selectedEdge) return;
    patch((d) => ({
      ...d,
      edgeFactors: {
        ...d.edgeFactors,
        [selectedEdge]: d.edgeFactors[selectedEdge] ?? d.tubeFactor,
      },
      edgePulls: {
        ...d.edgePulls,
        [selectedEdge]: d.edgePulls[selectedEdge] ?? d.inwardPull,
      },
    }));
  };

  const disableEdgeStyle = () => {
    if (!selectedEdge) return;
    patch((d) => ({
      ...d,
      edgeFactors: omitEdgeRecordKey(d.edgeFactors, selectedEdge),
      edgePulls: omitEdgeRecordKey(d.edgePulls, selectedEdge),
    }));
  };

  const removeSelectedEdge = () => {
    if (!selectedEdge) return;
    patch((d) => ({
      ...d,
      edges: d.edges.filter(([x, y]) => edgeKey(x, y) !== selectedEdge),
      edgeFactors: omitEdgeRecordKey(d.edgeFactors, selectedEdge),
      edgePulls: omitEdgeRecordKey(d.edgePulls, selectedEdge),
    }));
  };

  const applyPreset = (id: string) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    commit(applyPresetShape(doc, preset));
    setSelected(null);
    setSelectedEdge(null);
  };

  const clear = () => {
    patch((d) => ({
      ...d,
      nodes: [],
      edges: [],
      edgeFactors: {},
      edgePulls: {},
    }));
    setSelected(null);
    setSelectedEdge(null);
  };

  const undo = () => {
    endScrub();
    setHistory((prev) => undoHistory(prev));
  };

  const redo = () => {
    endScrub();
    setHistory((prev) => redoHistory(prev));
  };

  const updateDocField = <K extends keyof Document>(key: K, value: Document[K]) => {
    patch((d) => ({ ...d, [key]: value }));
  };

  const scrubDocField = <K extends keyof Document>(key: K, value: Document[K]) => {
    scrub((d) => ({ ...d, [key]: value }));
  };

  const scrubTheme = (theme: Document['theme']) => {
    scrub((d) => ({ ...d, theme }));
  };

  const buildFlatten = (): FlattenSpec | null => {
    if (doc.mode !== 'metaball') return null;
    return {
      params: toGenerateParams(doc),
      ink: doc.theme.ink,
    };
  };

  const doExportSvg = () => {
    stopGrowth();
    stopMotion();
    // Defer so the canvas restores authored radii before serializing the SVG.
    requestAnimationFrame(() => {
      if (svgRef.current)
        exportSvg(svgRef.current, { markOnly, keepFilters: false }, buildFlatten());
    });
  };

  const doExportPng = () => {
    stopGrowth();
    stopMotion();
    requestAnimationFrame(() => {
      if (svgRef.current)
        void exportPng(svgRef.current, { markOnly, keepFilters: false }, buildFlatten(), pngScale);
    });
  };

  const doCopySvg = async () => {
    stopGrowth();
    stopMotion();
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    if (svgRef.current)
      return copySvgToClipboard(svgRef.current, { markOnly, keepFilters: false }, buildFlatten());
    return false;
  };

  const doExportJson = () => downloadJson(doc);

  const resolveLiveMesh = () =>
    mesh3dRef.current ?? canvas3dHandleRef.current?.mesh ?? getLiveMarchingCubes();

  const doExportGlb = () => {
    stopGrowth();
    stopMotion();
    requestAnimationFrame(() => {
      const mesh = resolveLiveMesh();
      if (!mesh || mesh.count === 0) {
        toast.error('Switch to 3D view and wait for the mesh to build, then try again.');
        return;
      }
      void import('./lib/export3d')
        .then(({ exportGlb }) =>
          exportGlb(
            mesh,
            doc.materialPreset,
            'metaball-mark',
            doc.lookMode === 'liquid' ? doc.liquidParams : null,
          ),
        )
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : 'GLB export failed.';
          toast.error(message);
        });
    });
  };

  const doExportBlenderHandoff = () => {
    stopGrowth();
    stopMotion();
    requestAnimationFrame(() => {
      const mesh = resolveLiveMesh();
      const handle = canvas3dHandleRef.current;
      const canvas =
        handle?.canvas ??
        (document.querySelector('.metaball-3d-canvas canvas') as HTMLCanvasElement | null);
      if (!mesh || mesh.count === 0) {
        toast.error('Switch to 3D view and wait for the mesh to build, then try again.');
        return;
      }
      if (!canvas) {
        toast.error('3D canvas is not ready yet — wait a moment and try again.');
        return;
      }
      void import('./lib/exportBlenderHandoff')
        .then(({ exportBlenderHandoff }) =>
          exportBlenderHandoff({
            source: mesh,
            materialPresetId: doc.materialPreset,
            liquidParams: doc.lookMode === 'liquid' ? doc.liquidParams : null,
            liquidPresetId: doc.lookMode === 'liquid' ? doc.liquidPreset : undefined,
            canvas,
            invalidate: handle?.invalidate,
            customRef: customRefImage,
          }),
        )
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : 'Blender handoff export failed.';
          toast.error(message);
        });
    });
  };

  const materialStudyOptions = async (params: AIRenderParams) => {
    stopGrowth();
    stopMotion();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const mesh = resolveLiveMesh();
    const handle = canvas3dHandleRef.current;
    const canvas =
      handle?.canvas ??
      (document.querySelector('.metaball-3d-canvas canvas') as HTMLCanvasElement | null);
    if (!mesh || mesh.count === 0) {
      throw new Error('Switch to 3D view and wait for the shape to build, then try again.');
    }
    if (!canvas) {
      throw new Error('The 3D canvas is not ready yet — wait a moment and try again.');
    }

    // Capture before any asynchronous reference download; subsequent editor changes
    // must not alter the image paired with this document and prompt snapshot.
    const shapeImage = captureShapeDataUrl(canvas);
    const savedDocument = serializeDocument(doc);

    // In metamorph mode the selected surface texture IS the material
    // reference — exactly the pattern picked in the dialog above, streamed
    // from the imagery CDN; a manually attached image only applies to the
    // classic material-study prompt.
    let materialReference = customRefImage;
    if (params.metamorph && restoredTexture?.slug === doc.textureSlug) {
      materialReference = restoredTexture.reference;
    } else if (params.metamorph && isTextureSlug(doc.textureSlug)) {
      materialReference = await fetchTextureReference(
        textureWebUrl(doc.textureSlug),
        `${doc.textureSlug}.webp`,
      );
    }

    return {
      shapeImage,
      document: savedDocument,
      parentId: assetParentId,
      canvas,
      params: {
        ...params,
        lightingDescription: sceneLighting,
        backgroundDescription: sceneBackground,
        background: sceneCanvas,
      },
      materialReference,
      invalidate: handle?.invalidate,
    };
  };
  const doAIRender = async (params: AIRenderParams): Promise<AIRenderResult> => renderAIMaterial(await materialStudyOptions(params));
  const doSaveAIPrompt = async (params: AIRenderParams): Promise<ImageStudy> => {
    const study = await saveMaterialStudy(await materialStudyOptions(params));
    setAssetParentId(study.id);
    return study;
  };

  const doSuggestMetamorph = async () => {
    if (!isTextureSlug(doc.textureSlug)) {
      throw new Error('Select a surface texture first.');
    }
    const reference = await fetchTextureReference(
      textureWebUrl(doc.textureSlug),
      `${doc.textureSlug}.webp`,
    );
    return suggestMetamorphParams(reference);
  };

  const doImportJson = (json: string) => {
    try {
      const imported = parseDocumentJson(json);
      skipSave.current = true;
      commit(imported);
      setSelected(null);
      setSelectedEdge(null);
    } catch {
      toast.error('Could not import JSON. Check the file format.');
    }
  };

  const keyboardRef = useRef({
    selected,
    selectedEdge,
    undo,
    redo,
    removeNode,
    removeSelectedEdge,
    nudgeSelected,
    setSelectedSize,
    selectNode,
  });
  keyboardRef.current = {
    selected,
    selectedEdge,
    undo,
    redo,
    removeNode,
    removeSelectedEdge,
    nudgeSelected,
    setSelectedSize,
    selectNode,
  };

  // Keyboard shortcuts.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      // Base UI widgets are not native form elements, so the tag check alone
      // would let canvas shortcuts fire while a slider, menu or dialog has
      // focus.
      if (
        target?.closest?.(
          'input, textarea, select, [contenteditable="true"], [role="slider"], [role="listbox"], [role="option"], [role="combobox"], [role="menu"], [role="menuitem"], [role="dialog"]',
        )
      )
        return;

      const kb = keyboardRef.current;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        kb.undo();
        return;
      }
      if (mod && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        kb.redo();
        return;
      }
      if (e.key === 'Escape') {
        kb.selectNode(null);
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !mod) {
        e.preventDefault();
        if (kb.selectedEdge) kb.removeSelectedEdge();
        else if (kb.selected) kb.removeNode(kb.selected);
        return;
      }
      if (kb.selected && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 1;
        if (e.key === 'ArrowUp') kb.nudgeSelected(0, -step);
        if (e.key === 'ArrowDown') kb.nudgeSelected(0, step);
        if (e.key === 'ArrowLeft') kb.nudgeSelected(-step, 0);
        if (e.key === 'ArrowRight') kb.nudgeSelected(step, 0);
        return;
      }
      if (kb.selected && SIZE_KEYS[e.key]) {
        e.preventDefault();
        kb.setSelectedSize(SIZE_KEYS[e.key]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const selectedRadius = selectedNode ? effectiveNodeRadius(selectedNode) : null;
  const radiusOverridden = selectedNode ? selectedNode.radius !== undefined : false;

  const stopGrowth = useCallback(() => {
    if (growthRafRef.current !== null) {
      window.cancelAnimationFrame(growthRafRef.current);
      growthRafRef.current = null;
    }
    if (growthEndTimerRef.current !== null) {
      window.clearTimeout(growthEndTimerRef.current);
      growthEndTimerRef.current = null;
    }
    growthScheduleRef.current = null;
    growingRef.current = false;
    setGrowing(false);
    setGrowthElapsed(0);
  }, []);

  const stopMotion = useCallback(() => {
    if (motionRafRef.current !== null) {
      window.cancelAnimationFrame(motionRafRef.current);
      motionRafRef.current = null;
    }
    activeMotionRef.current = null;
    setActiveMotion(null);
    setMotionElapsed(0);
  }, []);

  const startGrowth = useCallback(() => {
    if (doc.nodes.length === 0) return;
    stopMotion();
    if (growthRafRef.current !== null) {
      window.cancelAnimationFrame(growthRafRef.current);
    }
    if (growthEndTimerRef.current !== null) {
      window.clearTimeout(growthEndTimerRef.current);
      growthEndTimerRef.current = null;
    }
    const schedule = buildGrowthSchedule(doc.nodes, doc.edges);
    growthScheduleRef.current = schedule;
    growthStartRef.current = performance.now();
    growingRef.current = true;
    setGrowing(true);
    setGrowthElapsed(0);

    const tick = (now: number) => {
      const elapsed = now - growthStartRef.current;
      if (elapsed >= GROWTH_DURATION_MS) {
        setGrowthElapsed(GROWTH_DURATION_MS);
        growthRafRef.current = null;
        // Hold the finished pose briefly, then restore authored geometry.
        growthEndTimerRef.current = window.setTimeout(() => {
          growthEndTimerRef.current = null;
          growingRef.current = false;
          setGrowing(false);
          setGrowthElapsed(0);
          growthScheduleRef.current = null;
        }, 200);
        return;
      }
      setGrowthElapsed(elapsed);
      growthRafRef.current = window.requestAnimationFrame(tick);
    };
    growthRafRef.current = window.requestAnimationFrame(tick);
  }, [doc.nodes, doc.edges, stopMotion]);

  const startMotion = useCallback(
    (id: LoopMotionId) => {
      if (doc.nodes.length === 0) return;
      stopGrowth();
      if (motionRafRef.current !== null) {
        window.cancelAnimationFrame(motionRafRef.current);
      }
      motionStartRef.current = performance.now();
      motionFrameRef.current = 0;
      activeMotionRef.current = id;
      setActiveMotion(id);
      setMotionElapsed(0);

      const tick = (now: number) => {
        if (activeMotionRef.current !== id) return;
        if (now - motionFrameRef.current >= MOTION_FRAME_MS) {
          motionFrameRef.current = now;
          setMotionElapsed(now - motionStartRef.current);
        }
        motionRafRef.current = window.requestAnimationFrame(tick);
      };
      motionRafRef.current = window.requestAnimationFrame(tick);
    },
    [doc.nodes.length, stopGrowth],
  );

  const toggleGrowth = useCallback(() => {
    if (growing) stopGrowth();
    else startGrowth();
  }, [growing, startGrowth, stopGrowth]);

  const toggleMotion = useCallback(
    (id: LoopMotionId) => {
      if (activeMotion === id) stopMotion();
      else startMotion(id);
    },
    [activeMotion, startMotion, stopMotion],
  );

  // Cancel playback if the authored graph changes mid-playback.
  useEffect(() => {
    if (growingRef.current) stopGrowth();
    if (activeMotionRef.current) stopMotion();
  }, [doc.nodes, doc.edges, stopGrowth, stopMotion]);

  useEffect(
    () => () => {
      if (growthRafRef.current !== null) window.cancelAnimationFrame(growthRafRef.current);
      if (growthEndTimerRef.current !== null) window.clearTimeout(growthEndTimerRef.current);
      if (motionRafRef.current !== null) window.cancelAnimationFrame(motionRafRef.current);
    },
    [],
  );

  const displayGeometry = useMemo(() => {
    if (growing && growthScheduleRef.current) {
      const scales = scalesAtElapsed(growthScheduleRef.current, growthElapsed);
      return {
        ...applyGrowthDisplay(doc.nodes, doc.edges, scales),
        style: null,
        evaporate: 0,
      };
    }
    if (activeMotion) {
      let styled = applyMotion(activeMotion, doc, motionElapsed);
      if (breakNecks) styled = applyBreakableNecks(doc, styled, motionElapsed);
      return {
        nodes: styled.nodes,
        edges: styled.edges,
        style: styled,
        evaporate: styled.evaporate ?? 0,
      };
    }
    return {
      nodes: doc.nodes,
      edges: doc.edges,
      style: null,
      evaporate: 0,
    };
  }, [growing, growthElapsed, activeMotion, motionElapsed, breakNecks, doc]);

  const displayDoc = useMemo((): Document => {
    const style = displayGeometry.style;
    const evaporate = displayGeometry.evaporate;
    const liquidParams =
      evaporate > 0.01
        ? {
            ...doc.liquidParams,
            bloom: Math.min(1, doc.liquidParams.bloom + evaporate * 0.25),
            opacity: Math.max(0.05, doc.liquidParams.opacity * (1 - evaporate * 0.55)),
          }
        : doc.liquidParams;
    return {
      ...doc,
      nodes: displayGeometry.nodes,
      edges: displayGeometry.edges,
      liquidParams,
      ...(style
        ? {
            tubeFactor: style.tubeFactor,
            inwardPull: style.inwardPull,
            gooStd: style.gooStd,
            edgeFactors: style.edgeFactors,
            edgePulls: style.edgePulls,
          }
        : null),
    };
  }, [doc, displayGeometry]);

  const canonical2dPath = useMemo(() => {
    if (displayDoc.mode !== 'metaball') return null;
    const params = toGenerateParams(displayDoc);
    return params.preset === 'brandmark' ? generate(params).d : null;
  }, [displayDoc]);

  const ai = useAIRenders({
    onRender: doAIRender,
    onSuggestMetamorph: doSuggestMetamorph,
    restoredRender,
  });

  // An edit to the object while a render covers the stage would change
  // nothing visible, so any document change falls back to the live view.
  const { setShowRender } = ai;
  useEffect(() => {
    setShowRender(false);
  }, [doc, setShowRender]);

  const formTuning: FormTuning = {
    values: {
      tubeFactor: doc.tubeFactor,
      gooStd: doc.gooStd,
      gooThreshold: doc.gooThreshold,
      inwardPull: doc.inwardPull,
    },
    scrub: (key, value) => scrubDocField(key, value),
    commit: endScrub,
  };
  const presets: ShapePresets = { activePresetId, onApply: applyPreset };

  const playback: Playback = {
    growing,
    canGrow: doc.nodes.length > 0,
    onGrowToggle: toggleGrowth,
    activeMotion,
    canMotion: doc.nodes.length > 0,
    onMotionToggle: toggleMotion,
    breakNecks,
    onBreakNecksChange: setBreakNecks,
  };

  const historyActions = {
    canUndo: canUndo(history),
    canRedo: canRedo(history),
    onUndo: undo,
    onRedo: redo,
  };

  const fileActions: FileActions = {
    onImportJson: () => importRef.current?.click(),
    onExportJson: doExportJson,
    onClear: clear,
    ...(view === '3d'
      ? { onExportGlb: doExportGlb, onExportBlender: doExportBlenderHandoff }
      : null),
  };

  const markPanel = (): MarkPanelProps => ({
    selectionId: selected ?? selectedEdge,
    shape: {
      mode: doc.mode,
      presets,
      form: formTuning,
      node: selectedNode
        ? {
            size: selectedNode.size,
            radius: selectedRadius,
            radiusOverridden,
            radiusMin: RADIUS_MIN,
            radiusMax: RADIUS_MAX,
            onSizeChange: setSelectedSize,
            onRadiusChange: setSelectedRadius,
            onRadiusCommit: endScrub,
            onRadiusReset: resetSelectedRadius,
            onDelete: () => selected && removeNode(selected),
          }
        : null,
      edge:
        selectedEdge && effectiveEdgeFactor !== null && effectiveEdgePull !== null
          ? {
              factor: effectiveEdgeFactor,
              factorOverridden: edgeFactorOverridden,
              pull: effectiveEdgePull,
              pullOverridden: edgePullOverridden,
              onFactorChange: setEdgeFactor,
              onFactorCommit: endScrub,
              onFactorReset: resetEdgeFactor,
              onPullChange: setEdgePull,
              onPullCommit: endScrub,
              onPullReset: resetEdgePull,
              onEnableStyle: enableEdgeStyle,
              onDisableStyle: disableEdgeStyle,
              onRemove: removeSelectedEdge,
            }
          : null,
      fullGrid: doc.fullGrid,
      onFullGridChange: (v) => updateDocField('fullGrid', v),
    },
    style: {
      theme: doc.theme,
      onThemeChange: scrubTheme,
      onThemeCommit: endScrub,
      rasterEnabled: doc.rasterEnabled,
      onRasterEnabledChange: (v) => updateDocField('rasterEnabled', v),
    },
    export: {
      mode: doc.mode,
      markOnly,
      onMarkOnlyChange: setMarkOnly,
      pngScale,
      onPngScaleChange: setPngScale,
      onExportSvg: doExportSvg,
      onExportPng: doExportPng,
      onCopySvg: doCopySvg,
      showExportPreview,
      onShowExportPreviewChange: setShowExportPreview,
      flattenEpsilon: doc.flattenEpsilon,
      flattenResolution: doc.flattenResolution,
      onFlattenScrub: (key, value) => scrubDocField(key, value),
      onFlattenCommit: endScrub,
    },
  });

  const scene = { lighting: sceneLighting, background: sceneBackground, canvas: sceneCanvas };

  const objectPanel = (): ObjectPanelProps => ({
    shape: { presets, form: formTuning },
    surface: {
      lookMode: doc.lookMode,
      onLookModeChange: (mode: LookMode) => updateDocField('lookMode', mode),
      material: {
        preset: doc.materialPreset,
        onPresetChange: (id) => updateDocField('materialPreset', id),
        textureSlug: doc.textureSlug,
        onTextureSlugChange: (slug) => updateDocField('textureSlug', slug),
        textureScale: doc.textureScale,
        onTextureScaleChange: (value) => updateDocField('textureScale', value),
        textureAmount: doc.textureAmount,
        onTextureAmountChange: (value) => updateDocField('textureAmount', value),
      },
      liquid: {
        preset: doc.liquidPreset,
        onPresetChange: (id) => {
          const preset = getLiquidPreset(id);
          commit({
            ...cloneDocument(doc),
            liquidPreset: preset.id,
            liquidParams: cloneLiquidParams(preset.params),
            lookMode: 'liquid',
          });
        },
        params: doc.liquidParams,
        onParamsScrub: (patch: Partial<LiquidParams>) =>
          scrub((d) => ({
            ...d,
            lookMode: 'liquid',
            liquidParams: { ...d.liquidParams, ...patch },
          })),
        onParamsCommit: endScrub,
      },
      sampler: {
        values: {
          surfaceSamplerEnabled: doc.surfaceSamplerEnabled,
          surfaceSamplerMode: doc.surfaceSamplerMode,
          surfaceSamplerCount: doc.surfaceSamplerCount,
          surfaceSamplerPointSize: doc.surfaceSamplerPointSize,
          surfaceSamplerSphereSize: doc.surfaceSamplerSphereSize,
          surfaceSamplerShowMesh: doc.surfaceSamplerShowMesh,
          surfaceSamplerAnimate: doc.surfaceSamplerAnimate,
        },
        set: (key, value) => updateDocField(key, value),
        scrub: (key, value) =>
          scrubDocField(
            key,
            key === 'surfaceSamplerCount'
              ? clampSurfaceSamplerCount(value)
              : key === 'surfaceSamplerPointSize'
                ? clampSurfaceSamplerPointSize(value)
                : clampSurfaceSamplerSphereSize(value),
          ),
        commit: endScrub,
      },
    },
    scene: {
      scene,
      onSceneChange: (next) => {
        if (next.lighting !== undefined) setSceneLighting(next.lighting);
        if (next.background !== undefined) setSceneBackground(next.background);
        if (next.canvas !== undefined) setSceneCanvas(next.canvas);
      },
      lookMode: doc.lookMode,
      liquidBackdrop: doc.liquidBackdrop,
      onLiquidBackdropChange: (id) => updateDocField('liquidBackdrop', id),
    },
    render: {
      session: ai,
      canRender: view === '3d',
      scene,
      textureSlug: doc.textureSlug,
      referenceName: customRefImage?.fileName ?? null,
      onAttachReference: () => refImageInputRef.current?.click(),
      onClearReference: () => {
        setCustomRefImage(null);
        setRestoredTexture(undefined);
      },
      onSavePrompt: doSaveAIPrompt,
      onApplyPrompt: (study) => {
        if (!study.object) return;
        setAssetParentId(study.id);
        setSceneLighting(study.object.params.lightingDescription);
        setSceneBackground(study.object.params.backgroundDescription);
        setSceneCanvas(study.object.params.background);
      },
    },
  });

  const renderActions: RenderResultActions = {
    onExportBundle: (result: AIRenderResult, params: AIRenderParams) =>
      exportRenderBundle({
        result,
        params: {
          ...params,
          lightingDescription: sceneLighting,
          backgroundDescription: sceneBackground,
          background: sceneCanvas,
        },
        doc,
        textureSlug: doc.textureSlug,
        referenceName: customRefImage?.fileName ?? null,
      }),
  };

  const showingRender = view === '3d' && ai.showRender && ai.selected !== null;

  return (
    <>
      <div className="grid h-dvh grid-cols-1 grid-rows-[3.5rem_auto_1fr] overflow-hidden md:grid-cols-[340px_1fr] md:grid-rows-[3.5rem_1fr]">
        {view === '2d' ? (
          <Toolbar view="2d" history={historyActions} file={fileActions} panel={markPanel()} />
        ) : (
          <Toolbar view="3d" history={historyActions} file={fileActions} panel={objectPanel()} />
        )}

        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === 'string') doImportJson(reader.result);
            };
            reader.readAsText(file);
            e.target.value = '';
          }}
        />

        <input
          ref={refImageInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            void file.arrayBuffer().then((buf) => {
              const fileName = `ref.${refImageExtension(file.type)}`;
              setCustomRefImage({ bytes: new Uint8Array(buf), fileName });
            });
          }}
        />

        <Stage
          style={{
            background: view === '2d' && doc.rasterEnabled ? doc.theme.bg : undefined,
          }}
          top={
            view === '2d' ? (
              <StageChip>
                <Segmented
                  label="2D canvas mode"
                  value={doc.mode}
                  onValueChange={(mode) => updateDocField('mode', mode)}
                  className="w-auto"
                  options={[
                    { value: 'metaball', label: 'Form', hint: 'Style and export the mark.' },
                    { value: 'graph', label: 'Graph', hint: 'Inspect and edit its network.' },
                  ]}
                />
              </StageChip>
            ) : ai.selected || ai.status === 'rendering' ? (
              <RenderViewSwitch session={ai} />
            ) : null
          }
          bottom={
            showingRender ? (
              <RenderBar session={ai} actions={renderActions} />
            ) : (
              <PlaybackBar playback={playback} />
            )
          }
          overlay={view === '3d' ? <RenderOverlay session={ai} /> : null}
        >
          {view === '3d' ? (
            <Stage3DErrorBoundary
              lookMode={doc.lookMode}
              onRetry={retry3dStage}
              onUseOrganic={() => updateDocField('lookMode', 'material')}
            >
              <Suspense
                fallback={
                  <div className="flex size-full items-center justify-center gap-2 font-mono text-xs tracking-wide text-muted-foreground uppercase">
                    <Loader2Icon className="size-4 animate-spin" />
                    Loading 3D…
                  </div>
                }
              >
                {/* Stays mounted under a shown render: AI renders capture this
                    canvas, and switching back to Live 3D must be instant. */}
                <Metaball3DPreview
                  doc={displayDoc}
                  meshRef={mesh3dRef}
                  canvasHandleRef={canvas3dHandleRef}
                  // Playback state is already capped at 30 fps. Rebuild immediately for each
                  // emitted state so a trailing debounce cannot be starved by the same cadence.
                  fieldDebounceMs={growing || activeMotion !== null ? 0 : undefined}
                  continuous={activeMotion !== null || doc.lookMode === 'liquid'}
                />
              </Suspense>
            </Stage3DErrorBoundary>
          ) : (
            <MetaballCanvas
              ref={svgRef}
              mode={doc.mode}
              nodes={displayDoc.nodes}
              edges={displayDoc.edges}
              theme={doc.theme}
              showGrid={doc.rasterEnabled}
              fullGrid={doc.fullGrid}
              gooStd={displayDoc.gooStd}
              gooThreshold={doc.gooThreshold}
              tubeFactor={displayDoc.tubeFactor}
              inwardPull={displayDoc.inwardPull}
              edgeFactors={displayDoc.edgeFactors}
              edgePulls={displayDoc.edgePulls}
              selected={selected}
              selectedEdge={selectedEdge}
              canonicalPath={canonical2dPath}
              exportPreviewPath={exportPreviewPath}
              onAddNode={addNode}
              onSelect={selectNode}
              onSelectEdge={selectEdge}
              onToggleEdge={toggleEdge}
              onRemoveNode={removeNode}
              onMoveNode={moveNode}
            />
          )}
        </Stage>
      </div>

      <Toaster position="bottom-right" />
    </>
  );
}
