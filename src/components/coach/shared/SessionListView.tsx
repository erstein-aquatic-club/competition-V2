import React from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Archive, Layers, Pencil, Play, Route, Timer, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SwimSessionTemplate, Assignment } from "@/lib/api";
import { calculateSwimTotalDistance } from "@/lib/swimSessionUtils";

interface SessionListViewProps {
  sessions: SwimSessionTemplate[];
  isLoading?: boolean;
  error?: Error | null;
  onPreview: (session: SwimSessionTemplate) => void;
  onEdit: (session: SwimSessionTemplate) => void;
  onArchive: (session: SwimSessionTemplate) => void;
  onDelete: (session: SwimSessionTemplate) => void;
  canDelete: (sessionId: number) => boolean;
  isDeleting?: boolean;
  assignments?: Assignment[] | null;
}

const countBlocks = (items: any[] = []) => {
  const keys = new Set(
    items.map((item) => {
      const raw = item.raw_payload as Record<string, unknown> | null;
      return raw?.block_title || raw?.section || "Bloc";
    }),
  );
  return keys.size;
};

const getSessionMetrics = (session: SwimSessionTemplate) => {
  const totalDistance = calculateSwimTotalDistance(session.items ?? []);
  const hasDuration = session.items?.some((item) => item.duration != null) ?? false;
  const totalDuration = hasDuration
    ? session.items?.reduce((sum, item) => sum + (item.duration ?? 0), 0) ?? 0
    : null;
  const blockCount = countBlocks(session.items ?? []);
  return { totalDistance, totalDuration, blockCount };
};

export function SessionListView({
  sessions,
  isLoading,
  error,
  onPreview,
  onEdit,
  onArchive,
  onDelete,
  canDelete,
  isDeleting,
  assignments,
}: SessionListViewProps) {
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
        const { totalDistance, totalDuration, blockCount } = getSessionMetrics(session);
        const canDeleteSession = canDelete(session.id);
        const deleteDisabled = !canDeleteSession || isDeleting;

        return (
          <Card key={session.id} className="rounded-2xl border-border">
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold tracking-tight">{session.name}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Route className="h-3.5 w-3.5" />
                      {totalDistance}m
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Timer className="h-3.5 w-3.5" />
                      ~{totalDuration ?? "—"} min
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Layers className="h-3.5 w-3.5" />
                      {blockCount}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onPreview(session)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
                    aria-label="Aperçu nageur"
                    title="Aperçu nageur"
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
                  <button
                    type="button"
                    onClick={() => onArchive(session)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
                    aria-label="Archiver"
                    title="Archiver"
                  >
                    <Archive className="h-4 w-4" />
                  </button>
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
                    title={
                      assignments === null
                        ? "Suppression désactivée"
                        : canDeleteSession
                          ? "Supprimer"
                          : "Séance déjà assignée"
                    }
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
