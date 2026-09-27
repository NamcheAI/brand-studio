import { ChevronDownIcon, FolderIcon } from 'lucide-react';
import { Fragment, useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { fileMenuItems, type FileActions, type FileMenuItemId } from './file-menu-items';

export type { FileActions } from './file-menu-items';

type ViewMode = '2d' | '3d';

export function FileMenu({ view, actions }: { view: ViewMode; actions: FileActions }) {
  const [confirmClear, setConfirmClear] = useState(false);

  const run: Record<FileMenuItemId, (() => void) | undefined> = {
    'import-json': actions.onImportJson,
    'export-json': actions.onExportJson,
    'export-glb': actions.onExportGlb,
    'export-blender': actions.onExportBlender,
    clear: () => setConfirmClear(true),
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="sm" aria-label="File" className="px-2 sm:px-3">
              {/* Icon-only on phones, where the workspace nav needs the room. */}
              <FolderIcon className="sm:hidden" />
              <span className="hidden sm:inline">File</span>
              <ChevronDownIcon data-icon="inline-end" className="hidden sm:block" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-72">
          {fileMenuItems(view).map((item) => (
            <Fragment key={item.id}>
              {item.separated && <DropdownMenuSeparator />}
              <DropdownMenuItem
                variant={item.destructive ? 'destructive' : 'default'}
                disabled={!run[item.id]}
                onClick={() => run[item.id]?.()}
              >
                <span className="flex-1">{item.label}</span>
                {item.hint && (
                  <span className="text-[0.625rem] text-muted-foreground">{item.hint}</span>
                )}
              </DropdownMenuItem>
            </Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Controlled and outside the menu, so the dialog survives the menu
          closing on item click. */}
      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear the canvas?</AlertDialogTitle>
            <AlertDialogDescription>This removes every node. You can undo.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                actions.onClear();
                setConfirmClear(false);
              }}
            >
              Clear canvas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
