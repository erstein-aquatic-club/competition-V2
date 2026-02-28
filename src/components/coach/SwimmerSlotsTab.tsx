import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { SwimmerTrainingSlot, SwimmerTrainingSlotInput } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Link2, Plus, RotateCcw, Trash2, Clock, MapPin } from "lucide-react";

const DAYS_FR = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

type Props = {
  athleteId: number;
  athleteName: string;
  groupId: number;
};

export default function SwimmerSlotsTab({ athleteId, athleteName, groupId }: Props) {
  const { userId } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── Queries ─────────────────────────────────────
  const { data: customSlots, isLoading } = useQuery({
    queryKey: ["swimmer-slots", athleteId],
    queryFn: () => api.getSwimmerSlots(athleteId),
  });

  const { data: hasCustom } = useQuery({
    queryKey: ["swimmer-slots-exists", athleteId],
    queryFn: () => api.hasCustomSlots(athleteId),
  });

  const { data: groupSlots = [] } = useQuery({
    queryKey: ["training-slots", "group", groupId],
    queryFn: () => api.getTrainingSlotsForGroup(groupId),
  });

  const hasPersonalSlots = hasCustom === true;
  const displaySlots = hasPersonalSlots ? (customSlots ?? []) : [];

  // ── Mutations ───────────────────────────────────
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["swimmer-slots", athleteId] });
    qc.invalidateQueries({ queryKey: ["swimmer-slots-exists", athleteId] });
  };

  const initMut = useMutation({
    mutationFn: () => api.initSwimmerSlots(athleteId, groupId, userId!),
    onSuccess: () => { invalidate(); toast({ title: "Planning personnalisé créé" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const resetMut = useMutation({
    mutationFn: () => api.resetSwimmerSlots(athleteId, groupId, userId!),
    onSuccess: () => { invalidate(); toast({ title: "Planning réinitialisé" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (slotId: string) => api.deleteSwimmerSlot(slotId),
    onSuccess: () => { invalidate(); toast({ title: "Créneau supprimé" }); },
  });

  const createMut = useMutation({
    mutationFn: (input: SwimmerTrainingSlotInput) => api.createSwimmerSlot(input, userId!),
    onSuccess: () => { invalidate(); toast({ title: "Créneau ajouté" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ slotId, input }: { slotId: string; input: Partial<SwimmerTrainingSlotInput> }) =>
      api.updateSwimmerSlot(slotId, input),
    onSuccess: () => { invalidate(); toast({ title: "Créneau modifié" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  // ── Sheet state for add/edit ────────────────────
  const [editSlot, setEditSlot] = useState<SwimmerTrainingSlot | null>(null);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // ── Group slots by day ──────────────────────────
  const slotsByDay = useMemo(() => {
    const source = hasPersonalSlots ? displaySlots : groupSlots;
    const map = new Map<number, typeof source>();
    for (const s of source) {
      const list = map.get(s.day_of_week) ?? [];
      list.push(s as any);
      map.set(s.day_of_week, list);
    }
    return map;
  }, [hasPersonalSlots, displaySlots, groupSlots]);

  // ── Loading ─────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    );
  }

  // ── Render ──────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex items-center justify-between gap-2">
        {!hasPersonalSlots ? (
          <Button size="sm" onClick={() => initMut.mutate()} disabled={initMut.isPending}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Personnaliser le planning
          </Button>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={() => setShowAddSheet(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Ajouter
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmReset(true)}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Réinitialiser
            </Button>
          </>
        )}
      </div>

      {/* Banner when inheriting */}
      {!hasPersonalSlots && groupSlots.length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-3 py-2 text-sm text-blue-700 dark:text-blue-300">
          Hérite du planning du groupe. Cliquez sur &laquo; Personnaliser &raquo; pour ajuster.
        </div>
      )}

      {/* Day-by-day list */}
      {[1, 2, 3, 4, 5, 6, 7].map((dow) => {
        const daySlots = slotsByDay.get(dow);
        if (!daySlots || daySlots.length === 0) return null;
        return (
          <div key={dow} className="space-y-1.5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {DAYS_FR[dow - 1]}
            </h3>
            {daySlots.map((s: any) => (
              <button
                key={s.id}
                type="button"
                className="w-full flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left hover:bg-muted/50 transition"
                onClick={() => hasPersonalSlots ? setEditSlot(s) : undefined}
              >
                <div className="flex items-center gap-1.5 text-sm font-mono tabular-nums">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  {(s.start_time as string).slice(0, 5)} – {(s.end_time as string).slice(0, 5)}
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground truncate">
                  <MapPin className="h-3.5 w-3.5" />
                  {s.location}
                </div>
                {hasPersonalSlots && (s as SwimmerTrainingSlot).source_assignment_id && (
                  <Link2 className="h-3.5 w-3.5 text-blue-500 ml-auto flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        );
      })}

      {slotsByDay.size === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">
          Aucun créneau configuré.
        </p>
      )}

      {/* Confirm reset dialog */}
      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Réinitialiser le planning ?</AlertDialogTitle>
            <AlertDialogDescription>
              Tous les créneaux personnalisés seront supprimés et remplacés par ceux du groupe.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { resetMut.mutate(); setConfirmReset(false); }}
            >
              Réinitialiser
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce créneau ?</AlertDialogTitle>
            <AlertDialogDescription>Le créneau sera retiré du planning personnel.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteTarget) deleteMut.mutate(deleteTarget); setDeleteTarget(null); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit sheet */}
      <Sheet open={!!editSlot} onOpenChange={(open) => !open && setEditSlot(null)}>
        <SheetContent side="bottom" className="max-h-[80vh]">
          <SheetHeader>
            <SheetTitle>Modifier le créneau</SheetTitle>
            <SheetDescription>Ajustez les horaires ou le lieu</SheetDescription>
          </SheetHeader>
          {editSlot && (
            <SlotEditForm
              slot={editSlot}
              onSave={(input) => {
                updateMut.mutate({ slotId: editSlot.id, input });
                setEditSlot(null);
              }}
              onDelete={() => { setDeleteTarget(editSlot.id); setEditSlot(null); }}
              isPending={updateMut.isPending}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Add sheet */}
      <Sheet open={showAddSheet} onOpenChange={setShowAddSheet}>
        <SheetContent side="bottom" className="max-h-[80vh]">
          <SheetHeader>
            <SheetTitle>Ajouter un créneau</SheetTitle>
            <SheetDescription>Nouveau créneau personnalisé</SheetDescription>
          </SheetHeader>
          <SlotAddForm
            onSave={(input) => {
              createMut.mutate({ ...input, user_id: athleteId });
              setShowAddSheet(false);
            }}
            isPending={createMut.isPending}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Slot Edit Form (inline) ─────────────────────

function SlotEditForm({
  slot,
  onSave,
  onDelete,
  isPending,
}: {
  slot: SwimmerTrainingSlot;
  onSave: (input: Partial<SwimmerTrainingSlotInput>) => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  const [startTime, setStartTime] = useState(slot.start_time.slice(0, 5));
  const [endTime, setEndTime] = useState(slot.end_time.slice(0, 5));
  const [location, setLocation] = useState(slot.location);

  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Début</Label>
          <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        <div>
          <Label>Fin</Label>
          <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Lieu</Label>
        <Input value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button
          className="flex-1"
          onClick={() => onSave({ start_time: startTime, end_time: endTime, location })}
          disabled={isPending}
        >
          Enregistrer
        </Button>
        <Button variant="destructive" size="icon" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Slot Add Form (inline) ──────────────────────

function SlotAddForm({
  onSave,
  isPending,
}: {
  onSave: (input: Omit<SwimmerTrainingSlotInput, "user_id">) => void;
  isPending: boolean;
}) {
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("10:00");
  const [location, setLocation] = useState("");

  return (
    <div className="space-y-4 pt-4">
      <div>
        <Label>Jour</Label>
        <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {DAYS_FR.map((d, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Début</Label>
          <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        <div>
          <Label>Fin</Label>
          <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Lieu</Label>
        <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Piscine, Salle..." />
      </div>
      <Button
        className="w-full"
        onClick={() => onSave({
          day_of_week: Number(dayOfWeek),
          start_time: startTime,
          end_time: endTime,
          location,
        })}
        disabled={isPending || !location}
      >
        Ajouter
      </Button>
    </div>
  );
}
