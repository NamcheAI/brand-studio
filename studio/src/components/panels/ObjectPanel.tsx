import { useState } from 'react';

import AIRenderPanel from '../AIRenderPanel';
import { SceneTab } from './SceneTab';
import { ObjectShapeTab } from './ShapeTab';
import { StepPanel } from './StepPanel';
import { SurfaceTab } from './SurfaceTab';
import type { ObjectPanelProps } from './types';

type ObjectStep = 'shape' | 'surface' | 'scene' | 'render';

/** Object (3D): Shape → Surface → Scene → Render. Motion lives on the stage. */
export function ObjectPanel(props: ObjectPanelProps) {
  const [step, setStep] = useState<ObjectStep>('shape');
  return (
    <StepPanel<ObjectStep>
      label="Object steps"
      value={step}
      onValueChange={setStep}
      steps={[
        { id: 'shape', label: 'Shape', content: <ObjectShapeTab {...props.shape} /> },
        { id: 'surface', label: 'Surface', content: <SurfaceTab {...props.surface} /> },
        { id: 'scene', label: 'Scene', content: <SceneTab {...props.scene} /> },
        { id: 'render', label: 'Render', content: <AIRenderPanel {...props.render} /> },
      ]}
    />
  );
}
