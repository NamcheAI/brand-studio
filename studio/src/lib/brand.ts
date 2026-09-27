/**
 * Single source of truth for the product name and its four workspaces.
 * Every header, title, and nav in the Studio reads from here so a rename
 * (or a description tweak) never turns into a grep-and-replace exercise.
 */
export const BRAND = {
  wordmark: 'NAMCHE',
  product: 'Brand Studio',
  full: 'NAMCHE Brand Studio',
} as const;

export type WorkspaceId = 'mark' | 'object' | 'images' | 'library';

export type Workspace = {
  id: WorkspaceId;
  href: string;
  eyebrow: string;
  label: string;
  description: string;
};

/**
 * Listed in flow order: draw/style a mark, sculpt/render an object, generate
 * images, then browse everything in the library. StudioChooser and the app
 * bar both render this list directly, so reordering it reorders the UI.
 */
export const WORKSPACES: readonly Workspace[] = [
  {
    id: 'mark',
    href: '/studio/mark',
    eyebrow: '2D',
    label: 'Mark',
    description: 'Pick or draw a shape, style it on the raster, animate it, export SVG or PNG.',
  },
  {
    id: 'object',
    href: '/studio/object',
    eyebrow: '3D',
    label: 'Object',
    description:
      'Set the ground and viewpoint, choose a surface, render with AI — then enlarge the best.',
  },
  {
    id: 'images',
    href: '/studio/images',
    eyebrow: 'AI',
    label: 'Images',
    description: 'Choose a style — Hestia field, filter, or close-up — add a prompt, and generate.',
  },
  {
    id: 'library',
    href: '/studio/library',
    eyebrow: 'Assets',
    label: 'Library',
    description: 'Browse every generated image with its prompt, and revisit or download it.',
  },
] as const;
