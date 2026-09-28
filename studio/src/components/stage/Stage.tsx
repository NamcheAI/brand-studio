import type { CSSProperties, ReactNode } from 'react';

/**
 * The stage column: an optional top row (canvas-level switches), the square
 * artwork, and a bottom bar (playback or render actions).
 *
 * Only the middle row is a size container, so the square is the smaller of
 * *its* two sides — both bars always stay fully visible and never cover the
 * mark, on any viewport.
 */
export function Stage({
  top,
  bottom,
  overlay,
  style,
  children,
}: {
  top?: ReactNode;
  bottom?: ReactNode;
  /** Drawn over the square (e.g. an AI render) without unmounting children. */
  overlay?: ReactNode;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <main
      className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-muted/30"
      style={style}
    >
      {top && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 px-3 pt-3 md:px-4">{top}</div>
      )}
      <div className="grid min-h-0 flex-1 place-items-center p-3 [container-type:size] md:p-6">
        <div className="relative flex aspect-square w-[min(100cqw,100cqh,900px)]">
          {children}
          {overlay}
        </div>
      </div>
      {bottom && (
        <div className="shrink-0 border-t bg-background/90 px-3 py-2 backdrop-blur md:px-4">
          {bottom}
        </div>
      )}
    </main>
  );
}

/** A small chip that keeps stage controls legible on any canvas colour. */
export function StageChip({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-full bg-background/90 p-0.5 shadow-sm ring-1 ring-foreground/10 backdrop-blur">
      {children}
    </div>
  );
}
