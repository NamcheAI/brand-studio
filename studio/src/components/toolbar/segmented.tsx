import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

/* The selected item is ink, not a muted wash: a segmented control in the
   Studio is a state read at a glance while the eye is on the canvas, so it
   gets the brand's solid pill treatment instead of the default tint. */
const SELECTED =
  'aria-pressed:bg-primary! aria-pressed:text-primary-foreground! aria-pressed:border-primary!';

export type SegmentedOption<Value extends string> = {
  value: Value;
  label: string;
  hint?: string;
  disabled?: boolean;
};

type SegmentedProps<Value extends string> = {
  label: string;
  value: Value | null;
  options: ReadonlyArray<SegmentedOption<Value>>;
  onValueChange: (value: Value) => void;
  disabled?: boolean;
  className?: string;
};

/** Single-select ToggleGroup rendered as one joined bar. */
export function Segmented<Value extends string>({
  label,
  value,
  options,
  onValueChange,
  disabled = false,
  className,
}: SegmentedProps<Value>) {
  return (
    <ToggleGroup
      aria-label={label}
      variant="outline"
      size="sm"
      spacing={0}
      disabled={disabled}
      value={value === null ? [] : [value]}
      onValueChange={(next) => {
        const [selected] = next;
        if (selected) onValueChange(selected as Value);
      }}
      className={cn('w-full', className)}
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          title={option.hint}
          className={cn(
            'flex-1 font-mono text-[0.6875rem] tracking-wide uppercase',
            SELECTED,
          )}
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/** Single-select ToggleGroup rendered as a wrapping grid of preset chips. */
export function PresetGrid<Value extends string>({
  label,
  value,
  options,
  onValueChange,
  columns = 2,
}: SegmentedProps<Value> & { columns?: 2 | 3 }) {
  return (
    <ToggleGroup
      aria-label={label}
      variant="outline"
      size="sm"
      spacing={1.5}
      value={value === null ? [] : [value]}
      onValueChange={(next) => {
        const [selected] = next;
        if (selected) onValueChange(selected as Value);
      }}
      className={cn('grid w-full', columns === 3 ? 'grid-cols-3' : 'grid-cols-2')}
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          title={option.hint}
          className={cn(
            'h-auto min-h-7 w-full py-1 text-center text-xs leading-tight whitespace-normal',
            SELECTED,
          )}
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
