import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Assignment, SwimSessionItem, SwimSessionTemplate } from "@/lib/api";
import type { SwimSessionInput, SwimPayloadFields } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { SwimSessionConsultation } from "@/components/swim/SwimSessionConsultation";
import { SessionListView } from "@/components/coach/shared/SessionListView";
import { SwimSessionBuilder } from "@/components/coach/swim/SwimSessionBuilder";
import { AlertCircle, Layers, Plus, Route, Search, Timer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useBeforeUnload } from "@/hooks/use-before-unload";
import { useAuth } from "@/lib/auth";
import { formatSwimSessionDefaultTitle } from "@/lib/date";
import { calculateSwimTotalDistance } from "@/lib/swimSessionUtils";

interface SwimExercise {
  repetitions: number | null;
  distance: number | null;
  rest: number | null;
  restType: "departure" | "rest";
  stroke: string;
  strokeType: string;
  intensity: string;
  modalities: string;
  equipment: string[];
}

interface SwimBlock {
  title: string;
  repetitions: number | null;
  description: string;
  modalities: string;
  equipment: string[];
  exercises: SwimExercise[];
}

interface SwimSessionDraft {
  id: number | null;
  name: string;
  description: string;
  estimatedDuration: number;
  blocks: SwimBlock[];
}

const normalizeEquipmentValue = (value: string) => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("plaquette")) return "plaquettes";
  if (trimmed.startsWith("palm")) return "palmes";
  if (trimmed.startsWith("tuba")) return "tuba";
  if (trimmed.startsWith("pull")) return "pull";
  if (trimmed.startsWith("elas")) return "elastique";
  return trimmed;
};

const legacyIntensityMap: Record<string, string> = {
  souple: "V0",
  facile: "V0",
  relache: "V0",
  "relâché": "V0",
};

const intensityScale = ["V0", "V1", "V2", "V3", "Max", "Prog"] as const;

const normalizeIntensityValue = (value?: string | null) => {
  if (!value) return "V0";
  const trimmed = value.trim();
  if (!trimmed) return "V0";
  const lower = trimmed.toLowerCase();
  if (lower === "prog" || lower === "progressif") return "Prog";
  if (legacyIntensityMap[lower]) {
    return legacyIntensityMap[lower];
  }
  const upper = trimmed.toUpperCase();
  if (upper === "MAX") return "Max";
  if (upper.startsWith("V")) {
    const levelValue = Number.parseInt(upper.slice(1), 10);
    if (Number.isFinite(levelValue) && levelValue >= 4) {
      return "Max";
    }
    if (intensityScale.includes(upper as (typeof intensityScale)[number])) {
      return upper;
    }
  }
  return trimmed;
};

const buildItemsFromBlocks = (blocks: SwimBlock[]): SwimSessionItem[] => {
  let orderIndex = 0;
  return blocks.flatMap((block, blockIndex) =>
    block.exercises.map((exercise, exerciseIndex) => {
      const rawPayload = {
        block_title: block.title,
        block_description: block.description || null,
        block_order: blockIndex,
        block_repetitions: block.repetitions ?? null,
        block_modalities: block.modalities || null,
        block_equipment: block.equipment ?? [],
        exercise_repetitions: exercise.repetitions ?? null,
        exercise_rest: exercise.rest ?? null,
        exercise_rest_type: exercise.restType ?? "rest",
        exercise_stroke: exercise.stroke || null,
        exercise_stroke_type: exercise.strokeType || null,
        exercise_intensity: exercise.intensity ? normalizeIntensityValue(exercise.intensity) : null,
        exercise_modalities: exercise.modalities || null,
        exercise_equipment: exercise.equipment ?? [],
        exercise_order: exerciseIndex,
      };
      const exerciseLabel =
        exercise.repetitions && exercise.distance
          ? `${exercise.repetitions}x${exercise.distance}m`
          : exercise.distance
            ? `${exercise.distance}m`
            : null;
      return {
        ordre: orderIndex++,
        label: exerciseLabel,
        distance: exercise.distance ?? null,
        duration: null,
        intensity: exercise.intensity ? normalizeIntensityValue(exercise.intensity) : null,
        notes: exercise.modalities || null,
        raw_payload: rawPayload,
      } as SwimSessionItem;
    }),
  );
};

