import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Expert } from '../toolbar/disclosure';
import { Hint, SelectField, SwitchField } from '../toolbar/fields';
import { SliderField } from '../toolbar/slider-field';
import {
  FLATTEN_EPSILON_MAX,
  FLATTEN_EPSILON_MIN,
  FLATTEN_RESOLUTION_MAX,
  FLATTEN_RESOLUTION_MIN,
  PNG_SCALES,
  type PngScale,
} from '../../lib/model';
import type { MarkExportProps } from './types';

/** Mark step 3 — vector and raster export of the mark (Form mode only). */
export function ExportTab({
  mode,
  markOnly,
  onMarkOnlyChange,
  pngScale,
  onPngScaleChange,
  onExportSvg,
  onExportPng,
  onCopySvg,
  showExportPreview,
  onShowExportPreviewChange,
  flattenEpsilon,
  flattenResolution,
  onFlattenScrub,
  onFlattenCommit,
}: MarkExportProps) {
  if (mode === 'graph') {
    return (
      <Hint>
        Switch to Form to export SVG or PNG. Editable graph data stays available as JSON in the
        File menu.
      </Hint>
    );
  }

  const handleCopy = async () => {
    if (await onCopySvg()) toast.success('SVG copied to the clipboard.');
    else toast.error('Could not copy the SVG.');
  };

  return (
    <>
      <SwitchField
        label="Mark only (transparent)"
        checked={markOnly}
        onCheckedChange={onMarkOnlyChange}
      />
      <SelectField
        label="PNG scale"
        value={String(pngScale)}
        onValueChange={(next) => onPngScaleChange(Number(next) as PngScale)}
        options={PNG_SCALES.map((scale) => ({ value: String(scale), label: `${scale}×` }))}
      />
      <Button className="w-full" onClick={onExportSvg}>
        Export SVG
      </Button>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={onExportPng}>
          Export PNG
        </Button>
        <Button variant="outline" size="sm" onClick={() => void handleCopy()}>
          Copy SVG
        </Button>
      </div>
      <Hint>Motion is preview-only: exports always use the authored, resting mark.</Hint>
      <Expert>
        <SwitchField
          label="Show export preview overlay"
          checked={showExportPreview}
          onCheckedChange={onShowExportPreviewChange}
        />
        <SliderField
          label="Flatten detail"
          value={flattenEpsilon}
          min={FLATTEN_EPSILON_MIN}
          max={FLATTEN_EPSILON_MAX}
          step={0.1}
          onChange={(v) => onFlattenScrub('flattenEpsilon', v)}
          onCommit={onFlattenCommit}
        />
        <SliderField
          label="Flatten res."
          value={flattenResolution}
          min={FLATTEN_RESOLUTION_MIN}
          max={FLATTEN_RESOLUTION_MAX}
          step={1}
          onChange={(v) => onFlattenScrub('flattenResolution', v)}
          onCommit={onFlattenCommit}
        />
      </Expert>
    </>
  );
}
