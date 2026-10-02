import { ArrowUpRightIcon, ChevronDownIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { StudioHeaderLink } from '@/components/StudioHeaderLink';
import { ThemeMenu } from '@/components/theme-menu';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { BRAND, BRAND_RESOURCES, WORKSPACES, type WorkspaceId } from '@/lib/brand';
import { cn } from '@/lib/utils';

/**
 * The one app bar every Studio surface shares: the NAMCHE lockup, the four
 * workspaces in flow order (Mark → Object → Images → Library), and a right
 * `actions` slot for whatever that surface needs before the theme menu.
 *
 * Kept router-agnostic (plain anchors) on purpose — a TanStack Start
 * migration can swap these for framework links without touching callers.
 */
export function StudioAppBar({
  active,
  actions,
  className,
}: {
  active: WorkspaceId | null;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:gap-3 sm:px-4',
        className,
      )}
    >
      <StudioHeaderLink href="/studio" className="flex min-w-0 shrink-0 items-center gap-2.5">
        {/* The shipped mark is solid Basalt; inverting keeps it legible on
            the dark ground without touching the (asset-locked) file. */}
        <img
          src="/namche-mark.svg"
          alt=""
          aria-hidden="true"
          className="size-6 shrink-0 dark:invert"
        />
        <div className="hidden min-w-0 flex-col leading-none sm:flex">
          <span className="font-mono text-[0.5625rem] font-medium tracking-[0.18em] text-muted-foreground uppercase">
            {BRAND.wordmark}
          </span>
          <span className="truncate font-display text-base font-medium">{BRAND.product}</span>
        </div>
      </StudioHeaderLink>

      {/* Phones get a single "current workspace" menu: four pills plus the
          editors' undo/redo/File actions do not fit in 390px without
          clipping, and a half-visible scrolling nav hides where you can go. */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="sm" className="sm:hidden" aria-label="Switch workspace">
              {WORKSPACES.find((workspace) => workspace.id === active)?.label ?? 'Workspaces'}
              <ChevronDownIcon data-icon="inline-end" />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="w-44">
          {WORKSPACES.map((workspace) => (
            <DropdownMenuItem
              key={workspace.id}
              render={<a href={workspace.href} />}
              aria-current={workspace.id === active ? 'page' : undefined}
              className="justify-between no-underline hover:no-underline"
            >
              {workspace.label}
              <span className="font-mono text-[0.625rem] text-muted-foreground">
                {workspace.eyebrow}
              </span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            render={<a href={BRAND_RESOURCES.href} />}
            className="justify-between no-underline hover:no-underline"
          >
            {BRAND_RESOURCES.label}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <nav
        aria-label="Workspaces"
        className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto sm:flex"
      >
        {WORKSPACES.map((workspace) => {
          const isActive = workspace.id === active;
          return (
            <StudioHeaderLink
              key={workspace.id}
              href={workspace.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                isActive
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {workspace.label}
            </StudioHeaderLink>
          );
        })}
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        {actions}
        {actions ? <Separator orientation="vertical" className="mx-1 h-5" /> : null}
        {/* The quiet way back to the website's brand page, a plain link in
            the ghost button style. It joins the bar from `md`, where the
            workspace pills still fit beside the editor actions; phones reach
            it from the workspace menu instead. */}
        <a
          href={BRAND_RESOURCES.href}
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            'hidden text-muted-foreground hover:text-foreground md:inline-flex',
          )}
        >
          <span className="sr-only">Brand resources on </span>
          {/* The domain shows from `lg`; narrower bars keep the arrow only,
              so the four workspace pills stay fully visible. */}
          <span className="sr-only lg:not-sr-only">namche.ai</span>
          <ArrowUpRightIcon data-icon="inline-end" aria-hidden="true" />
        </a>
        <ThemeMenu />
      </div>
    </header>
  );
}
