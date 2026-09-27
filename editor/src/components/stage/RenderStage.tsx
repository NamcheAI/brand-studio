import { DownloadIcon, Loader2Icon, MaximizeIcon, PackageIcon, LibraryIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Segmented } from '../toolbar/segmented';
import { StageChip } from './Stage';
import { libraryUrl } from '../../lib/asset-api';
import { downloadAIRender } from '../../lib/aiRender';
import type { AIRenderSession } from '../../lib/useAIRenders';
import { AI_ENHANCE_SCALES, type AIEnhanceScale } from '../../../lib/ai-render-contract';
import type { RenderResultActions } from '../panels/types';

/** Top-left stage switch between the live 3D view and the selected render. */
export function RenderViewSwitch({ session }: { session: AIRenderSession }) {
  if (!session.selected && session.status !== 'rendering') return null;
  return (
    <>
      {session.selected && (
        <StageChip>
          <Segmented
            label="Stage view"
            value={session.showRender ? 'render' : 'live'}
            onValueChange={(next) => session.setShowRender(next === 'render')}
            className="w-auto"
            options={[
              { value: 'live', label: 'Live 3D', hint: 'Orbit the object; renders use this view.' },
              { value: 'render', label: 'Render', hint: 'The selected AI render.' },
            ]}
          />
        </StageChip>
      )}
      {session.status === 'rendering' && (
        <span className="flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 font-mono text-[0.625rem] tracking-wide text-muted-foreground uppercase shadow-sm ring-1 ring-foreground/10">
          <Loader2Icon className="size-3 animate-spin" />
          Rendering…
        </span>
      )}
    </>
  );
}

/**
 * The selected render drawn over the square. The live canvas stays mounted
 * underneath: rendering captures it, and switching back must be instant.
 */
export function RenderOverlay({ session }: { session: AIRenderSession }) {
  const entry = session.selected;
  if (!entry || !session.showRender) return null;
  const enhancing = session.enhancingId === entry.id;
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted">
      <img
        src={entry.result.image}
        alt="AI-rendered material study of the mark"
        className="size-full object-contain"
      />
      {enhancing && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[1px]">
          <span className="flex items-center gap-2 rounded-full bg-background px-3 py-1.5 font-mono text-xs tracking-wide uppercase shadow">
            <Loader2Icon className="size-4 animate-spin" />
            Making it bigger…
          </span>
        </div>
      )}
    </div>
  );
}

/** Bottom bar while a render is shown: export it, or make it bigger. */
export function RenderBar({
  session,
  actions,
}: {
  session: AIRenderSession;
  actions: RenderResultActions;
}) {
  const entry = session.selected;
  if (!entry) return null;
  const enhancing = session.enhancingId === entry.id;
  const { result } = entry;
  return (
    <div role="group" aria-label="Render actions" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* Compose small, then re-synthesize micro-detail at scale — the
            role Magnific played in the original Weave graph. */}
        <Button
          size="sm"
          disabled={enhancing}
          onClick={() => void session.runEnhance(entry.id)}
        >
          {enhancing ? (
            <Loader2Icon data-icon="inline-start" className="animate-spin" />
          ) : (
            <MaximizeIcon data-icon="inline-start" />
          )}
          {enhancing ? 'Enhancing…' : 'Make it bigger'}
        </Button>
        <Segmented
          label="Enhance scale"
          value={String(session.enhance.scaleFactor) as '2' | '4'}
          disabled={enhancing}
          onValueChange={(value) =>
            session.setEnhance({ scaleFactor: Number(value) as AIEnhanceScale })
          }
          className="w-auto"
          options={AI_ENHANCE_SCALES.map((scale) => ({
            value: String(scale) as '2' | '4',
            label: `${scale}×`,
          }))}
        />

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            aria-label="Download image"
            title="Download image"
            onClick={() => downloadAIRender(result)}
          >
            <DownloadIcon data-icon="inline-start" />
            <span className="hidden sm:inline">Image</span>
          </Button>
          {result.assetId ? (
            <Button
              nativeButton={false}
              variant="outline"
              size="sm"
              aria-label="Download bundle"
              title="Download bundle (image + prompt + document)"
              render={<a href={`/api/images/${result.assetId}/bundle`} download />}
            >
              <PackageIcon data-icon="inline-start" />
              <span className="hidden sm:inline">Bundle</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              aria-label="Download bundle"
              title="Download bundle (image + prompt + document)"
              onClick={() => actions.onExportBundle(result, entry.params)}
            >
              <PackageIcon data-icon="inline-start" />
              <span className="hidden sm:inline">Bundle</span>
            </Button>
          )}
          {result.assetId && (
            <Button
              nativeButton={false}
              variant="ghost"
              size="sm"
              aria-label="Open in library"
              title="Open in library"
              render={<a href={libraryUrl(result.assetId)} />}
            >
              <LibraryIcon data-icon="inline-start" />
              <span className="hidden sm:inline">Library</span>
            </Button>
          )}
        </div>
      </div>
      {/* The model label is provenance, not an action: desktop only. */}
      <div
        className={cn(
          'items-center justify-between gap-2',
          session.error ? 'flex' : 'hidden sm:flex',
        )}
      >
        <span className="hidden truncate font-mono text-[0.625rem] text-muted-foreground sm:inline">
          {result.model}
        </span>
        {session.error && (
          <span className="truncate text-xs text-destructive" role="alert">
            {session.error}
          </span>
        )}
      </div>
    </div>
  );
}
