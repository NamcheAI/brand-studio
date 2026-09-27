import type { AIRenderParams, AIRenderQuality, AIRenderSize } from './ai-render-contract.js';

export const imageStyles = {
  'hestia-field': {
    name: 'Hestia field',
    description: 'Sculptural light. Deep shadows. A world in Hestia red.',
    scene: 'Three people huddled closely around an open laptop, viewed from a low three-quarter angle. Tightly framed from the chest up, in focused conversation.',
    style: 'Cinematic, minimal, editorial photography, high contrast. Dramatic monochromatic red lighting: a single strong, hard light from camera-left at head height. Deep chiaroscuro; only raised surfaces, cheekbones and fabric folds catch the light. Saturated Hestia red (#eb4629) background, with subtle vignette falloff. No fill light; shadows are near-black. Subtle rim light separates the silhouette. Underexposed, low-key mood. Sparse composition, no loose clutter. Any device screens are solid black.',
  },
  filter: {
    name: 'Filter',
    description: 'Soft silhouettes. Warm light drifting into cool colour.',
    scene: 'A gender-neutral human silhouette holding a kendama. Keep the held object clearly recognizable.',
    style: 'Soft-focus photographic silhouette with Gaussian blur across body and face. Only two colour zones: cool Aion blue-violet (#738cd9) background and a warm glow blending Hestia coral-red (#eb4629) into Eos orange (#f2942e) on the figure. One soft Helios golden-yellow (#ffd433) rim light along the top edge of the head only. Transition directly into the cool background, without green or cyan. No facial detail or surface texture. Organic light diffusion, muted, foggy atmosphere. Crisp edges only on the held object. No rainbow thermal palette, scan lines, hard 3D shading or specular highlights.',
  },
  'close-ups': {
    name: 'Close-ups',
    description: 'Human gestures, tactile detail and an intimate point of view.',
    scene: 'An extreme close-up of a hand reaching toward a mirror, its index fingertip touching its reflection. Crop out faces and surroundings, concentrating on the delicate gesture and the space between the hands.',
    style: 'Intimate, contemplative fine-art editorial photography. Tight, graphic crop, tactile skin creases and natural imperfections. Shallow depth of field, gentle soft focus, pronounced analog film grain, subdued contrast and a warm, hazy colour grade. Soft directional light creates amber highlights and diffuse terracotta shadows, with dusty blue and lavender in the background. No text or graphics.',
  },
} as const;

export type ImageVariant = keyof typeof imageStyles;
export type ImageStudioRequest = {
  variant: ImageVariant;
  scene: string;
  style: string;
  size: AIRenderSize;
  quality: AIRenderQuality;
  referenceImage?: string;
};
export type ImageStudy = Omit<ImageStudioRequest, 'referenceImage' | 'variant'> & {
  variant: ImageVariant | 'metaball';
  id: string;
  createdAt: string;
  status: 'draft' | 'running' | 'done' | 'error';
  /** Optional fields keep the first deployed history format readable. */
  schemaVersion?: 2;
  parentId?: string;
  promptVersionId?: string;
  object?: { params: AIRenderParams; document: string; shapeUrl: string };
  assistant?: { instruction: string; previousScene: string; explanation: string; model: string };
  prompt: string;
  model?: string;
  error?: string;
  imageUrl?: string;
  imageMime?: 'image/png' | 'image/jpeg' | 'image/webp';
  enhancement?: { sourceId: string; scaleFactor: 2 | 4; creativity: number; resemblance: number };
  referenceUrl?: string;
};

export function buildImageStudioPrompt(input: ImageStudioRequest): string {
  return `Create one editorial photograph.\n\nSCENE\n${input.scene}\n\nART DIRECTION\n${input.style}\n\n${input.referenceImage ? 'REFERENCE IMAGE\nUse the supplied image as the subject and composition reference. Preserve its recognizable subjects, gesture and framing while applying the scene and art direction above.' : 'Compose a new image from the scene and art direction above.'}\n\nOUTPUT\nOne finished photograph. No captions, watermark, border or added branding.`;
}

export function studyLabel(study: ImageStudy): string {
  return study.object || study.variant === 'metaball' ? '3D Metaball' : imageStyles[study.variant].name;
}
export type ObjectStudyRequest = {
  params: AIRenderParams;
  document: string;
  shapeImage: string;
  materialImage?: string | null;
  parentId?: string;
};
