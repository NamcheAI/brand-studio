import { ArrowDownToLineIcon, Loader2Icon, RotateCcwIcon } from 'lucide-react';
import { libraryUrl } from '../../lib/asset-api';
import { imageStyles, studyLabel, type ImageStudy, type ImageVariant } from '../../../lib/image-studio-contract';
import { Button } from '../ui/button';

/**
 * Step 4 (the result): the big preview plus its status states — running,
 * saved draft, failed, or the empty invitation — and the actions that apply
 * once something has rendered. Unchanged behaviour, just split out of
 * ImageStudio so each state reads as its own small block.
 */
export function ImageStage({
  selected,
  variant,
  loading,
  running,
  submitting,
  onReuse,
}: {
  selected: ImageStudy | null;
  variant: ImageVariant;
  loading: boolean;
  running: boolean;
  submitting: boolean;
  onReuse: (study: ImageStudy) => void;
}) {
  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-3">
        <span className="image-kicker">The image</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {selected ? studyLabel(selected) : 'A study in light, colour & feeling'}
        </span>
      </div>
      <div className="image-stage rounded-xl border bg-muted/30">
        {selected?.status === 'done' && selected.imageUrl ? (
          <img className="max-h-[620px] w-full object-contain" src={selected.imageUrl} alt={selected.scene} />
        ) : selected?.status === 'running' ? (
          <div className="px-8 text-center" role="status">
            <Loader2Icon className="mx-auto mb-5 size-8 animate-spin" />
            <h2 className="font-display text-3xl">Finding the light.</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Your image is taking shape. You can come back to it here.
            </p>
          </div>
        ) : selected?.status === 'draft' ? (
          <div className="p-10">
            <span className="image-kicker">Saved prompt version</span>
            <h2 className="mt-4 font-display text-3xl">Ready for a new image.</h2>
            <p className="mt-3 text-sm text-muted-foreground">The saved settings are loaded in the editor.</p>
          </div>
        ) : selected?.status === 'error' ? (
          <div className="max-w-md p-8 text-center" role="status">
            <h2 className="font-display text-2xl">This study couldn’t be completed.</h2>
            <p className="mt-3 text-sm text-muted-foreground">{selected.error}</p>
            <Button className="mt-5" variant="outline" onClick={() => onReuse(selected)}>
              <RotateCcwIcon />
              Load settings to try again
            </Button>
          </div>
        ) : (
          <div className="image-empty p-8 sm:p-12">
            <span className="image-kicker">Namche / Image studies</span>
            <h2 className="mt-9 font-display text-5xl tracking-tight sm:text-7xl">
              Give an idea
              <br />
              a feeling.
            </h2>
            <p className="mt-6 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Start with a scene. Choose its atmosphere.
              <br />
              Make something that feels unmistakably Namche.
            </p>
            <div className="mt-10 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="image-colour-dot" />
              {imageStyles[variant].name}
              <span className="ml-auto font-mono">
                {loading ? 'Loading history…' : 'Your next image starts here'}
              </span>
            </div>
          </div>
        )}
      </div>
      {selected && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-[10px] text-muted-foreground">
            {new Date(selected.createdAt).toLocaleString()} · {selected.size} · {selected.model || 'GPT Image 2.5'}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => onReuse(selected)} disabled={running || submitting}>
              <RotateCcwIcon />
              Use these settings
            </Button>
            {selected.imageUrl && (
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<a href={selected.imageUrl} download={`namche-${selected.variant}-${selected.id}.png`} />}
              >
                <ArrowDownToLineIcon />
                Download
              </Button>
            )}
          </div>
        </div>
      )}
      {selected && (
        <div className="mt-4 flex flex-wrap gap-4 text-xs">
          <a className="underline underline-offset-4" href={libraryUrl(selected.id)}>
            Browse prompt + image combinations →
          </a>
          <a className="underline underline-offset-4" href={`/api/images/${selected.id}/bundle`} download>
            Download image & prompts
          </a>
        </div>
      )}
      {selected?.prompt && (
        <details className="mt-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer">Generation prompt</summary>
          <p className="mt-3 whitespace-pre-wrap rounded-lg border p-4 leading-relaxed">{selected.prompt}</p>
        </details>
      )}
    </>
  );
}
