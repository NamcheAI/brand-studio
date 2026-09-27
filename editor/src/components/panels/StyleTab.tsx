import { Button } from '@/components/ui/button';
import { Disclosure } from '../toolbar/disclosure';
import { ColorField, GroupLabel, Hint, SwitchField } from '../toolbar/fields';
import { Segmented } from '../toolbar/segmented';
import { CANVAS_THEMES, THEME_PRESETS, canvasThemeId, type CanvasThemeId } from '../../lib/model';
import type { MarkStyleProps } from './types';

/** Mark step 2 — canvas, mark colour and the optional Namche raster (2D only). */
export function StyleTab({
  theme,
  onThemeChange,
  onThemeCommit,
  rasterEnabled,
  onRasterEnabledChange,
}: MarkStyleProps) {
  return (
    <>
      {/* The canvas theme is part of the document, so what you see here is
          what an export looks like — no presentation-only dark mode for the
          artwork. */}
      <div className="flex flex-col gap-1.5">
        <GroupLabel>Canvas</GroupLabel>
        <Segmented
          label="Canvas theme"
          value={canvasThemeId(theme)}
          onValueChange={(id: CanvasThemeId) => {
            onThemeChange({ ...CANVAS_THEMES[id] });
            onThemeCommit();
          }}
          options={[
            {
              value: 'day',
              label: 'Day',
              hint: 'White ground, black mark, full-strength raster.',
            },
            {
              value: 'night',
              label: 'Night',
              hint: 'Erebos ground, Selene mark, raster on the night ramp.',
            },
          ]}
        />
      </div>
      <ColorField
        label="Mark colour"
        value={theme.ink}
        onChange={(v) => onThemeChange({ ...theme, ink: v })}
        onCommit={onThemeCommit}
      />
      <SwitchField
        label="Namche raster"
        checked={rasterEnabled}
        onCheckedChange={onRasterEnabledChange}
      />
      <Hint>The raster is optional appearance — it never becomes part of the exported mark.</Hint>
      {rasterEnabled && (
        <Disclosure label="Raster colours">
          <ColorField
            label="Outer cells"
            value={theme.pink}
            onChange={(v) => onThemeChange({ ...theme, pink: v })}
            onCommit={onThemeCommit}
          />
          <ColorField
            label="Inner cells"
            value={theme.blue}
            onChange={(v) => onThemeChange({ ...theme, blue: v })}
            onCommit={onThemeCommit}
          />
          <ColorField
            label="Background"
            value={theme.bg}
            onChange={(v) => onThemeChange({ ...theme, bg: v })}
            onCommit={onThemeCommit}
          />
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              const preset = THEME_PRESETS[0];
              if (!preset) return;
              onThemeChange({ ...preset.theme, ink: theme.ink });
              onThemeCommit();
            }}
          >
            Reset raster colours
          </Button>
        </Disclosure>
      )}
    </>
  );
}
