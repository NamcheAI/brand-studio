import { Redo2Icon, Undo2Icon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { StudioAppBar } from '@/components/shell/StudioAppBar';

import { FileMenu, type FileActions } from './file-menu';

type ViewMode = '2d' | '3d';

export type HistoryActions = {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
};

/**
 * Document-level actions only: history and the File menu. Canvas-level
 * controls (Form | Graph, playback) live on the stage, next to what they
 * change.
 */
export function TopBar({
  view,
  history,
  file,
}: {
  view: ViewMode;
  history: HistoryActions;
  file: FileActions;
}) {
  return (
    <StudioAppBar
      active={view === '2d' ? 'mark' : 'object'}
      className="md:col-span-2"
      actions={
        <>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={!history.canUndo}
                  onClick={history.onUndo}
                >
                  <Undo2Icon />
                  <span className="sr-only">Undo</span>
                </Button>
              }
            />
            <TooltipContent>
              Undo
              <KbdGroup>
                <Kbd>⌘</Kbd>
                <Kbd>Z</Kbd>
              </KbdGroup>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={!history.canRedo}
                  onClick={history.onRedo}
                >
                  <Redo2Icon />
                  <span className="sr-only">Redo</span>
                </Button>
              }
            />
            <TooltipContent>
              Redo
              <KbdGroup>
                <Kbd>⇧</Kbd>
                <Kbd>⌘</Kbd>
                <Kbd>Z</Kbd>
              </KbdGroup>
            </TooltipContent>
          </Tooltip>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <FileMenu view={view} actions={file} />
        </>
      }
    />
  );
}
