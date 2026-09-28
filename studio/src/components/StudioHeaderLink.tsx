import type { ComponentProps } from 'react';
import { cn } from '../lib/utils';

/** Navigation overrides the design kit's underline default for prose links. */
export function StudioHeaderLink({ className, ...props }: ComponentProps<'a'>) {
  return <a {...props} className={cn('no-underline hover:no-underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring', className)} />;
}
