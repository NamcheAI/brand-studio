import { Component, type ReactNode } from 'react';
import { RotateCcwIcon, TriangleAlertIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LookMode } from '../../lib/model';
import { classifyStageError, stageErrorCopy } from '../../lib/stageErrors';

export function Stage3DErrorFallback({
  error,
  lookMode,
  onRetry,
  onUseOrganic,
}: {
  error: unknown;
  lookMode: LookMode;
  onRetry: () => void;
  onUseOrganic?: () => void;
}) {
  const { title, hint } = stageErrorCopy(classifyStageError(error), lookMode);
  return (
    <div className="flex size-full items-center justify-center p-4">
      <div
        role="alert"
        className="flex max-w-sm flex-col items-center gap-3 rounded-xl bg-background/90 px-5 py-4 text-center shadow-sm ring-1 ring-foreground/10"
      >
        <TriangleAlertIcon className="size-5 text-muted-foreground" aria-hidden />
        <div className="space-y-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="sm" onClick={onRetry}>
            <RotateCcwIcon data-icon="inline-start" />
            Retry
          </Button>
          {lookMode === 'liquid' && onUseOrganic && (
            <Button size="sm" variant="outline" onClick={onUseOrganic}>
              Use Organic look
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

type State = { error: unknown; lookMode: LookMode };

type Props = {
  lookMode: LookMode;
  /** Runs before the stage remounts, e.g. to recreate a failed lazy import. */
  onRetry?: (error: unknown) => void;
  onUseOrganic?: () => void;
  children: ReactNode;
};

/**
 * Keeps a failing 3D stage (offline HDR, lazy chunk, WebGL) inside the stage
 * instead of unmounting the whole Studio. Changing the look resets it, so the
 * Organic fallback remounts the canvas.
 */
export class Stage3DErrorBoundary extends Component<Props, State> {
  state: State = { error: null, lookMode: this.props.lookMode };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.lookMode === state.lookMode) return null;
    return { error: null, lookMode: props.lookMode };
  }

  retry = () => {
    this.props.onRetry?.(this.state.error);
    this.setState({ error: null });
  };

  render() {
    if (this.state.error === null) return this.props.children;
    return (
      <Stage3DErrorFallback
        error={this.state.error}
        lookMode={this.props.lookMode}
        onRetry={this.retry}
        onUseOrganic={this.props.onUseOrganic}
      />
    );
  }
}
