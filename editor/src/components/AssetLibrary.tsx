import { useEffect, useRef, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, Loader2Icon } from 'lucide-react';
import { imageStyles, studyLabel, type ImageStudy } from '../../lib/image-studio-contract';
import { assetApi, getStudy, libraryUrl, repeatStudy } from '../lib/asset-api';
import { Button } from './ui/button';
import { ThemeMenu } from './theme-menu';

type Page = { studies: ImageStudy[]; hasMore: boolean };
const selectClass = 'rounded-full border bg-background px-3 py-2 text-xs';
export default function AssetLibrary() {
  const [studio, setStudio] = useState(new URLSearchParams(location.search).get('studio') === 'object' ? 'object' : '');
  const [status, setStatus] = useState('');
  const [theme, setTheme] = useState('');
  const [search, setSearch] = useState('');
  const [version, setVersion] = useState('');
  const [items, setItems] = useState<ImageStudy[]>([]);
  const [selected, setSelected] = useState<ImageStudy>();
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const firstLoad = useRef(true);
  const desiredId = useRef(new URLSearchParams(location.search).get('asset'));
  const query = new URLSearchParams({ studio, status, variant: theme, search, version }).toString();
  useEffect(() => {
    const controller = new AbortController();
    const epoch = ++generation.current;
    setLoading(true); setError('');
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const page = await assetApi<Page>(`/api/images?${query}`, { signal: controller.signal });
          let initial = page.studies[0];
          if (firstLoad.current && desiredId.current) initial = await getStudy(desiredId.current, controller.signal);
          if (controller.signal.aborted || epoch !== generation.current) return;
          firstLoad.current = false;
          setItems(page.studies); setHasMore(page.hasMore); setSelected(initial);
        } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Library unavailable.'); }
        finally { if (!controller.signal.aborted) setLoading(false); }
      })();
    }, 150);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [query, revision]);
  const selectedId = selected?.id;
  useEffect(() => {
    if (selectedId) window.history.replaceState(null, '', libraryUrl(selectedId));
  }, [selectedId]);
  const runningIds = [...new Set([...items, ...(selected ? [selected] : [])].filter(item => item.status === 'running').map(item => item.id))].join(',');
  useEffect(() => {
    if (!runningIds) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const updates = await Promise.all(runningIds.split(',').map(id => getStudy(id, controller.signal)));
        if (controller.signal.aborted) return;
        setItems(previous => previous.map(item => updates.find(update => update.id === item.id) ?? item));
        setSelected(previous => updates.find(update => update.id === previous?.id) ?? previous);
      } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Could not refresh jobs.'); }
      if (!controller.signal.aborted) timer = setTimeout(poll, 2500);
    }
    timer = setTimeout(poll, 2000);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [runningIds]);
  async function more() {
    const epoch = generation.current;
    setLoading(true);
    try {
      const page = await assetApi<Page>(`/api/images?${query}&offset=${items.length}`);
      if (epoch !== generation.current) return;
      setItems(previous => [...previous, ...page.studies.filter(item => !previous.some(existing => existing.id === item.id))]); setHasMore(page.hasMore);
    } catch (err) { if (epoch === generation.current) setError(String(err)); }
    finally { if (epoch === generation.current) setLoading(false); }
  }
  async function generate() {
    if (!selected || busy) return;
    setBusy(true); setError('');
    try {
      const study = await repeatStudy(selected.id);
      desiredId.current = study.id; firstLoad.current = true;
      setStatus(''); setRevision(value => value + 1);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not start generation.'); }
    finally { setBusy(false); }
  }
  const index = items.findIndex(item => item.id === selected?.id);
  return <main className="min-h-svh bg-background text-foreground">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 sm:px-8">
      <a href="/studio" className="flex items-center gap-3"><img src="/namche-mark.svg" alt="" className="size-7 dark:invert" /><div><p className="image-kicker">Namche Studio</p><h1 className="font-display text-xl">Asset library</h1></div></a>
      <nav aria-label="Studio" className="flex flex-wrap items-center gap-4 text-xs"><a href="/studio/mark">2D mark</a><a href="/studio/object">3D object</a><a href="/studio/images">Images</a><ThemeMenu /></nav>
    </header>
    <div className="flex flex-wrap items-center gap-3 border-b px-5 py-4 sm:px-8">
      <select aria-label="Filter studio" className={selectClass} value={studio} onChange={event => { setStudio(event.target.value); setTheme(''); }}><option value="">All studios</option><option value="images">Images</option><option value="object">3D Metaball</option></select>
      <select aria-label="Filter theme" className={selectClass} disabled={studio === 'object'} value={theme} onChange={event => setTheme(event.target.value)}><option value="">All themes</option>{Object.entries(imageStyles).map(([key, style]) => <option key={key} value={key}>{style.name}</option>)}</select>
      <select aria-label="Filter status" className={selectClass} value={status} onChange={event => setStatus(event.target.value)}><option value="">Images & prompt versions</option><option value="done">Finished images</option><option value="draft">Prompt versions</option><option value="running">Generating</option><option value="error">Failed</option></select>
      <input aria-label="Search prompts" placeholder="Search prompts…" className={selectClass + ' min-w-0 flex-1'} value={search} onChange={event => setSearch(event.target.value)} />
      {version && <button className="text-xs underline" onClick={() => setVersion('')}>Clear version filter ×</button>}
    </div>
    {error && <p role="alert" className="m-5 rounded-lg border border-destructive p-4 text-sm text-destructive">{error}</p>}
    <div className="grid lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="border-b p-5 lg:max-h-[calc(100svh-145px)] lg:overflow-auto lg:border-r lg:border-b-0">
        <p className="mb-4 text-xs text-muted-foreground">Images and the decisions behind them.<br />Saved on server · Private to this browser.</p>
        <div className="flex gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-1 lg:overflow-visible">{items.map(item => <button key={item.id} aria-pressed={item.id === selected?.id} onClick={() => setSelected(item)} className={`w-40 shrink-0 overflow-hidden rounded-lg border text-left lg:w-auto ${item.id === selected?.id ? 'ring-2 ring-foreground' : 'hover:border-foreground/50'}`}>
          <div className="flex aspect-[16/10] items-center justify-center bg-muted">{item.imageUrl ? <img src={item.imageUrl} alt={item.scene} loading="lazy" className="size-full object-cover" /> : <span className="image-kicker">{item.status === 'draft' ? 'Prompt version' : item.status}</span>}</div>
          <div className="p-3"><p className="line-clamp-2 text-xs">{item.scene}</p><p className="mt-2 font-mono text-[9px] text-muted-foreground">{studyLabel(item)} · {new Date(item.createdAt).toLocaleDateString()}</p></div>
        </button>)}</div>
        {!items.length && <p className="py-8 text-sm text-muted-foreground">{loading ? 'Loading…' : 'No matching assets. Save a prompt version or generate an image in a studio.'}</p>}
        {hasMore && <Button className="mt-4 w-full" variant="outline" disabled={loading} onClick={() => void more()}>Load older entries</Button>}
      </aside>
      {selected && <section className="min-w-0 p-5 sm:p-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><span className="image-kicker">{studyLabel(selected)} / {selected.status === 'draft' ? 'Prompt version' : selected.status}</span><p className="mt-1 text-xs text-muted-foreground">{new Date(selected.createdAt).toLocaleString()} · {selected.size} · {selected.quality}{selected.enhancement && ` · enhanced ${selected.enhancement.scaleFactor}×`}</p></div><div className="flex items-center gap-2"><Button aria-label="Previous combination" size="icon-sm" variant="outline" disabled={index <= 0} onClick={() => setSelected(items[index - 1])}><ChevronLeftIcon /></Button><span className="text-xs">{index < 0 ? 'Selected asset' : `${index + 1} / ${items.length}`}</span><Button aria-label="Next combination" size="icon-sm" variant="outline" disabled={index < 0 || index >= items.length - 1} onClick={() => setSelected(items[index + 1])}><ChevronRightIcon /></Button></div></div>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
          <div className="min-w-0"><div className="flex min-h-72 items-center justify-center overflow-hidden rounded-xl border bg-muted/30">{selected.imageUrl ? <img src={selected.imageUrl} alt={selected.scene} className="max-h-[65svh] w-full object-contain" /> : selected.status === 'running' ? <div role="status" className="p-12 text-center"><Loader2Icon className="mx-auto mb-4 animate-spin" />Creating this asset…</div> : <div className="p-10"><span className="image-kicker">{selected.status === 'draft' ? 'Before the image' : 'Generation interrupted'}</span><h2 className="mt-5 font-display text-3xl">{selected.status === 'draft' ? 'A direction worth keeping.' : 'Your settings are safe.'}</h2><p className="mt-3 text-sm text-muted-foreground">{selected.error ?? 'This prompt version is saved. Generate an image when you are ready.'}</p></div>}</div>
          <div className="mt-4 flex flex-wrap gap-2"><Button nativeButton={false} variant="outline" size="sm" render={<a href={`/api/images/${selected.id}/bundle`} download />}>Download bundle</Button>{selected.imageUrl && <Button nativeButton={false} variant="outline" size="sm" render={<a href={selected.imageUrl} download={`namche-${selected.id}.${selected.imageMime === 'image/jpeg' ? 'jpg' : selected.imageMime === 'image/webp' ? 'webp' : 'png'}`} />}>Image</Button>}<Button size="sm" disabled={busy || selected.status === 'running'} onClick={() => void generate()}>{busy ? 'Starting…' : selected.status === 'draft' ? 'Generate this version' : 'Generate again'}</Button></div>
          <p className="mt-3 text-xs text-muted-foreground">Bundle includes the image, both prompts, settings and references. Generating again is a new paid image request.</p>
          <div className="mt-5 flex gap-3">{selected.object && <a href={selected.object.shapeUrl}><img className="size-20 rounded border object-cover" src={selected.object.shapeUrl} alt="Original shape and camera reference" /></a>}{selected.referenceUrl && <a href={selected.referenceUrl}><img className="size-20 rounded border object-cover" src={selected.referenceUrl} alt="Original material or subject reference" /></a>}</div>
          </div>
          <div className="min-w-0 space-y-5"><div><span className="image-kicker">Content prompt</span><p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{selected.scene}</p></div><div className="border-t pt-5"><span className="image-kicker">Scenic prompt</span><p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{selected.style}</p></div>
            {selected.assistant && <div className="rounded-lg border p-3 text-xs"><p className="font-medium">Prompt iteration</p><p className="mt-2">{selected.assistant.instruction}</p><p className="mt-2 text-muted-foreground">{selected.assistant.explanation}</p></div>}
            <a className="block text-sm underline underline-offset-4" href={`/studio/${selected.object ? 'object' : 'images'}?asset=${selected.id}`}>Open settings in {selected.object ? '3D' : 'image'} studio →</a>
            <button className="block text-xs underline" onClick={() => setVersion(selected.promptVersionId ?? selected.id)}>Browse images from this prompt version</button>
            {selected.parentId && <a className="block text-xs underline" href={libraryUrl(selected.parentId)}>View previous version →</a>}
            <details className="border-t pt-4 text-xs"><summary className="cursor-pointer">Exact generation prompt & settings</summary><p className="mt-3 whitespace-pre-wrap leading-relaxed">{selected.prompt}</p><pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded border p-3">{JSON.stringify(selected.object?.params ?? { size: selected.size, quality: selected.quality, model: selected.model }, null, 2)}</pre></details>
          </div>
        </div>
      </section>}
    </div>
  </main>;
}
