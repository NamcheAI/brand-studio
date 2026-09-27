import { useEffect, useRef, useState } from 'react';
import { Loader2Icon, SparklesIcon, XIcon } from 'lucide-react';
import { PromptAssistant } from './PromptAssistant';
import { StylePicker } from './images/StylePicker';
import { ReferenceField } from './images/ReferenceField';
import { ImageStage } from './images/ImageStage';
import { RecentImages } from './images/RecentImages';
import { getStudy, repeatStudy } from '../lib/asset-api';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Disclosure, Expert } from './toolbar/disclosure';
import { SelectField } from './toolbar/fields';
import { StudioAppBar } from './shell/StudioAppBar';
import { imageStyles, type ImageVariant, type ImageStudy, type ImageStudioRequest } from '../../lib/image-studio-contract';
import { AI_RENDER_SIZES, type AIRenderSize, type AIRenderQuality } from '../../lib/ai-render-contract';

const variants = Object.keys(imageStyles) as ImageVariant[];
const sizeOptions = AI_RENDER_SIZES.map((value) => ({ value, label: value.replace('x', ' × ') }));
const qualityOptions: ReadonlyArray<{ value: AIRenderQuality; label: string }> = [
  { value: 'low', label: 'Draft' },
  { value: 'medium', label: 'Standard' },
  { value: 'high', label: 'High' },
];

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'The image studio could not complete this request.');
  return body as T;
}

/**
 * The Images workspace: style → content prompt → optional reference →
 * generate, everything else behind collapsed disclosures. The left panel is
 * a numbered flow instead of a page-length form so the primary action
 * ("Generate image") reads as the destination, not something to scroll for.
 */
