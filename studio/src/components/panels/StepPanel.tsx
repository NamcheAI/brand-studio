import { ArrowRightIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import AppCredits from '../AppCredits';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type Step<Id extends string> = {
  id: Id;
  label: string;
  content: ReactNode;
};

/**
 * The side panel as a numbered flow: one tab per step, only the active
 * step's controls visible, and a "Next" nudge at the bottom so the order of
 * the owner's workflow is legible without reading any docs.
 */
export function StepPanel<Id extends string>({
  label,
  steps,
  value,
  onValueChange,
}: {
  label: string;
  steps: ReadonlyArray<Step<Id>>;
  value: Id;
  onValueChange: (id: Id) => void;
}) {
  return (
    <aside
      aria-label={label}
      className="flex max-h-[50vh] min-h-0 shrink-0 flex-col border-b md:max-h-none md:w-[340px] md:border-r md:border-b-0"
    >
      <Tabs
        value={value}
        onValueChange={(next) => onValueChange(next as Id)}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <div className="shrink-0 border-b px-3 py-2">
          <TabsList className="w-full" aria-label={label}>
            {steps.map((step, index) => (
              <TabsTrigger key={step.id} value={step.id} className="gap-1 px-1 text-xs">
                <span
                  aria-hidden="true"
                  className="font-mono text-[0.625rem] text-muted-foreground tabular-nums"
                >
                  {index + 1}
                </span>
                {step.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col px-4 pt-3">
            {steps.map((step, index) => {
              const next = steps[index + 1];
              return (
                <TabsContent key={step.id} value={step.id} className="flex flex-col gap-3">
                  {step.content}
                  {next && (
                    <div className="flex justify-end border-t pt-3">
                      <Button variant="outline" size="sm" onClick={() => onValueChange(next.id)}>
                        Next: {next.label}
                        <ArrowRightIcon data-icon="inline-end" />
                      </Button>
                    </div>
                  )}
                </TabsContent>
              );
            })}
            <AppCredits />
          </div>
        </ScrollArea>
      </Tabs>
    </aside>
  );
}
