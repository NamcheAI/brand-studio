import { useCallback, useEffect, useRef, useState } from 'react';

import {
  DEFAULT_AI_ENHANCE,
  DEFAULT_AI_METAMORPH_PARAMS,
  DEFAULT_AI_RENDER_PARAMS,
  type AIEnhanceScale,
  type AIMetamorphParams,
  type AIRenderParams,
  type AIRenderResult,
  type AISuggestResult,
} from '../../lib/ai-render-contract';
import { enhanceAIRender } from './aiRender';

/** One render of this session, with the parameters it was composed from. */
export type AIRenderEntry = {
  id: string;
  result: AIRenderResult;
  params: AIRenderParams;
};

export type AIEnhanceSettings = {
  scaleFactor: AIEnhanceScale;
  creativity: number;
  resemblance: number;
};

export type AIRenderSession = {
  params: AIRenderParams;
  setParams: (params: AIRenderParams) => void;
  patch: <K extends keyof AIRenderParams>(key: K, value: AIRenderParams[K]) => void;
  patchMetamorph: (key: keyof AIMetamorphParams, value: number) => void;
  status: 'idle' | 'rendering' | 'done' | 'error';
  error: string | null;
  suggesting: boolean;
  suggest: () => Promise<void>;
  render: () => Promise<void>;
  /** Newest first. */
  entries: AIRenderEntry[];
  selected: AIRenderEntry | null;
  select: (id: string) => void;
  /** Whether the stage shows the selected render over the live 3D view. */
  showRender: boolean;
  setShowRender: (value: boolean) => void;
  enhance: AIEnhanceSettings;
  setEnhance: (patch: Partial<AIEnhanceSettings>) => void;
  /** Id of the entry being enhanced, if any. */
  enhancingId: string | null;
  runEnhance: (id: string) => Promise<void>;
};

let nextEntryId = 0;

/**
 * The AI material render's session state, lifted out of the side panel so
 * the stage can show results large and the Render tab can unmount freely
 * when the user switches tabs mid-render.
 */
export function useAIRenders({
  onRender,
  onSuggestMetamorph,
  restoredRender,
}: {
  onRender: (params: AIRenderParams) => Promise<AIRenderResult>;
  onSuggestMetamorph: () => Promise<AISuggestResult>;
  restoredRender?: { id: string; params: AIRenderParams };
}): AIRenderSession {
  const [params, setParams] = useState<AIRenderParams>(DEFAULT_AI_RENDER_PARAMS);
  useEffect(() => {
    if (restoredRender) setParams(restoredRender.params);
  }, [restoredRender]);
  const [status, setStatus] = useState<AIRenderSession['status']>('idle');
  const [error, setError] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [entries, setEntries] = useState<AIRenderEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showRender, setShowRender] = useState(false);
  const [enhance, setEnhanceState] = useState<AIEnhanceSettings>({ ...DEFAULT_AI_ENHANCE });
  const [enhancingId, setEnhancingId] = useState<string | null>(null);

  // Async results must not update state after the Studio unmounts
  // (navigating away mid-render).
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const patch = useCallback(
    <K extends keyof AIRenderParams>(key: K, value: AIRenderParams[K]) =>
      setParams((current) => ({ ...current, [key]: value })),
    [],
  );

  const patchMetamorph = useCallback(
    (key: keyof AIMetamorphParams, value: number) =>
      setParams((current) => ({
        ...current,
        metamorph: { ...(current.metamorph ?? DEFAULT_AI_METAMORPH_PARAMS), [key]: value },
      })),
    [],
  );

  const suggest = async () => {
    setSuggesting(true);
    setError(null);
    try {
      const suggestion = await onSuggestMetamorph();
      if (!mounted.current) return;
      setParams((current) => ({
        ...current,
        metamorph: suggestion.params,
        materialDescription: suggestion.materialDescription,
        structureDescription: suggestion.structureDescription,
      }));
    } catch (suggestError) {
      if (mounted.current)
        setError(suggestError instanceof Error ? suggestError.message : 'AI suggestion failed.');
    } finally {
      if (mounted.current) setSuggesting(false);
    }
  };

  const render = async () => {
    setStatus('rendering');
    setError(null);
    const renderParams = params;
    try {
      const result = await onRender(renderParams);
      if (!mounted.current) return;
      const entry: AIRenderEntry = { id: `render-${++nextEntryId}`, result, params: renderParams };
      setEntries((current) => [entry, ...current]);
      setSelectedId(entry.id);
      // A finished render is the thing the user waited for: show it.
      setShowRender(true);
      setStatus('done');
    } catch (renderError) {
      if (!mounted.current) return;
      setError(renderError instanceof Error ? renderError.message : 'AI material render failed.');
      setStatus('error');
    }
  };

  const runEnhance = async (id: string) => {
    const entry = entries.find((candidate) => candidate.id === id);
    if (!entry) return;
    setEnhancingId(id);
    setError(null);
    try {
      const enhanced = await enhanceAIRender(
        { image: entry.result.image, ...enhance },
        entry.result.assetId,
      );
      if (!mounted.current) return;
      // The enhanced image replaces the result; prompt and request id stay
      // from the composing render, the model label records both stages.
      setEntries((current) =>
        current.map((candidate) =>
          candidate.id === id
            ? {
                ...candidate,
                result: {
                  ...candidate.result,
                  image: enhanced.image,
                  assetId: enhanced.assetId,
                  model: `${candidate.result.model} + ${enhanced.model}`,
                },
              }
            : candidate,
        ),
      );
    } catch (enhanceError) {
      if (mounted.current)
        setError(
          enhanceError instanceof Error ? enhanceError.message : 'Detail enhancement failed.',
        );
    } finally {
      if (mounted.current) setEnhancingId(null);
    }
  };

  const select = useCallback((id: string) => {
    setSelectedId(id);
    setShowRender(true);
  }, []);

  const setEnhance = useCallback(
    (next: Partial<AIEnhanceSettings>) => setEnhanceState((current) => ({ ...current, ...next })),
    [],
  );

  return {
    params,
    setParams,
    patch,
    patchMetamorph,
    status,
    error,
    suggesting,
    suggest,
    render,
    entries,
    selected: entries.find((entry) => entry.id === selectedId) ?? null,
    select,
    showRender,
    setShowRender,
    enhance,
    setEnhance,
    enhancingId,
    runEnhance,
  };
}
