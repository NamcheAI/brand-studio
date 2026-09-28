import { ImagePlusIcon, XIcon } from 'lucide-react';
import type { RefObject } from 'react';
import { Button } from '../ui/button';

/**
 * Step 3 of the Images flow: an optional starting image. Same upload and
 * removal behaviour as before (validation, drag target, preview) — only
 * split out so ImageStudio reads as a flow instead of one long return.
 */
export function ReferenceField({
  uploadRef,
  reference,
  referenceName,
  onSelectFile,
  onRemove,
}: {
  uploadRef: RefObject<HTMLInputElement | null>;
  reference?: string;
  referenceName: string;
  onSelectFile: (file?: File) => void;
  onRemove: () => void;
}) {
  return (
    <div>
      <input
        ref={uploadRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        aria-label="Upload reference image"
        onChange={(event) => {
          onSelectFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {reference ? (
        <div className="flex items-center gap-3 rounded-lg border p-2">
          <img src={reference} alt="Generation reference" className="size-14 rounded object-cover" />
          <span className="min-w-0 flex-1 truncate text-xs">{referenceName}</span>
          <Button type="button" size="icon-sm" variant="ghost" aria-label="Remove reference" onClick={onRemove}>
            <XIcon />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => uploadRef.current?.click()}
          className="flex w-full items-center gap-3 rounded-lg border border-dashed px-4 py-4 text-left text-sm hover:bg-muted"
        >
          <ImagePlusIcon className="size-5 text-muted-foreground" />
          <span>
            Add a starting image
            <span className="mt-1 block text-xs text-muted-foreground">PNG, JPG or WebP · up to 4 MB</span>
          </span>
        </button>
      )}
    </div>
  );
}
