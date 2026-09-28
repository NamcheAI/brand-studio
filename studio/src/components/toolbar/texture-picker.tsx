import { cn } from '@/lib/utils';
import { TEXTURE_OPTIONS, textureThumbUrl } from '../../lib/texturePresets';
import { GroupLabel } from './fields';
import { Disclosure } from './disclosure';
import { Button } from '@/components/ui/button';

/**
 * Thumbnail grid over the NAMCHE curated texture imagery. Thumbnails stream
 * from cdn.namche.ai (≤480px WebP, immutable); the selection is a slug from
 * @namche/imagery, so a texture retired upstream disappears from the grid on
 * the next dependency bump instead of breaking silently.
 */
export function TexturePicker({
  value,
  onValueChange,
}: {
  value: string | null;
  onValueChange: (slug: string | null) => void;
}) {
  const selected = TEXTURE_OPTIONS.find((image) => image.slug === value) ?? null;
  return (
    <div className="flex flex-col gap-2">
      <GroupLabel>Surface texture</GroupLabel>
      {selected && (
        <div className="flex items-center gap-2">
          <img
            src={textureThumbUrl(selected.slug)}
            alt=""
            className="h-8 w-8 rounded-md border border-primary object-cover"
          />
          <span className="min-w-0 flex-1 truncate font-mono text-[0.625rem] text-muted-foreground">
            {selected.slug}
          </span>
          <Button variant="outline" size="xs" onClick={() => onValueChange(null)}>
            Off
          </Button>
        </div>
      )}
      <Disclosure label={selected ? 'Change texture' : 'Choose texture'}>
      <div role="listbox" aria-label="Surface texture" className="grid grid-cols-5 gap-1.5">
        <button
          type="button"
          role="option"
          aria-selected={value === null}
          onClick={() => onValueChange(null)}
          className={cn(
            'aspect-square rounded-md border text-[10px] leading-tight text-muted-foreground',
            value === null
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-transparent hover:border-foreground/40',
          )}
        >
          Off
        </button>
        {TEXTURE_OPTIONS.map((image) => (
          <button
            key={image.slug}
            type="button"
            role="option"
            aria-selected={value === image.slug}
            title={`${image.theme.replace('_', ' · ')} — ${image.original}`}
            onClick={() => onValueChange(value === image.slug ? null : image.slug)}
            className={cn(
              'aspect-square overflow-hidden rounded-md border transition-colors',
              value === image.slug
                ? 'border-primary ring-2 ring-primary'
                : 'border-border hover:border-foreground/40',
            )}
          >
            <img
              src={textureThumbUrl(image.slug)}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </button>
        ))}
      </div>
      </Disclosure>
    </div>
  );
}
