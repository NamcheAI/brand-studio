import { imageStyles, type ImageVariant } from '../../../lib/image-studio-contract';

const variants = Object.keys(imageStyles) as ImageVariant[];

/**
 * Step 1 of the Images flow. The three style cards used to sit under a huge
 * H1 with the full style description below it — now the description is a
 * single line under the cards, so "which style" and "what it means" read as
 * one glance instead of a page-length introduction.
 */
export function StylePicker({
  value,
  onValueChange,
}: {
  value: ImageVariant;
  onValueChange: (variant: ImageVariant) => void;
}) {
  return (
    <div>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Image style">
        {variants.map((key, index) => (
          <button
            key={key}
            type="button"
            aria-pressed={value === key}
            onClick={() => onValueChange(key)}
            className={`image-style-card ${value === key ? 'is-selected' : ''}`}
          >
            <span className={`image-style-swatch image-style-${key}`} aria-hidden="true">
              <span />
            </span>
            <span className="mt-2 block text-[11px]">{imageStyles[key].name}</span>
            <span className="sr-only">Style {index + 1}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {imageStyles[value].description}
      </p>
    </div>
  );
}
