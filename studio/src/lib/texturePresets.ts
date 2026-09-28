import { byTheme, bySlug, url, type ImageryImage, type ImagerySlug } from '@namche/imagery';
import type { Metaball3DTexture } from '@namche/metaball-react';

/**
 * Surface textures for the 3D metaball, drawn from the NAMCHE curated
 * imagery (Jodok's own photos). The texture themes ship seamless tiles plus
 * derived normal/roughness maps on cdn.namche.ai; slugs and URLs come typed
 * from @namche/imagery, whose version pins the imagery release.
 */
export const TEXTURE_OPTIONS: ImageryImage[] = [
  ...byTheme('texture_porous'),
  ...byTheme('texture_smooth'),
];

export function isTextureSlug(value: unknown): value is ImagerySlug {
  return (
    typeof value === 'string' &&
    value in bySlug &&
    Boolean(bySlug[value as ImagerySlug].files.tile)
  );
}

export function textureThumbUrl(slug: ImagerySlug): string {
  return url(slug, 'thumb');
}

export function textureWebUrl(slug: ImagerySlug): string {
  return url(slug, 'web');
}

export function textureForSlug(
  slug: string | null,
  scale: number,
  amount: number,
): Metaball3DTexture | undefined {
  if (!isTextureSlug(slug)) return undefined;
  return {
    mapUrl: url(slug, 'tile'),
    normalMapUrl: url(slug, 'normal'),
    roughnessMapUrl: url(slug, 'rough'),
    scale,
    amount,
  };
}
