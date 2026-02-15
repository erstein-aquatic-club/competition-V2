import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FolderInput } from "lucide-react";
import type { StrengthFolder } from "@/lib/api";

interface MoveToFolderPopoverProps {
  folders: StrengthFolder[];
  currentFolderId?: number | null;
  onMove: (folderId: number | null) => void;
  children?: React.ReactNode;
}

export function MoveToFolderPopover({
  folders,
  currentFolderId,
  onMove,
  children,
}: MoveToFolderPopoverProps) {
  const [open, setOpen] = useState(false);

  function handleSelect(folderId: number | null) {
    onMove(folderId);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children ?? (
          <button
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
            aria-label="Déplacer"
            title="Déplacer vers un dossier"
          >
            <FolderInput className="h-4 w-4" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1" align="end">
        <button
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
          style={{ fontWeight: !currentFolderId ? "bold" : undefined }}
          onClick={() => handleSelect(null)}
        >
          Aucun dossier
        </button>
        {folders.map((folder) => (
          <button
            key={folder.id}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
            style={{
              fontWeight: currentFolderId === folder.id ? "bold" : undefined,
            }}
            onClick={() => handleSelect(folder.id)}
          >
            {folder.name}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
