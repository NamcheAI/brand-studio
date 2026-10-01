import type { LookMode } from './model';

export type StageErrorKind = 'environment' | 'module' | 'unknown';

/**
 * Sorts a 3D stage failure by what the user can do about it. Environment and
 * lazy-chunk failures are network problems; anything else (e.g. no WebGL) is
 * reported generically.
 */
export function classifyStageError(error: unknown): StageErrorKind {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  // R3F's loader wraps failures as "Could not load <url>: <reason>".
  if (/could not load\b.*\.(hdr|exr)\b/i.test(message)) return 'environment';
  if (
    /dynamically imported module|importing a module script failed|ChunkLoadError|Loading chunk/i.test(
      message,
    )
  ) {
    return 'module';
  }
  return 'unknown';
}

export function stageErrorCopy(
  kind: StageErrorKind,
  lookMode: LookMode,
): { title: string; hint: string } {
  if (kind === 'environment') {
    return {
      title:
        lookMode === 'liquid'
          ? "Couldn't load the liquid environment"
          : "Couldn't load the studio environment",
      hint: 'Check your connection and try again.',
    };
  }
  if (kind === 'module') {
    return { title: "Couldn't load the 3D view", hint: 'Check your connection and try again.' };
  }
  return {
    title: 'The 3D view stopped working',
    hint: 'Try again, or reload the page if it keeps happening.',
  };
}