export default function ImageStudio() {
  const [parentId, setParentId] = useState<string>();
  const [variant, setVariant] = useState<ImageVariant>('hestia-field');
  const [drafts, setDrafts] = useState(() => Object.fromEntries(variants.map(key => [key, { scene: imageStyles[key].scene as string, style: imageStyles[key].style as string }])) as Record<ImageVariant, { scene: string; style: string }>);
  const [size, setSize] = useState<AIRenderSize>('1024x1536');
  const [quality, setQuality] = useState<AIRenderQuality>('high');
  const [reference, setReference] = useState<string>();
  const [referenceName, setReferenceName] = useState('');
  const [referenceLoading, setReferenceLoading] = useState(false);
  const [studies, setStudies] = useState<ImageStudy[]>([]);
  const [selected, setSelected] = useState<ImageStudy | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<ImageVariant | 'all'>('all');
  const alive = useRef(true);
  const uploadSequence = useRef(0);
  const uploadRef = useRef<HTMLInputElement>(null);
  const draft = drafts[variant];
  const running = studies.some(study => study.status === 'running');

  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    api<{ studies: ImageStudy[]; hasMore: boolean }>('/api/images?studio=images&status=images', { signal: controller.signal })
      .then(result => {
        setStudies(result.studies);
        setHasMore(result.hasMore);
        setSelected(result.studies[0] ?? null);
        const sourceId = new URLSearchParams(location.search).get('asset');
        if (sourceId) void getStudy(sourceId, controller.signal).then(study => {
          if (controller.signal.aborted) return;
          if (study.object) throw new Error('This asset belongs in the 3D studio.');
          setSelected(study); void reuse(study);
        }).catch(err => { if (!controller.signal.aborted) setError(err.message); });
      })
      .catch(err => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { alive.current = false; controller.abort(); };
  }, []);

  useEffect(() => {
    if (!running) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const updates = await Promise.all(studies.filter(item => item.status === 'running').map(item => api<ImageStudy>(`/api/images/jobs/${item.id}`, { signal: controller.signal })));
        if (controller.signal.aborted) return;
        setStudies(previous => previous.map(item => updates.find(update => update.id === item.id) ?? item));
        setSelected(previous => updates.find(update => update.id === previous?.id) ?? previous);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Could not refresh generation status.');
      }
      if (!controller.signal.aborted) timer = setTimeout(poll, 2500);
    };
    timer = setTimeout(poll, 2000);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [running, studies]);

  function patchDraft(patch: Partial<typeof draft>) {
    setDrafts(previous => ({ ...previous, [variant]: { ...previous[variant], ...patch } }));
  }

  async function loadReference(file?: File, sequence = ++uploadSequence.current) {
    if (!file) return;
    setError('');
    setReferenceLoading(false);
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) {
      setError('Choose a PNG, JPEG or WebP image up to 4 MB.');
      return;
    }
    setReferenceLoading(true);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read this image.'));
        reader.readAsDataURL(file);
      });
      if (alive.current && sequence === uploadSequence.current) { setReference(data); setReferenceName(file.name); }
    } catch (err) { if (alive.current && sequence === uploadSequence.current) setError(String(err)); }
    finally { if (alive.current && sequence === uploadSequence.current) setReferenceLoading(false); }
  }

  async function generate() {
    if (submitting || running || referenceLoading) return;
    setSubmitting(true);
    setError('');
    try {
      const request: ImageStudioRequest = { variant, ...draft, size, quality, referenceImage: reference };
      const version = await api<ImageStudy>('/api/images/drafts', { method: 'POST', body: JSON.stringify({ ...request, parentId }) });
      const study = await repeatStudy(version.id);
      setParentId(version.id);
      if (!alive.current) return;
      setStudies(previous => [study, ...previous]);
      setSelected(study);
    } catch (err) { if (alive.current) setError(err instanceof Error ? err.message : 'Generation failed.'); }
    finally { if (alive.current) setSubmitting(false); }
  }

  async function reuse(study: ImageStudy) {
    if (study.variant === 'metaball' || study.object) { setError('Open this asset in the 3D studio.'); return; }
    setParentId(study.id);
    setVariant(study.variant);
    setDrafts(previous => ({ ...previous, [study.variant]: { scene: study.scene, style: study.style } }));
    setSize(study.size);
    setQuality(study.quality);
    setReference(undefined);
    setReferenceName('');
    const sequence = ++uploadSequence.current;
    setReferenceLoading(Boolean(study.referenceUrl));
    if (study.referenceUrl) {
      try {
        const response = await fetch(study.referenceUrl);
        if (!response.ok) throw new Error('The saved reference could not be loaded.');
        const blob = await response.blob();
        if (!alive.current || sequence !== uploadSequence.current) return;
        await loadReference(new File([blob], 'Saved reference', { type: blob.type }), sequence);
      } catch (err) { if (alive.current && sequence === uploadSequence.current) setError(err instanceof Error ? err.message : 'Reference unavailable.'); }
      finally { if (alive.current && sequence === uploadSequence.current) setReferenceLoading(false); }
    }
  }

  async function more() {
    setLoading(true);
    try {
      const result = await api<{ studies: ImageStudy[]; hasMore: boolean }>(`/api/images?studio=images&status=images&offset=${studies.length}`);
      if (!alive.current) return;
      setStudies(previous => [...previous, ...result.studies.filter(item => !previous.some(existing => existing.id === item.id))]);
      setHasMore(result.hasMore);
    } catch (err) { if (alive.current) setError(err instanceof Error ? err.message : 'History unavailable.'); }
    finally { if (alive.current) setLoading(false); }
  }

  const canGenerate = !loading && !referenceLoading && !submitting && !running && Boolean(draft.scene.trim()) && Boolean(draft.style.trim());
  const statusLabel = referenceLoading ? 'Loading reference…' : submitting ? 'Starting…' : running ? 'Creating your image…' : 'GPT Image 2.5 · Saved to your history';

  return (
    <main className="image-studio min-h-svh bg-background text-foreground">
      <StudioAppBar active="images" />
      <div className="grid lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="border-b lg:flex lg:h-[calc(100svh-3.5rem)] lg:flex-col lg:overflow-hidden lg:border-r lg:border-b-0">
          {/* The scrollable part of the flow: everything up to (but not
              including) the primary action, so "Generate image" itself
              never has to be scrolled to on a tall lg+ panel. */}
          <form
            id="image-studio-form"
            onSubmit={event => { event.preventDefault(); void generate(); }}
            className="flex-1 space-y-7 p-5 sm:p-8 lg:overflow-y-auto"
          >
            <section>
              <span className="image-kicker">1 · Style</span>
              <div className="mt-3"><StylePicker value={variant} onValueChange={setVariant} /></div>
            </section>

            <section>
              <span className="image-kicker">2 · Content</span>
              <label className="mt-3 block">
                <span className="sr-only">Content prompt</span>
                <Textarea
                  required
                  maxLength={6000}
                  rows={5}
                  className="text-sm leading-relaxed"
                  value={draft.scene}
                  onChange={event => patchDraft({ scene: event.target.value })}
                />
              </label>
            </section>

            <section>
              <span className="image-kicker">3 · Reference · optional</span>
              <div className="mt-3">
                <ReferenceField
                  uploadRef={uploadRef}
                  reference={reference}
                  referenceName={referenceName}
                  onSelectFile={file => void loadReference(file)}
                  onRemove={() => { ++uploadSequence.current; setReferenceLoading(false); setReference(undefined); }}
                />
              </div>
            </section>

            <Disclosure label="Refine with AI">
              <PromptAssistant
                key={variant}
                disabled={referenceLoading || submitting || running || loading}
                onSnapshot={async () => {
                  const study = await api<ImageStudy>('/api/images/drafts', { method: 'POST', body: JSON.stringify({ variant, ...draft, size, quality, referenceImage: reference, parentId }) });
                  if (alive.current) setParentId(study.id);
                  return study;
                }}
                onApply={study => void reuse(study)}
              />
            </Disclosure>

            <Expert>
              <div>
                <span className="image-label">Scenic prompt <span className="font-normal text-muted-foreground">/ editable</span></span>
                <Textarea
                  required
                  maxLength={6000}
                  rows={8}
                  className="text-xs leading-relaxed"
                  value={draft.style}
                  onChange={event => patchDraft({ style: event.target.value })}
                />
                <button type="button" className="mt-2 text-xs underline underline-offset-4" onClick={() => patchDraft({ style: imageStyles[variant].style })}>
                  Reset style
                </button>
              </div>
              <SelectField label="Format" value={size} options={sizeOptions} onValueChange={setSize} />
              <SelectField label="Quality" value={quality} options={qualityOptions} onValueChange={setQuality} />
            </Expert>
          </form>

          {/* Outside the scroll container on purpose: the primary action
              stays visible on lg+ instead of living at the bottom of a
              1,400px form. */}
          <div className="border-t p-5 sm:p-8 lg:pt-4">
            <Button type="submit" form="image-studio-form" className="h-12 w-full" disabled={!canGenerate}>
              {submitting || running || referenceLoading ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
              {running ? 'Creating your image…' : submitting ? 'Starting…' : referenceLoading ? 'Loading reference…' : 'Generate image'}
            </Button>
            <p className="mt-3 text-center font-mono text-[10px] text-muted-foreground">{statusLabel}</p>
          </div>
        </aside>

        <section className="min-w-0 p-5 sm:p-8">
          {error && (
            <div role="alert" className="mb-5 flex items-start justify-between gap-4 rounded-lg border border-destructive/40 p-4 text-sm text-destructive">
              <span>{error}</span>
              <button onClick={() => setError('')} aria-label="Dismiss error"><XIcon className="size-4" /></button>
            </div>
          )}
          <ImageStage
            selected={selected}
            variant={variant}
            loading={loading}
            running={running}
            submitting={submitting}
            onReuse={study => void reuse(study)}
          />
          <RecentImages
            studies={studies}
            selectedId={selected?.id}
            loading={loading}
            hasMore={hasMore}
            filter={filter}
            onFilterChange={setFilter}
            onSelect={setSelected}
            onLoadMore={() => void more()}
          />
        </section>
      </div>
    </main>
  );
}
