type ViewMode = '2d' | '3d';

export type FileActions = {
  onImportJson: () => void;
  onExportJson: () => void;
  /** 3D only: mesh without material or scene. */
  onExportGlb?: () => void;
  /** 3D only: zip of mesh, preview and universal prompt for Blender MCP. */
  onExportBlender?: () => void;
  /** Confirmed through the alert dialog; the menu never clears directly. */
  onClear: () => void;
};

export type FileMenuItemId = 'import-json' | 'export-json' | 'export-glb' | 'export-blender' | 'clear';

export type FileMenuItem = {
  id: FileMenuItemId;
  label: string;
  hint?: string;
  destructive?: boolean;
  /** Draw a separator before this item. */
  separated?: boolean;
};

/**
 * The File menu's items per view. A plain function so the (portalled, lazily
 * mounted) menu contents stay testable without a DOM.
 */
export function fileMenuItems(view: ViewMode): FileMenuItem[] {
  return [
    { id: 'import-json', label: 'Import JSON…' },
    { id: 'export-json', label: 'Export JSON', hint: 'Editable document' },
    ...(view === '3d'
      ? ([
          { id: 'export-glb', label: 'Export GLB', hint: 'Mesh only' },
          {
            id: 'export-blender',
            label: 'Export for Blender',
            hint: 'Zip: mesh + preview + prompt',
          },
        ] satisfies FileMenuItem[])
      : []),
    { id: 'clear', label: 'Clear canvas…', destructive: true, separated: true },
  ];
}

