import type { ReactNode } from 'react';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

/** Muted helper copy under a control. */
export function Hint({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-xs leading-snug text-muted-foreground', className)}>{children}</p>;
}

/** A mono, uppercase label used to introduce a group of controls. */
export function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[0.625rem] tracking-widest text-muted-foreground uppercase">
      {children}
    </span>
  );
}

/** Bordered sub-panel — the visual equivalent of the old `.toolbar-subsection`. */
export function Subsection({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3 rounded-lg border p-3', className)}>{children}</div>
  );
}

export function SwitchField({
  label,
  checked,
  disabled = false,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <Label className="flex w-full items-center justify-between gap-3 text-xs font-normal">
      <span className={cn(disabled && 'opacity-50')}>{label}</span>
      <Switch
        size="sm"
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onCheckedChange(value)}
      />
    </Label>
  );
}

export function SelectField<Value extends string>({
  label,
  value,
  options,
  disabled = false,
  onValueChange,
}: {
  label: string;
  value: Value;
  options: ReadonlyArray<{ value: Value; label: string }>;
  disabled?: boolean;
  onValueChange: (value: Value) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-xs font-normal text-muted-foreground">{label}</Label>
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(next) => onValueChange(next as Value)}
      >
        <SelectTrigger size="sm" className="min-w-28" aria-label={label}>
          {/* Render the option label, not the raw value: the popup lives in a
              portal, so Base UI cannot resolve the label on its own. */}
          <SelectValue>
            {(current: string) => options.find((option) => option.value === current)?.label ?? ''}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Native colour input dressed as a swatch. There is no design-system colour
 * picker and adding a dependency for one is not worth it, so the platform
 * control keeps the behaviour and only the chrome changes.
 */
export function ColorField({
  label,
  value,
  onChange,
  onCommit,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onCommit?: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        type="color"
        aria-label={label}
        value={value}
        className="h-7 w-9 cursor-pointer rounded-md border bg-transparent p-0.5 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        onChange={(event) => onChange(event.target.value)}
        onPointerUp={onCommit}
        onBlur={onCommit}
      />
    </label>
  );
}
