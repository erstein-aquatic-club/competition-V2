import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, Layers, Route } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SwimExerciseDetail, SwimSessionConsultation } from "@/components/swim/SwimSessionConsultation";
import { api, Assignment, SwimSessionItem } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { calculateSwimTotalDistance } from "@/lib/swimSessionUtils";
import { useToast } from "@/hooks/use-toast";

const statusLabels: Record<string, string> = {
  assigned: "Assignée",
  pending: "Assignée",
  in_progress: "En cours",
  completed: "Terminée",
  cancelled: "Annulée",
};

const formatAssignedDate = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : format(parsed, "dd MMM", { locale: fr });
};

export default function SwimSessionView() {
  const { user, userId } = useAuth();
  const [location, setLocation] = useLocation();
  const [compactMode, setCompactMode] = useState(true);
  const [selectedExercise, setSelectedExercise] = useState<SwimExerciseDetail | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const assignmentId = useMemo(() => {
    const [, queryString] = location.split("?");
    if (!queryString) return null;
    const params = new URLSearchParams(queryString);
    const id = params.get("assignmentId");
    const parsed = id ? Number(id) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  }, [location]);

  const { data: assignments, isLoading } = useQuery({
    queryKey: ["assignments", user],
    queryFn: () => api.getAssignments(user!, userId),
    enabled: !!user,
  });

  type SwimAssignment = Assignment & { session_type: "swim"; items?: SwimSessionItem[] };
  const swimAssignments = assignments?.filter(
    (assignment): assignment is SwimAssignment => assignment.session_type === "swim",
  ) || [];
  const assignment = assignmentId
    ? swimAssignments.find((item) => item.id === assignmentId)
    : swimAssignments[0];

  const totalDistance = calculateSwimTotalDistance(assignment?.items ?? []);
  const blockCount = useMemo(() => {
    if (!assignment?.items) return 0;
    const blocks = new Set<string>();
    assignment.items.forEach((item) => {
      const payload = (item.raw_payload as Record<string, any>) ?? {};
      const title = payload.block_title || payload.section || "Bloc";
      const order = payload.block_order ?? 0;
      blocks.add(`${order}-${title}`);
    });
    return blocks.size;
  }, [assignment?.items]);

  const deleteAssignmentMutation = useMutation({
    mutationFn: (assignmentId: number) => api.assignments_delete(assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      toast({ title: "Séance retirée", description: "La séance a été retirée de votre feed." });
      setLocation("/");
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de retirer la séance.", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/")}
            aria-label="Retour à l'accueil"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Séance natation</div>
            <h1 className="text-2xl font-display font-bold uppercase">Lecture</h1>
          </div>
        </div>
        {assignment ? (
          <Badge variant="secondary" className="text-xs">
            {statusLabels[assignment.status] ?? "Assignée"}
          </Badge>
        ) : null}
      </div>

      <Card className="border border-slate-200 shadow-sm">
        <CardContent className="space-y-4 p-5">
          <div className="space-y-1">
            <div className="text-lg font-semibold tracking-tight">
              {assignment?.title ?? "Séance natation"}
            </div>
            {assignment?.description ? (
              <p className="text-sm text-muted-foreground">{assignment.description}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">
                {formatAssignedDate(assignment?.assigned_date)}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                <Route className="mr-1 h-3.5 w-3.5" /> {totalDistance}m
              </Badge>
              <Badge variant="secondary" className="text-xs">
                <Layers className="mr-1 h-3.5 w-3.5" /> {blockCount} blocs
              </Badge>
            </div>
            {assignment ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const confirmed = window.confirm("Retirer cette séance de votre feed ?");
                  if (!confirmed) return;
                  deleteAssignmentMutation.mutate(assignment.id);
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Retirer de mon feed
              </Button>
            ) : null}
            <div className="flex items-center rounded-full border border-slate-200 bg-slate-50 p-1 text-xs font-semibold">
              <button
                type="button"
                aria-pressed={compactMode}
                onClick={() => setCompactMode(true)}
                className={`rounded-full px-3 py-1 transition ${
                  compactMode ? "bg-slate-900 text-white shadow-sm" : "text-muted-foreground"
                }`}
              >
                Condensé
              </button>
              <button
                type="button"
                aria-pressed={!compactMode}
                onClick={() => setCompactMode(false)}
                className={`rounded-full px-3 py-1 transition ${
                  !compactMode ? "bg-slate-900 text-white shadow-sm" : "text-muted-foreground"
                }`}
              >
                Détail
              </button>
            </div>
          </div>
          <Separator />
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Chargement de la séance...</div>
          ) : assignment ? (
            <SwimSessionConsultation
              title={assignment.title}
              description={assignment.description}
              items={assignment.items}
              showHeader={false}
              compactMode={compactMode}
              onExerciseSelect={(detail) => {
                setSelectedExercise(detail);
              }}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-muted/70 bg-muted/30 p-6 text-sm text-muted-foreground">
              Aucune séance de natation assignée pour le moment.
            </div>
          )}
        </CardContent>
      </Card>
      <Sheet
        open={Boolean(selectedExercise)}
        onOpenChange={(open) => {
          if (!open) setSelectedExercise(null);
        }}
      >
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Détails de l'exercice</SheetTitle>
          </SheetHeader>
          {selectedExercise ? (
            <div className="mt-4 space-y-3">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {selectedExercise.blockTitle && selectedExercise.blockIndex !== undefined
                    ? `Bloc ${selectedExercise.blockIndex + 1}`
                    : "Bloc"}
                </p>
                <p className="text-lg font-semibold">{selectedExercise.label}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {selectedExercise.repetitions ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-2 py-1">
                    {selectedExercise.repetitions}x
                  </span>
                ) : null}
                {selectedExercise.distance ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-2 py-1">
                    {selectedExercise.distance}m
                  </span>
                ) : null}
                {selectedExercise.rest ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-2 py-1">
                    Récup {selectedExercise.rest}s
                  </span>
                ) : null}
                {selectedExercise.stroke ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-2 py-1">
                    Nage : {selectedExercise.stroke}
                  </span>
                ) : null}
                {selectedExercise.strokeType ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-2 py-1">
                    Type : {selectedExercise.strokeType}
                  </span>
                ) : null}
                {selectedExercise.intensity ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-2 py-1">
                    Intensité : {selectedExercise.intensity}
                  </span>
                ) : null}
              </div>
              {selectedExercise.modalities ? (
                <div className="rounded-2xl border bg-muted/10 p-3 text-sm text-muted-foreground">
                  {selectedExercise.modalities}
                </div>
              ) : null}
              {selectedExercise.equipment?.length ? (
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {selectedExercise.equipment.map((equipment) => (
                    <span key={equipment} className="rounded-full border px-2 py-1">
                      {equipment}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
