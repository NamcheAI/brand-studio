import { zipSync } from 'fflate';
import { IMAGERY_RELEASE } from '@namche/imagery';
import type { AIRenderParams, AIRenderResult } from '../../lib/ai-render-contract';
import { downloadBlob } from './export3d';
import { serializeDocument } from './persistence';
import { isTextureSlug, textureWebUrl } from './texturePresets';
import type { Document } from './model';

/**
 * A render is a paid, unrepeatable artifact: the same prompt does not come
 * back twice. The bundle is what makes one reproducible and archivable —
 * the image, the exact parameters that seeded it, the versioned CDN URL of
 * the material (not just its slug, so a retracted texture is still
 * traceable), and the metaball document itself, which the Studio can import
 * to rebuild the shape.
 *
 * Legacy client-side bundle exporter, retained for standalone results. New
 * Studio generations download bundles from the private asset library so the
 * parameters and Document always come from the saved render snapshot.
 */

export const RENDER_BUNDLE_SCHEMA_VERSION = 1;

export type RenderProvenance = {
  schemaVersion: number;
  createdAt: string;
  render: {
    model: string;
    size: string;
    quality: string;
    background: string;
    requestId?: string;
    prompt: string;
  };
  material:
    | {
        mode: 'metamorph';
        textureSlug: string;
        textureUrl: string;
        imageryRelease: string;
      }
    | { mode: 'upload'; referenceName: string | null }
    | { mode: 'description-only' };
  params: AIRenderParams;
  files: { image: string; document: string };
};

export function buildRenderProvenance(options: {
  result: AIRenderResult;
  params: AIRenderParams;
  textureSlug: string | null;
  referenceName: string | null;
  createdAt: string;
}): RenderProvenance {
  const { result, params, textureSlug, referenceName, createdAt } = options;
  const usesTexture = Boolean(params.metamorph) && isTextureSlug(textureSlug);
  const material: RenderProvenance['material'] = usesTexture
    ? {
        mode: 'metamorph',
        textureSlug: textureSlug as string,
        // @namche/imagery pins CDN_BASE to its own release, so this is the
        // versioned URL rather than `current`: it names exactly which pixels
        // seeded the render even after the next imagery release.
        textureUrl: textureWebUrl(textureSlug as never),
        imageryRelease: IMAGERY_RELEASE,
      }
    : referenceName
      ? { mode: 'upload', referenceName }
      : { mode: 'description-only' };

  return {
    schemaVersion: RENDER_BUNDLE_SCHEMA_VERSION,
    createdAt,
    render: {
      model: result.model,
      size: params.size,
      quality: params.quality,
      background: params.background,
      ...(result.requestId ? { requestId: result.requestId } : {}),
      prompt: result.prompt,
    },
    material,
    params,
    files: { image: 'render.png', document: 'document.json' },
  };
}

/** Slug-safe stamp, e.g. 2026-08-28T2143. */
function stamp(createdAt: string): string {
  return createdAt.slice(0, 16).replace(/[:]/g, '').replace('T', 'T');
}

function decodeDataUrl(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function exportRenderBundle(options: {
  result: AIRenderResult;
  params: AIRenderParams;
  doc: Document;
  textureSlug: string | null;
  referenceName: string | null;
  now?: Date;
}): void {
  const createdAt = (options.now ?? new Date()).toISOString();
  const provenance = buildRenderProvenance({
    result: options.result,
    params: options.params,
    textureSlug: options.textureSlug,
    referenceName: options.referenceName,
    createdAt,
  });
  const encoder = new TextEncoder();
  const files: Record<string, Uint8Array> = {
    'render.png': decodeDataUrl(options.result.image),
    'provenance.json': encoder.encode(JSON.stringify(provenance, null, 2) + '\n'),
    'document.json': encoder.encode(serializeDocument(options.doc)),
  };
  const zipped = zipSync(files, { level: 6 });
  const buffer = zipped.buffer.slice(
    zipped.byteOffset,
    zipped.byteOffset + zipped.byteLength,
  ) as ArrayBuffer;
  const name =
    provenance.material.mode === 'metamorph'
      ? `namche-render-${stamp(createdAt)}-${provenance.material.textureSlug}`
      : `namche-render-${stamp(createdAt)}`;
  downloadBlob(new Blob([buffer], { type: 'application/zip' }), `${name}.zip`);
}
