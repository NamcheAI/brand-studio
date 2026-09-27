import { useRef, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Scrub handler — fires on every drag/keyboard change. */
  onChange: (value: number) => void;
  /** Commit handler — fires once when the gesture ends. */
  onCommit?: () => void;
  disabled?: boolean;
};

function firstNumber(value: number | readonly number[]): number {
  return typeof value === 'number' ? value : (value[0] ?? 0);
}

/**
 * Label + numeric field over a slider. The slider scrubs on `onValueChange`
 * and commits once on `onValueCommitted`, which is what the editor's history
 * model expects: one undo step per gesture, live document updates in between.
 */
export function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  onCommit,
  disabled = false,
}: Props) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const decimals = step < 0.01 ? 3 : step < 1 ? 2 : 0;
  const safe = Number.isFinite(value) ? value : min;
  // Keep partially typed values (for example "4" on the way to "40") out of
  // the clamping path until the edit is committed.
  const [draft, setDraft] = useState<string | null>(null);
  const draftRef = useRef<string | null>(null);

  const updateDraft = (next: string | null) => {
    draftRef.current = next;
    setDraft(next);
  };

  const applyDraft = () => {
    const pending = draftRef.current;
    if (pending !== null) {
      const next = Number(pending);
      if (pending.trim() !== '' && !Number.isNaN(next)) onChange(clamp(next));
      updateDraft(null);
    }
    onCommit?.();
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-normal text-muted-foreground">{label}</Label>
        <Input
          type="number"
          aria-label={`${label} value`}
          className="h-6 w-16 px-1.5 text-right font-mono text-xs tabular-nums"
          min={min}
          max={max}
          step={step}
          value={draft ?? Number(safe.toFixed(decimals))}
          disabled={disabled}
          onChange={(event) => updateDraft(event.target.value)}
          onBlur={applyDraft}
          onKeyDown={(event) => {
            if (event.key === 'Enter') applyDraft();
          }}
        />
      </div>
      <Slider
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={[safe]}
        disabled={disabled}
        onValueChange={(next) => onChange(firstNumber(next))}
        onValueCommitted={() => onCommit?.()}
      />
    </div>
  );
}
