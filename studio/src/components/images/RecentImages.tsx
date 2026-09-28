import { Loader2Icon } from 'lucide-react';
import { imageStyles, studyLabel, type ImageStudy, type ImageVariant } from '../../../lib/image-studio-contract';
import { SelectField } from '../toolbar/fields';
import { Button } from '../ui/button';

const variants = Object.keys(imageStyles) as ImageVariant[];
const filterOptions = [
  { value: 'all' as const, label: 'All styles' },
  ...variants.map((key) => ({ value: key, label: imageStyles[key].name })),
];

/**
 * The grid of past generations under the stage, with its style filter and
 * "load more" — split out of ImageStudio so the recent-work list is its own
 * readable unit rather than the tail end of one long return.
 */
export function RecentImages({
  studies,
  selectedId,
  loading,
  hasMore,
  filter,
  onFilterChange,
  onSelect,
  onLoadMore,
}: {
  studies: ImageStudy[];
  selectedId?: string;
  loading: boolean;
  hasMore: boolean;
  filter: ImageVariant | 'all';
  onFilterChange: (filter: ImageVariant | 'all') => void;
  onSelect: (study: ImageStudy) => void;
  onLoadMore: () => void;
}) {
  const visible = studies.filter((study) => filter === 'all' || study.variant === filter);
  return (
    <div className="mt-10 border-t pt-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl">Recent images</h2>
          <p className="mt-1 text-xs text-muted-foreground">Stored on the server. Private to this browser.</p>
        </div>
        <SelectField
          label="Filter"
          value={filter}
          options={filterOptions}
          onValueChange={onFilterChange}
        />
      </div>
      {studies.length === 0 ? (
        <p className="py-7 text-sm text-muted-foreground">
          {loading ? 'Loading your studies…' : 'A collection starts with one image. Your generations will appear here.'}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {visible.map((study) => (
            <button
              key={study.id}
              aria-pressed={selectedId === study.id}
              onClick={() => onSelect(study)}
              className={`group min-w-0 overflow-hidden rounded-lg border text-left transition-colors ${
                selectedId === study.id
                  ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background'
                  : 'hover:border-foreground/40'
              }`}
            >
              <div className="flex aspect-[4/3] items-center justify-center bg-muted">
                {study.imageUrl ? (
                  <img loading="lazy" src={study.imageUrl} alt={study.scene} className="size-full object-cover" />
                ) : study.status === 'running' ? (
                  <Loader2Icon className="size-5 animate-spin" />
                ) : (
                  <span className="text-xs text-muted-foreground">Couldn’t generate</span>
                )}
              </div>
              <div className="p-3">
                <span className="block truncate text-xs">{study.scene}</span>
                <span className="mt-1 block font-mono text-[9px] text-muted-foreground">
                  {studyLabel(study)} · {new Date(study.createdAt).toLocaleDateString()}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
      {hasMore && (
        <Button variant="outline" className="mt-5" disabled={loading} onClick={onLoadMore}>
          {loading ? 'Loading…' : 'Load older images'}
        </Button>
      )}
    </div>
  );
}