const buildBlocksFromItems = (items: SwimSessionItem[] = []): SwimBlock[] => {
  const blocksMap = new Map<string, SwimBlock & { order: number; exerciseOrder: Map<number, SwimExercise> }>();
  items.forEach((item) => {
    const payload = (item.raw_payload as SwimPayloadFields) ?? {};
    const blockTitle = payload.block_title || payload.section || "Bloc";
    const blockOrder = Number(payload.block_order ?? 0);
    const blockKey = `${blockOrder}-${blockTitle}`;
    const blockEquipmentRaw = payload.block_equipment ?? payload.equipment ?? [];
    const blockEquipment = (Array.isArray(blockEquipmentRaw) ? blockEquipmentRaw : String(blockEquipmentRaw).split(","))
      .map((entry) => String(entry))
      .map((entry) => normalizeEquipmentValue(entry))
      .filter(Boolean);
    if (!blocksMap.has(blockKey)) {
      blocksMap.set(blockKey, {
        title: blockTitle,
        repetitions: payload.block_repetitions ?? null,
        description: payload.block_description ?? "",
        modalities: payload.block_modalities ?? payload.modalities ?? "",
        equipment: blockEquipment,
        exercises: [],
        order: Number.isFinite(blockOrder) ? blockOrder : 0,
        exerciseOrder: new Map<number, SwimExercise>(),
      });
    }
    const block = blocksMap.get(blockKey)!;
    const exerciseOrder = Number(payload.exercise_order ?? item.ordre ?? block.exercises.length);
    const normalizedIntensity = normalizeIntensityValue(payload.exercise_intensity ?? item.intensity ?? "V1");
    block.exerciseOrder.set(exerciseOrder, {
      repetitions: payload.exercise_repetitions ?? null,
      distance: item.distance ?? null,
      rest: payload.exercise_rest ?? null,
      restType: (payload.exercise_rest_type as "departure" | "rest") ?? "rest",
      stroke: payload.exercise_stroke ?? payload.stroke ?? "crawl",
      strokeType: payload.exercise_stroke_type ?? (payload.stroke_type as string) ?? "nc",
      intensity: normalizedIntensity,
      modalities: payload.exercise_modalities ?? item.notes ?? "",
      equipment: Array.isArray(payload.exercise_equipment)
        ? payload.exercise_equipment.map((entry: string) => normalizeEquipmentValue(entry))
        : [],
    });
  });

  return Array.from(blocksMap.values())
    .sort((a, b) => a.order - b.order)
    .map((block) => ({
      title: block.title,
      repetitions: block.repetitions,
      description: block.description,
      modalities: block.modalities,
      equipment: block.equipment,
      exercises: Array.from(block.exerciseOrder.entries())
        .sort(([a], [b]) => a - b)
        .map(([, exercise]) => exercise),
    }));
};

const countBlocks = (items: SwimSessionItem[] = []) => {
  const keys = new Set(
    items.map((item) => {
      const raw = item.raw_payload as Record<string, unknown> | null;
      return raw?.block_title || raw?.section || "Bloc";
    }),
  );
  return keys.size;
};

const ARCHIVED_SWIM_SESSIONS_KEY = "swim_catalog_archived_ids";

export const canDeleteSwimCatalog = (sessionId: number, assignments: Assignment[] | null) => {
  if (assignments === null) return false;
  return !assignments.some(
    (assignment) => assignment.session_type === "swim" && assignment.session_id === sessionId,
  );
};

