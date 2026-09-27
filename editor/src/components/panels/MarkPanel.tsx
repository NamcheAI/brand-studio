import { useEffect, useState } from 'react';

import { ExportTab } from './ExportTab';
import { MarkShapeTab } from './ShapeTab';
import { StepPanel } from './StepPanel';
import { StyleTab } from './StyleTab';
import type { MarkPanelProps } from './types';

type MarkStep = 'shape' | 'style' | 'export';

/** Mark (2D): Shape → Style → Export. Motion lives on the stage. */
export function MarkPanel(props: MarkPanelProps) {
  const [step, setStep] = useState<MarkStep>('shape');

  // Selecting on the canvas is shape editing, so bring the selection card
  // into view instead of leaving it hidden behind another tab.
  const { selectionId } = props;
  useEffect(() => {
    if (selectionId) setStep('shape');
  }, [selectionId]);

  return (
    <StepPanel<MarkStep>
      label="Mark steps"
      value={step}
      onValueChange={setStep}
      steps={[
        { id: 'shape', label: 'Shape', content: <MarkShapeTab {...props.shape} /> },
        { id: 'style', label: 'Style', content: <StyleTab {...props.style} /> },
        { id: 'export', label: 'Export', content: <ExportTab {...props.export} /> },
      ]}
    />
  );
}
