import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Disclosure, Expert } from '../toolbar/disclosure';
import { Hint, SwitchField } from '../toolbar/fields';
import { PresetGrid, Segmented } from '../toolbar/segmented';
import { SliderField } from '../toolbar/slider-field';
import {
  GOO_STD_MAX,
  GOO_STD_MIN,
  GOO_THRESHOLD_MAX,
  GOO_THRESHOLD_MIN,
  INWARD_PULL_MAX,
  INWARD_PULL_MIN,
  PRESETS,
  TUBE_FACTOR_MAX,
  TUBE_FACTOR_MIN,
  type Size,
} from '../../lib/model';
import { cn } from '@/lib/utils';
import type {
  FormTuning,
  MarkShapeProps,
  SelectedEdge,
  SelectedNode,
  ShapePresets,
} from './types';

const SIZES: Size[] = ['S', 'M', 'L', 'XL'];

function ShapePresetGrid({ presets }: { presets: ShapePresets }) {
  return (
    <PresetGrid
      label="Shape presets"
      value={presets.activePresetId}
      onValueChange={presets.onApply}
      options={PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))}
    />
  );
}

/** Global neck/blur/contrast/pinch — shared by the Mark and Object shape tabs. */
export function FormTuningFields({ form }: { form: FormTuning }) {
  const { values, scrub, commit } = form;
  return (
    <Disclosure label="Fine-tune form">
      <SliderField
        label="Neck width"
        value={values.tubeFactor}
        min={TUBE_FACTOR_MIN}
        max={TUBE_FACTOR_MAX}
        step={0.01}
        onChange={(v) => scrub('tubeFactor', v)}
        onCommit={commit}
      />
      <Hint>Capsule thickness before blur.</Hint>
      <SliderField
        label="Blur"
        value={values.gooStd}
        min={GOO_STD_MIN}
        max={GOO_STD_MAX}
        step={0.5}
        onChange={(v) => scrub('gooStd', v)}
        onCommit={commit}
      />
      <Hint>Spread of the merge — softer, wider joins.</Hint>
      <SliderField
        label="Contrast"
        value={values.gooThreshold}
        min={GOO_THRESHOLD_MIN}
        max={GOO_THRESHOLD_MAX}
        step={0.5}
        onChange={(v) => scrub('gooThreshold', v)}
        onCommit={commit}
      />
      <Hint>Alpha cutoff — higher = sharper waist, tighter neck.</Hint>
      <SliderField
        label="Pinch / merge"
        value={values.inwardPull}
        min={INWARD_PULL_MIN}
        max={INWARD_PULL_MAX}
        step={0.01}
        onChange={(v) => scrub('inwardPull', v)}
        onCommit={commit}
      />
      <Hint>
        Barbell tubes at 0 → pinched metaball at 1. Also boosts effective blur as tubes fade.
      </Hint>
    </Disclosure>
  );
}

/** Contextual card: highlighted so it reads as "about the thing you clicked". */
function SelectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      aria-label={title}
      className={cn('flex flex-col gap-3 rounded-lg border border-primary/40 bg-muted/40 p-3')}
    >
      <h3 className="font-mono text-[0.625rem] tracking-widest text-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

function SelectedNodeCard({ node }: { node: SelectedNode }) {
  return (
    <SelectionCard title="Selected node">
      <Segmented
        label="Node size"
        value={node.size}
        onValueChange={node.onSizeChange}
        options={SIZES.map((size) => ({ value: size, label: size }))}
      />
      {node.radius !== null && (
        <>
          <SliderField
            label="Radius"
            value={node.radius}
            min={node.radiusMin}
            max={node.radiusMax}
            step={1}
            onChange={node.onRadiusChange}
            onCommit={node.onRadiusCommit}
          />
          <Hint>
            {node.radiusOverridden
              ? 'Custom radius active. Size presets reset it.'
              : 'Using preset size radius.'}
          </Hint>
        </>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!node.radiusOverridden}
          onClick={node.onRadiusReset}
        >
          Preset radius
        </Button>
        <Button variant="destructive" size="sm" onClick={node.onDelete}>
          Delete node
        </Button>
      </div>
      <Hint>
        Arrow keys nudge (1 px). Shift+arrow nudges 5 px. Alt/Shift+drag moves a node to another
        cell.
      </Hint>
    </SelectionCard>
  );
}

function SelectedEdgeCard({ edge, graph }: { edge: SelectedEdge; graph: boolean }) {
  // Graph mode edits topology only; neck and pinch are Form concerns.
  if (graph) {
    return (
      <SelectionCard title="Selected connection">
        <Button variant="destructive" size="sm" className="w-full" onClick={edge.onRemove}>
          Remove connection
        </Button>
      </SelectionCard>
    );
  }
  const customized = edge.factorOverridden || edge.pullOverridden;
  return (
    <SelectionCard title="Selected connection">
      <SwitchField
        label="Customize this connection"
        checked={customized}
        onCheckedChange={(next) => {
          if (next) edge.onEnableStyle();
          else edge.onDisableStyle();
        }}
      />
      {customized ? (
        <>
          <SliderField
            label="Neck width"
            value={edge.factor}
            min={TUBE_FACTOR_MIN}
            max={TUBE_FACTOR_MAX}
            step={0.01}
            onChange={edge.onFactorChange}
            onCommit={edge.onFactorCommit}
          />
          <Hint>Capsule thickness for this connection before blur.</Hint>
          <SliderField
            label="Pinch"
            value={edge.pull}
            min={INWARD_PULL_MIN}
            max={INWARD_PULL_MAX}
            step={0.01}
            onChange={edge.onPullChange}
            onCommit={edge.onPullCommit}
          />
          <Hint>How much tube remains on this join — 0 keeps a barbell, 1 fades the tube.</Hint>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!edge.factorOverridden}
              onClick={edge.onFactorReset}
            >
              Reset neck
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!edge.pullOverridden}
              onClick={edge.onPullReset}
            >
              Reset pinch
            </Button>
          </div>
        </>
      ) : (
        <Hint>
          Turn on to override global Neck and Pinch for this join only. Blur and Contrast stay
          global.
        </Hint>
      )}
      <Button variant="destructive" size="sm" className="w-full" onClick={edge.onRemove}>
        Remove connection
      </Button>
    </SelectionCard>
  );
}

export function MarkShapeTab({
  mode,
  presets,
  form,
  node,
  edge,
  fullGrid,
  onFullGridChange,
}: MarkShapeProps) {
  const graph = mode === 'graph';
  return (
    <>
      {node && <SelectedNodeCard node={node} />}
      {edge && <SelectedEdgeCard edge={edge} graph={graph} />}
      <ShapePresetGrid presets={presets} />
      {!node && !edge && (
        <Hint>
          {graph
            ? 'Click a connection between two nodes to select it.'
            : 'Click a node or a connection on the canvas to edit it.'}
        </Hint>
      )}
      {!graph && <FormTuningFields form={form} />}
      <Expert>
        <SwitchField
          label="Allow nodes in outer cells"
          checked={fullGrid}
          onCheckedChange={onFullGridChange}
        />
      </Expert>
    </>
  );
}

export function ObjectShapeTab({ presets, form }: { presets: ShapePresets; form: FormTuning }) {
  return (
    <>
      <ShapePresetGrid presets={presets} />
      <FormTuningFields form={form} />
    </>
  );
}
