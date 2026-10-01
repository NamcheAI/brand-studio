import { Environment, useEnvironment } from '@react-three/drei';
import { Component, Suspense, type ReactNode } from 'react';

/**
 * Drops a failed (or loaded) environment map from the loader cache. The
 * cache keeps rejections forever, so without this a remount would rethrow
 * the old network error instead of fetching again.
 */
export function clearEnvironmentCache(url?: string): void {
  try {
    useEnvironment.clear(url ? { files: url } : { preset: 'studio' });
  } catch {
    // drei rejects URLs it has no loader for (e.g. no file extension); those
    // never reached the cache, and the fallback must not throw on cleanup.
  }
}

class EnvironmentBoundary extends Component<
  { url?: string; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    clearEnvironmentCache(this.props.url);
    console.warn('Metaball3D: environment map failed to load; rendering without reflections.', error);
  }

  componentDidUpdate(prev: { url?: string }) {
    if (this.state.failed && prev.url !== this.props.url) this.setState({ failed: false });
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Studio reflections for reflective and transmissive materials. `url` points
 * at a self-hosted equirectangular HDR/EXR; without it drei's `studio` preset
 * is fetched from its public CDN. A failed load renders the scene without
 * reflections instead of throwing into the host page.
 */
export function StudioEnvironment({ url, intensity }: { url?: string; intensity: number }) {
  return (
    <EnvironmentBoundary url={url}>
      <Suspense fallback={null}>
        {url ? (
          <Environment files={url} environmentIntensity={intensity} />
        ) : (
          <Environment preset="studio" environmentIntensity={intensity} />
        )}
      </Suspense>
    </EnvironmentBoundary>
  );
}
