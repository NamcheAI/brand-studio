import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLineIcon, ArrowUpRightIcon, ImagePlusIcon, Loader2Icon, RotateCcwIcon, SparklesIcon, XIcon } from 'lucide-react';
import { Button } from './ui/button';
import { ThemeMenu } from './theme-menu';
import { imageStyles, type ImageVariant, type ImageStudy, type ImageStudioRequest } from '../../lib/image-studio-contract';
import { AI_RENDER_SIZES, type AIRenderSize, type AIRenderQuality } from '../../lib/ai-render-contract';

const variants = Object.keys(imageStyles) as ImageVariant[];
const fieldClass = 'w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'The image studio could not complete this request.');
  return body as T;
}

export default function ImageStudio() {
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
    api<{ studies: ImageStudy[]; hasMore: boolean }>('/api/images', { signal: controller.signal })
      .then(result => {
        setStudies(result.studies);
        setHasMore(result.hasMore);
        setSelected(result.studies[0] ?? null);
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
      const study = await api<ImageStudy>('/api/images/jobs', { method: 'POST', body: JSON.stringify(request) });
      if (!alive.current) return;
      setStudies(previous => [study, ...previous]);
      setSelected(study);
    } catch (err) { if (alive.current) setError(err instanceof Error ? err.message : 'Generation failed.'); }
    finally { if (alive.current) setSubmitting(false); }
  }

  async function reuse(study: ImageStudy) {
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
      const result = await api<{ studies: ImageStudy[]; hasMore: boolean }>(`/api/images?offset=${studies.length}`);
      if (!alive.current) return;
      setStudies(previous => [...previous, ...result.studies.filter(item => !previous.some(existing => existing.id === item.id))]);
      setHasMore(result.hasMore);
    } catch (err) { if (alive.current) setError(err instanceof Error ? err.message : 'History unavailable.'); }
    finally { if (alive.current) setLoading(false); }
  }

  return <main className="image-studio min-h-svh bg-background text-foreground">
    <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b px-5 py-3 sm:px-8">
      <a href="/studio" className="flex items-center gap-3" aria-label="Namche Studio home">
        <img src="/namche-mark.svg" alt="" className="size-7 dark:invert" />
        <div><p className="font-mono text-[9px] tracking-[.2em] uppercase text-muted-foreground">Namche Studio</p><p className="font-display text-lg">Image making</p></div>
      </a>
      <nav aria-label="Studio" className="flex items-center gap-1 text-xs">
        <a className="rounded-full px-3 py-2 hover:bg-muted" href="/studio/mark">2D mark</a>
        <a className="rounded-full px-3 py-2 hover:bg-muted" href="/studio/object">3D object</a>
        <a className="rounded-full bg-foreground px-3 py-2 text-background" href="/studio/images" aria-current="page">Images</a>
        <ThemeMenu />
      </nav>
    </header>
    <div className="grid lg:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="border-b p-5 sm:p-8 lg:border-r lg:border-b-0">
        <div className="mb-7 flex items-center justify-between"><span className="image-kicker">01 / Art direction</span><SparklesIcon className="size-4 text-muted-foreground" /></div>
        <div className="mb-7 grid grid-cols-3 gap-2" role="group" aria-label="Image style">
          {variants.map((key, index) => <button key={key} aria-pressed={variant === key} onClick={() => setVariant(key)} className={`image-style-card ${variant === key ? 'is-selected' : ''}`}>
            <span className={`image-style-swatch image-style-${key}`} aria-hidden="true"><span /></span>
            <span className="mt-2 block text-[11px]">{imageStyles[key].name}</span><span className="sr-only">Style {index + 1}</span>
          </button>)}
        </div>
        <h1 className="font-display text-3xl tracking-tight">{imageStyles[variant].name}</h1>
        <p className="mt-2 mb-7 text-sm leading-relaxed text-muted-foreground">{imageStyles[variant].description}</p>
        <form onSubmit={event => { event.preventDefault(); void generate(); }} className="space-y-5">
          <label className="block"><span className="image-label">The scene</span><textarea required maxLength={6000} rows={5} className={fieldClass + ' resize-y leading-relaxed'} value={draft.scene} onChange={event => patchDraft({ scene: event.target.value })} /></label>
          <div><span className="image-label">Reference image <span className="font-normal text-muted-foreground">/ optional</span></span>
            <input ref={uploadRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Upload reference image" onChange={event => { void loadReference(event.target.files?.[0]); event.target.value = ''; }} />
            {reference ? <div className="flex items-center gap-3 rounded-lg border p-2"><img src={reference} alt="Generation reference" className="size-14 rounded object-cover" /><span className="min-w-0 flex-1 truncate text-xs">{referenceName}</span><Button type="button" size="icon-sm" variant="ghost" aria-label="Remove reference" onClick={() => { ++uploadSequence.current; setReference(undefined); }}><XIcon /></Button></div>
              : <button type="button" onClick={() => uploadRef.current?.click()} className="flex w-full items-center gap-3 rounded-lg border border-dashed px-4 py-4 text-left text-sm hover:bg-muted"><ImagePlusIcon className="size-5 text-muted-foreground" /><span>Add a starting image<span className="mt-1 block text-xs text-muted-foreground">PNG, JPG or WebP · up to 4 MB</span></span></button>}
          </div>
          <details className="rounded-lg border px-3 py-3"><summary className="cursor-pointer text-xs">Style prompt <span className="text-muted-foreground">/ editable</span></summary><label className="mt-3 block"><span className="sr-only">Style prompt</span><textarea required maxLength={6000} rows={8} className={fieldClass + ' resize-y text-xs leading-relaxed'} value={draft.style} onChange={event => patchDraft({ style: event.target.value })} /></label><button type="button" className="mt-2 text-xs underline underline-offset-4" onClick={() => patchDraft({ style: imageStyles[variant].style })}>Reset style</button></details>
          <div className="grid grid-cols-2 gap-3"><label><span className="image-label">Format</span><select className={fieldClass} value={size} onChange={event => setSize(event.target.value as AIRenderSize)}>{AI_RENDER_SIZES.map(value => <option key={value} value={value}>{value.replace('x', ' × ')}</option>)}</select></label><label><span className="image-label">Quality</span><select className={fieldClass} value={quality} onChange={event => setQuality(event.target.value as AIRenderQuality)}><option value="low">Draft</option><option value="medium">Standard</option><option value="high">High</option></select></label></div>
          <Button type="submit" className="h-12 w-full" disabled={loading || referenceLoading || submitting || running || !draft.scene.trim() || !draft.style.trim()}>{submitting || running || referenceLoading ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}{referenceLoading ? 'Loading reference…' : submitting ? 'Starting…' : running ? 'Creating your image…' : 'Generate image'}<span className="ml-auto"><ArrowUpRightIcon className="size-4" /></span></Button>
          <p className="text-center font-mono text-[10px] text-muted-foreground">GPT Image 2.5 · Saved to your history</p>
        </form>
      </aside>
      <section className="min-w-0 p-5 sm:p-8">
        {error && <div role="alert" className="mb-5 flex items-start justify-between gap-4 rounded-lg border border-destructive/40 p-4 text-sm text-destructive"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error"><XIcon className="size-4" /></button></div>}
        <div className="mb-5 flex items-center justify-between gap-3"><span className="image-kicker">02 / The image</span><span className="font-mono text-[10px] text-muted-foreground">{selected ? imageStyles[selected.variant].name : 'A study in light, colour & feeling'}</span></div>
        <div className="image-stage rounded-xl border bg-muted/30">
          {selected?.status === 'done' && selected.imageUrl ? <img className="max-h-[620px] w-full object-contain" src={selected.imageUrl} alt={selected.scene} />
            : selected?.status === 'running' ? <div className="px-8 text-center" role="status"><Loader2Icon className="mx-auto mb-5 size-8 animate-spin" /><h2 className="font-display text-3xl">Finding the light.</h2><p className="mt-3 text-sm text-muted-foreground">Your image is taking shape. You can come back to it here.</p></div>
              : selected?.status === 'error' ? <div className="max-w-md p-8 text-center" role="status"><h2 className="font-display text-2xl">This study couldn’t be completed.</h2><p className="mt-3 text-sm text-muted-foreground">{selected.error}</p><Button className="mt-5" variant="outline" onClick={() => void reuse(selected)}><RotateCcwIcon />Load settings to try again</Button></div>
                : <div className="image-empty p-8 sm:p-12"><span className="image-kicker">Namche / Image studies</span><h2 className="mt-9 font-display text-5xl tracking-tight sm:text-7xl">Give an idea<br />a feeling.</h2><p className="mt-6 max-w-sm text-sm leading-relaxed text-muted-foreground">Start with a scene. Choose its atmosphere.<br />Make something that feels unmistakably Namche.</p><div className="mt-10 flex items-center gap-3 text-xs text-muted-foreground"><span className="image-colour-dot" />{imageStyles[variant].name}<span className="ml-auto font-mono">{loading ? 'Loading history…' : 'Your next image starts here'}</span></div></div>}
        </div>
        {selected && <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="font-mono text-[10px] text-muted-foreground">{new Date(selected.createdAt).toLocaleString()} · {selected.size} · {selected.model || 'GPT Image 2.5'}</p><div className="flex gap-2"><Button variant="ghost" size="sm" onClick={() => void reuse(selected)} disabled={running || submitting}><RotateCcwIcon />Reuse settings</Button>{selected.imageUrl && <Button variant="outline" size="sm" render={<a href={selected.imageUrl} download={`namche-${selected.variant}-${selected.id}.png`} />}><ArrowDownToLineIcon />Download</Button>}</div></div>}
        {selected?.prompt && <details className="mt-3 text-xs text-muted-foreground"><summary className="cursor-pointer">Generation prompt</summary><p className="mt-3 whitespace-pre-wrap rounded-lg border p-4 leading-relaxed">{selected.prompt}</p></details>}
        <div className="mt-10 border-t pt-6"><div className="mb-5 flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-display text-xl">Your image library</h2><p className="mt-1 text-xs text-muted-foreground">Stored on the server. Private to this browser.</p></div><select aria-label="Filter image history" value={filter} onChange={event => setFilter(event.target.value as ImageVariant | 'all')} className="rounded-full border bg-background px-3 py-2 text-xs"><option value="all">All styles</option>{variants.map(key => <option key={key} value={key}>{imageStyles[key].name}</option>)}</select></div>
          {studies.length === 0 ? <p className="py-7 text-sm text-muted-foreground">{loading ? 'Loading your studies…' : 'A collection starts with one image. Your generations will appear here.'}</p> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{studies.filter(study => filter === 'all' || study.variant === filter).map(study => <button key={study.id} aria-pressed={selected?.id === study.id} onClick={() => setSelected(study)} className={`group min-w-0 overflow-hidden rounded-lg border text-left transition-colors ${selected?.id === study.id ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background' : 'hover:border-foreground/40'}`}><div className="flex aspect-[4/3] items-center justify-center bg-muted">{study.imageUrl ? <img loading="lazy" src={study.imageUrl} alt={study.scene} className="size-full object-cover" /> : study.status === 'running' ? <Loader2Icon className="size-5 animate-spin" /> : <span className="text-xs text-muted-foreground">Couldn’t generate</span>}</div><div className="p-3"><span className="block truncate text-xs">{study.scene}</span><span className="mt-1 block font-mono text-[9px] text-muted-foreground">{imageStyles[study.variant].name} · {new Date(study.createdAt).toLocaleDateString()}</span></div></button>)}</div>}
          {hasMore && <Button variant="outline" className="mt-5" disabled={loading} onClick={() => void more()}>{loading ? 'Loading…' : 'Load older images'}</Button>}
        </div>
      </section>
    </div>
  </main>;
}
