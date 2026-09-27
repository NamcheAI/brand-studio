import { MarkPanel } from './panels/MarkPanel';
import { ObjectPanel } from './panels/ObjectPanel';
import type { MarkPanelProps, ObjectPanelProps } from './panels/types';
import type { FileActions } from './toolbar/file-menu';
import { TopBar, type HistoryActions } from './toolbar/top-bar';
import { TooltipProvider } from '@/components/ui/tooltip';

type Props = {
  history: HistoryActions;
  file: FileActions;
} & ({ view: '2d'; panel: MarkPanelProps } | { view: '3d'; panel: ObjectPanelProps });

/**
 * The editing chrome around the stage: the app bar (history + File) and the
 * step-tabbed side panel for the current workspace. It edits state only;
 * the stage renders it.
 */
export default function Toolbar(props: Props) {
  return (
    <TooltipProvider>
      <TopBar view={props.view} history={props.history} file={props.file} />
      {props.view === '2d' ? <MarkPanel {...props.panel} /> : <ObjectPanel {...props.panel} />}
    </TooltipProvider>
  );
}
