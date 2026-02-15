import React from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Archive, Pencil, Play, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SessionListViewProps<T extends { id: number }> {
  sessions: T[];
  isLoading?: boolean;
  error?: Error | null;
  renderTitle: (session: T) => string;
  renderMetrics: (session: T) => React.ReactNode;
  onPreview: (session: T) => void;
  onEdit: (session: T) => void;
  onArchive?: (session: T) => void;
  onDelete: (session: T) => void;
  canDelete: (sessionId: number) => boolean;
  isDeleting?: boolean;
}

export function SessionListView<T extends { id: number }>({
  sessions,
  isLoading,
  error,
  renderTitle,
  renderMetrics,
  onPreview,
  onEdit,
  onArchive,
  onDelete,
  canDelete,
  isDeleting,
}: SessionListViewProps<T>) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={`skeleton-${i}`} className="rounded-2xl border-border">
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <Skeleton className="h-9 w-9 rounded-full" />
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="font-semibold">Impossible de charger les données</h3>
        <p className="text-sm text-muted-foreground mt-2">
          {error instanceof Error ? error.message : "Une erreur s'est produite"}
        </p>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted px-3 py-6 text-center text-sm text-muted-foreground">
        Aucune séance trouvée. Crée une nouvelle séance pour commencer.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((session) => {
        const canDeleteSession = canDelete(session.id);
        const deleteDisabled = !canDeleteSession || isDeleting;

        return (
          <Card key={session.id} className="rounded-2xl border-border">
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold tracking-tight truncate">
                    {renderTitle(session)}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    {renderMetrics(session)}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onPreview(session)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
                    aria-label="Aperçu"
                    title="Aperçu"
                  >
                    <Play className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(session)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
                    aria-label="Modifier"
                    title="Modifier"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  {onArchive && (
                    <button
                      type="button"
                      onClick={() => onArchive(session)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
                      aria-label="Archiver"
                      title="Archiver"
                    >
                      <Archive className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (deleteDisabled) return;
                      onDelete(session);
                    }}
                    className={cn(
                      "inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted",
                      deleteDisabled && "cursor-not-allowed text-muted-foreground"
                    )}
                    aria-label="Supprimer"
                    title={canDeleteSession ? "Supprimer" : "Suppression indisponible"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
