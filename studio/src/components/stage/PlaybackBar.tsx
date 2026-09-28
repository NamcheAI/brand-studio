import { PlayIcon, SquareIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { allLoopMotions, type LoopMotionId } from '../../lib/motion';

const LOOP_MOTIONS = allLoopMotions();
const NO_MOTION = 'none';

export type Playback = {
  growing: boolean;
  canGrow: boolean;
  onGrowToggle: () => void;
  activeMotion: LoopMotionId | null;
  canMotion: boolean;
  onMotionToggle: (id: LoopMotionId) => void;
  breakNecks: boolean;
  onBreakNecksChange: (value: boolean) => void;
};

const MOTION_OPTIONS = [
  { value: NO_MOTION, label: 'No loop', hint: 'Show the authored, resting mark.' },
  ...LOOP_MOTIONS.map((motion) => ({ value: motion.id, label: motion.label, hint: motion.hint })),
];

/**
 * Motion as a compact transport under the stage: preview-only playback of
 * the current mark or object. Exports always restore the resting geometry.
 */
export function PlaybackBar({ playback }: { playback: Playback }) {
  const {
    growing,
    canGrow,
    onGrowToggle,
    activeMotion,
    canMotion,
    onMotionToggle,
    breakNecks,
    onBreakNecksChange,
  } = playback;
  const activeHint = MOTION_OPTIONS.find((option) => option.value === (activeMotion ?? NO_MOTION))
    ?.hint;

  return (
    <div role="group" aria-label="Motion" className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="hidden font-mono text-[0.625rem] tracking-widest text-muted-foreground uppercase sm:inline">
        Motion
      </span>

      <Select
        value={activeMotion ?? NO_MOTION}
        disabled={!canMotion && activeMotion === null}
        onValueChange={(next) => {
          if (next === NO_MOTION) {
            if (activeMotion) onMotionToggle(activeMotion);
            return;
          }
          onMotionToggle(next as LoopMotionId);
        }}
      >
        <SelectTrigger size="sm" className="min-w-32" aria-label="Loop" title={activeHint}>
          <SelectValue>
            {(current: string) =>
              MOTION_OPTIONS.find((option) => option.value === current)?.label ?? ''
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {MOTION_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value} title={option.hint}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {activeMotion && (
        <Button variant="outline" size="sm" onClick={() => onMotionToggle(activeMotion)}>
          <SquareIcon data-icon="inline-start" />
          Stop loop
        </Button>
      )}

      <Button
        variant="outline"
        size="sm"
        disabled={!canGrow && !growing}
        onClick={onGrowToggle}
      >
        {growing ? <SquareIcon data-icon="inline-start" /> : <PlayIcon data-icon="inline-start" />}
        {growing ? 'Stop growth' : 'Grow once'}
      </Button>

      <Label className="ml-auto flex items-center gap-2 text-xs font-normal">
        <span className={activeMotion ? undefined : 'opacity-50'}>Necks can break</span>
        <Switch
          size="sm"
          checked={breakNecks}
          disabled={!activeMotion}
          onCheckedChange={(value) => onBreakNecksChange(value)}
        />
      </Label>
    </div>
  );
}