export default function SwimCatalog() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userId, role } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  useBeforeUnload(isCreating);
  const [selectedSession, setSelectedSession] = useState<SwimSessionTemplate | null>(null);
  const [pendingDeleteSession, setPendingDeleteSession] = useState<SwimSessionTemplate | null>(null);
  const [pendingArchiveSession, setPendingArchiveSession] = useState<SwimSessionTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [archivedSessionIds, setArchivedSessionIds] = useState<Set<number>>(new Set());

  const createEmptySession = (): SwimSessionDraft => ({
    id: null,
    name: formatSwimSessionDefaultTitle(new Date()),
    description: "",
    estimatedDuration: 0,
    blocks: [],
  });

  const [newSession, setNewSession] = useState<SwimSessionDraft>(createEmptySession);

  const { data: sessions, isLoading: sessionsLoading, error: sessionsError, refetch: refetchSessions } = useQuery({
    queryKey: ["swim_catalog"],
    queryFn: () => api.getSwimCatalog()
  });

  const { data: assignments, isLoading: assignmentsLoading, isError: assignmentsError, error: assignmentsErrorObj, refetch: refetchAssignments } = useQuery({
    queryKey: ["coach-assignments"],
    queryFn: () => api.getAssignmentsForCoach(),
    enabled: role === "coach" || role === "admin",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(ARCHIVED_SWIM_SESSIONS_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setArchivedSessionIds(
          new Set(parsed.map((value) => Number(value)).filter((value) => Number.isFinite(value))),
        );
      }
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      ARCHIVED_SWIM_SESSIONS_KEY,
      JSON.stringify(Array.from(archivedSessionIds.values())),
    );
  }, [archivedSessionIds]);

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sessions ?? [];
    return (sessions ?? []).filter((session) => session.name.toLowerCase().includes(q));
  }, [sessions, searchQuery]);

  const visibleSessions = filteredSessions.filter((session) => !archivedSessionIds.has(session.id));

  const createSession = useMutation({
    mutationFn: (data: SwimSessionInput) => api.createSwimSession(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["swim_catalog"] });
      setIsCreating(false);
      setNewSession(createEmptySession());
      toast({
        title: variables?.id ? "Séance natation mise à jour" : "Séance natation créée",
      });
    },
  });

  const deleteSession = useMutation({
    mutationFn: (sessionId: number) => api.deleteSwimSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["swim_catalog"] });
      setPendingDeleteSession(null);
      toast({ title: "Séance supprimée" });
    },
    onError: () => {
      toast({
        title: "Suppression impossible",
        description: "Cette séance est utilisée dans une assignation.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!newSession.name.trim()) {
      toast({
        title: "Titre requis",
        description: "Ajoutez un nom de séance avant d'enregistrer.",
        variant: "destructive",
      });
      return;
    }
    createSession.mutate({
      id: newSession.id ?? undefined,
      name: newSession.name,
      description: newSession.description,
      estimated_duration: newSession.estimatedDuration || null,
      items: buildItemsFromBlocks(newSession.blocks),
      created_by: userId ?? null,
    });
  };

  const handleCancel = () => {
    setIsCreating(false);
    setNewSession(createEmptySession());
  };

  const handleEdit = (session: SwimSessionTemplate) => {
    setNewSession({
      id: session.id ?? null,
      name: session.name ?? formatSwimSessionDefaultTitle(new Date()),
      description: session.description ?? "",
      estimatedDuration: Number((session as { estimated_duration?: number }).estimated_duration ?? 0),
      blocks: buildBlocksFromItems(session.items ?? []),
    });
    setIsCreating(true);
  };

  const handleArchive = (session: SwimSessionTemplate) => {
    setPendingArchiveSession(session);
  };

  const handleArchiveConfirm = () => {
    if (!pendingArchiveSession) return;
    setArchivedSessionIds((prev) => new Set([...Array.from(prev), pendingArchiveSession.id]));
    setPendingArchiveSession(null);
    toast({ title: "Séance archivée" });
  };

  const handleDelete = (session: SwimSessionTemplate) => {
    setPendingDeleteSession(session);
  };

  const handleDeleteConfirm = () => {
    if (!pendingDeleteSession) return;
    deleteSession.mutate(pendingDeleteSession.id);
  };

  if (isCreating) {
    return (
      <SwimSessionBuilder
        session={newSession}
        onSessionChange={setNewSession}
        onSave={handleSave}
        onCancel={handleCancel}
        userId={userId}
        isSaving={createSession.isPending}
      />
    );
  }

  if (sessionsLoading || assignmentsLoading) {
    return (
      <div>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <Skeleton className="h-5 w-16 mb-1" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>

        <div className="p-4">
          <Skeleton className="h-10 w-full rounded-2xl mb-4" />
          <SessionListView
            sessions={[]}
            isLoading={true}
            renderTitle={() => ""}
            renderMetrics={() => null}
            onPreview={() => {}}
            onEdit={() => {}}
            onArchive={() => {}}
            onDelete={() => {}}
            canDelete={() => false}
          />
        </div>
      </div>
    );
  }

  if (sessionsError) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="font-semibold">Impossible de charger les données</h3>
        <p className="text-sm text-muted-foreground mt-2">
          {sessionsError instanceof Error ? sessionsError.message : "Une erreur s'est produite"}
        </p>
        <Button variant="default" onClick={() => refetchSessions()} className="mt-4 h-12 md:h-10">
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <div className="text-base font-semibold">Coach</div>
          <div className="text-xs text-muted-foreground">Création</div>
        </div>
        <button
          type="button"
          onClick={() => {
            setNewSession(createEmptySession());
            setIsCreating(true);
          }}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Nouvelle
        </button>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Rechercher une séance"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {assignmentsError && (
          <div className="mt-4 flex flex-col items-center rounded-lg border border-destructive/20 bg-destructive/10 p-4">
            <AlertCircle className="h-8 w-8 text-destructive mb-2" />
            <p className="text-sm text-destructive font-semibold">Impossible de charger les assignations</p>
            <p className="text-xs text-destructive/80 mt-1">
              {assignmentsErrorObj instanceof Error ? assignmentsErrorObj.message : "Une erreur s'est produite"}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetchAssignments()} className="mt-2 h-10">
              Réessayer
            </Button>
          </div>
        )}

        <div className="mt-4">
          <SessionListView
            sessions={visibleSessions}
            isLoading={sessionsLoading}
            error={sessionsError}
            renderTitle={(session) => session.name}
            renderMetrics={(session) => {
              const totalDistance = calculateSwimTotalDistance(session.items ?? []);
              const hasDuration = session.items?.some((item) => item.duration != null) ?? false;
              const totalDuration = hasDuration
                ? session.items?.reduce((sum, item) => sum + (item.duration ?? 0), 0) ?? 0
                : null;
              const blockCount = countBlocks(session.items ?? []);
              return (
                <>
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
                </>
              );
            }}
            onPreview={setSelectedSession}
            onEdit={handleEdit}
            onArchive={handleArchive}
            onDelete={handleDelete}
            canDelete={(sessionId) => canDeleteSwimCatalog(sessionId, assignments ?? null)}
            isDeleting={deleteSession.isPending}
          />
        </div>

        <div className="h-8" />
      </div>

      <Dialog
        open={Boolean(selectedSession)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSession(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl">
          <SwimSessionConsultation
            title={selectedSession?.name ?? ""}
            description={selectedSession?.description ?? undefined}
            items={selectedSession?.items}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(pendingArchiveSession)}
        onOpenChange={(open) => {
          if (!open) setPendingArchiveSession(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archiver la séance ?</AlertDialogTitle>
            <AlertDialogDescription>
              La séance sera masquée du catalogue (sans suppression).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchiveConfirm}>
              Archiver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingDeleteSession)}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteSession(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la séance ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive. La séance sera supprimée du catalogue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
