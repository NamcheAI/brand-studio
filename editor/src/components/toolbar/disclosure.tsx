import { ChevronRightIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

/**
 * Closed-by-default disclosure — the replacement for the old
 * `<details class="advanced-export">` blocks.
 *
 * `variant="expert"` marks settings the three main flows never need: same
 * interaction, but tagged "Expert" so a first-time user can tell at a glance
 * which sections are safe to ignore.
 */
export function Disclosure({
  label,
  children,
  variant = 'default',
  defaultOpen = false,
}: {
  label: string;
  children: ReactNode;
  variant?: 'default' | 'expert';
  defaultOpen?: boolean;
}) {
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      data-variant={variant}
      className="flex flex-col gap-3 border-t pt-3 data-[variant=expert]:border-dashed"
    >
      <CollapsibleTrigger className="group/disclosure flex w-full items-center gap-1.5 font-mono text-[0.6875rem] tracking-wide text-muted-foreground uppercase transition-colors outline-none select-none hover:text-foreground focus-visible:text-foreground data-panel-open:text-foreground">
        <ChevronRightIcon className="size-3 shrink-0 transition-transform group-data-panel-open/disclosure:rotate-90" />
        <span className="min-w-0 flex-1 text-left">{label}</span>
        {variant === 'expert' && (
          <span
            className={cn(
              'shrink-0 rounded-full border px-1.5 py-px text-[0.5625rem] tracking-widest',
              'text-muted-foreground/80',
            )}
          >
            Expert
          </span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

/** The one "Expert" disclosure used across every Studio panel. */
export function Expert({
  label = 'Expert settings',
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <Disclosure label={label} variant="expert">
      {children}
    </Disclosure>
  );
}
