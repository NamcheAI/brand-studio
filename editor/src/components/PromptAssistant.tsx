import { useEffect, useRef, useState } from 'react';
import type { ImageStudy } from '../../lib/image-studio-contract';
import { assetApi, libraryUrl } from '../lib/asset-api';
import { Button } from './ui/button';

type Props = { onSnapshot: () => Promise<ImageStudy>; onApply: (study: ImageStudy) => void; disabled?: boolean };
export function PromptAssistant({ onSnapshot, onApply, disabled }: Props) {
  const [instruction, setInstruction] = useState('');
  const [suggestion, setSuggestion] = useState<ImageStudy>();
  const [saved, setSaved] = useState<ImageStudy>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function save(assist: boolean) {
    setBusy(true); setError(''); setSuggestion(undefined);
    try {
      const source = await onSnapshot();
      if (!alive.current) return;
      setSaved(source);
      if (assist) {
        const next = await assetApi<ImageStudy>('/api/images/assist', { method: 'POST', body: JSON.stringify({ sourceId: source.id, instruction }) });
        if (alive.current) { setSuggestion(next); setSaved(next); }
      }
    } catch (err) { if (alive.current) setError(err instanceof Error ? err.message : 'Could not save this version.'); }
    finally { if (alive.current) setBusy(false); }
  }
  return <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
    <div className="flex items-center justify-between gap-2"><span className="text-xs font-medium">Prompt workshop</span><Button type="button" variant="outline" size="xs" disabled={disabled || busy} onClick={() => void save(false)}>Save version</Button></div>
    <p className="text-xs leading-relaxed text-muted-foreground">Keep the atmosphere. Refine what the image shows — framing, gesture, detail or material.</p>
    <label className="block text-xs">What would you like to change?<textarea aria-label="Prompt refinement" rows={3} maxLength={2000} className="mt-2 w-full resize-y rounded border bg-background p-2 text-sm" placeholder="Closer crop, with one hand in focus…" value={instruction} onChange={event => setInstruction(event.target.value)} /></label>
    <Button type="button" variant="outline" size="sm" disabled={disabled || busy || !instruction.trim()} onClick={() => void save(true)}>{busy ? 'Saving & thinking…' : 'Suggest a content prompt'}</Button>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    {suggestion && <div className="space-y-3 border-t pt-3"><span className="image-kicker">Proposed content</span><p className="whitespace-pre-wrap text-sm leading-relaxed">{suggestion.scene}</p><p className="text-xs leading-relaxed text-muted-foreground">{suggestion.assistant?.explanation}</p><Button type="button" size="sm" disabled={disabled} onClick={() => { onApply(suggestion); setSuggestion(undefined); }}>Use this version</Button><p className="text-xs text-muted-foreground">This replaces the current content with the saved suggestion. Scenic direction stays with its saved version.</p></div>}
    {saved && <a className="block text-xs underline underline-offset-4" href={libraryUrl(saved.id)}>Saved on server · Browse this version →</a>}
  </div>;
}
