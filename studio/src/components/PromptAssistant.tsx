import { useEffect, useRef, useState } from 'react';
import type { ImageStudy } from '../../lib/image-studio-contract';
import { assetApi } from '../lib/asset-api';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';

type Props = { onSnapshot: () => Promise<ImageStudy>; onApply: (study: ImageStudy) => void; disabled?: boolean };

/**
 * Lets the owner describe a change in plain language and get a suggested
 * content prompt back, without losing the current draft: "Save version"
 * snapshots the draft as-is; "Suggest new content prompt" also asks the
 * assistant for a rewrite. Used both inside the Images "Refine with AI"
 * disclosure and inside AIRenderPanel — props and behaviour are unchanged,
 * only the chrome, so it no longer double-borders when nested in a
 * disclosure that already has its own border.
 */
export function PromptAssistant({ onSnapshot, onApply, disabled }: Props) {
  const [instruction, setInstruction] = useState('');
  const [suggestion, setSuggestion] = useState<ImageStudy>();
  const [saved, setSaved] = useState<ImageStudy>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  async function save(assist: boolean) {
    setBusy(true);
    setError('');
    setSuggestion(undefined);
    try {
      const source = await onSnapshot();
      if (!alive.current) return;
      setSaved(source);
      if (assist) {
        const next = await assetApi<ImageStudy>('/api/images/assist', {
          method: 'POST',
          body: JSON.stringify({ sourceId: source.id, instruction }),
        });
        if (alive.current) {
          setSuggestion(next);
          setSaved(next);
        }
      }
    } catch (err) {
      if (alive.current) setError(err instanceof Error ? err.message : 'Could not save this version.');
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Keep the atmosphere. Refine the framing, gesture, detail or material in the image.
      </p>
      <label className="block text-xs">
        What should change?
        <Textarea
          aria-label="Prompt refinement"
          rows={3}
          maxLength={2000}
          className="mt-2 text-sm"
          placeholder="Closer crop, with one hand in focus…"
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={disabled || busy} onClick={() => void save(false)}>
          Save version
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || busy || !instruction.trim()}
          onClick={() => void save(true)}
        >
          {busy ? 'Saving & thinking…' : 'Suggest new content prompt'}
        </Button>
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      {suggestion && (
        <div className="space-y-3 border-t pt-3">
          <span className="image-kicker">Proposed content</span>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{suggestion.scene}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{suggestion.assistant?.explanation}</p>
          <Button
            type="button"
            size="sm"
            disabled={disabled}
            onClick={() => {
              onApply(suggestion);
              setSuggestion(undefined);
            }}
          >
            Use this version
          </Button>
          <p className="text-xs text-muted-foreground">
            This replaces the current content with the saved suggestion. Scenic direction stays with its saved
            version.
          </p>
        </div>
      )}
      {saved && (
        <a className="block text-xs underline underline-offset-4" href={`/studio/${saved.object ? 'object' : 'images'}?asset=${saved.id}`}>
          Saved on server · Open this version in studio →
        </a>
      )}
    </div>
  );
}
