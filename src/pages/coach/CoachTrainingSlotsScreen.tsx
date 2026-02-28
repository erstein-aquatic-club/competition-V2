import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  TrainingSlot,
  TrainingSlotOverride,
  TrainingSlotInput,
  TrainingSlotOverrideInput,
} from "@/lib/api/types";
import { useToast } from "@/hooks/use-toast";
import CoachSectionHeader from "./CoachSectionHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Clock,
  MapPin,
  Users,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
} from "lucide-react";

// ── Constants ────────────────────────────────────────────────────

const DAYS_FR = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
];

// ── Helpers ──────────────────────────────────────────────────────

function formatTime(t: string): string {
  // "08:00:00" → "08:00"
  return t.slice(0, 5);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Types ────────────────────────────────────────────────────────

type CoachTrainingSlotsScreenProps = {
  onBack: () => void;
  groups: Array<{ id: number | string; name: string }>;
};

type AssignmentRow = {
  key: number;
  group_id: string;
  coach_id: string;
  lane_count: string;
};

// ── Slot Form Sheet ─────────────────────────────────────────────

type SlotFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot?: TrainingSlot | null;
  groups: Array<{ id: number | string; name: string }>;
  coaches: Array<{ id: number; display_name: string }>;
};

const SlotFormSheet = ({
  open,
  onOpenChange,
  slot,
  groups,
  coaches,
}: SlotFormSheetProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!slot;

  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (slot) {
      setDayOfWeek(String(slot.day_of_week));
      setStartTime(formatTime(slot.start_time));
      setEndTime(formatTime(slot.end_time));
      setLocation(slot.location);
      const rows = slot.assignments.map((a, i) => ({
        key: i,
        group_id: String(a.group_id),
        coach_id: String(a.coach_id),
        lane_count: a.lane_count != null ? String(a.lane_count) : "",
      }));
      setAssignments(rows);
      setNextKey(rows.length);
    } else {
      setDayOfWeek("1");
      setStartTime("");
      setEndTime("");
      setLocation("");
      setAssignments([]);
      setNextKey(1);
    }
  }, [open, slot]);

  const addAssignment = () => {
    setAssignments((prev) => [
      ...prev,
      { key: nextKey, group_id: "", coach_id: "", lane_count: "" },
    ]);
    setNextKey((k) => k + 1);
  };

  const removeAssignment = (key: number) => {
    setAssignments((prev) => prev.filter((a) => a.key !== key));
  };

  const updateAssignment = (
    key: number,
    field: keyof Omit<AssignmentRow, "key">,
    value: string,
  ) => {
    setAssignments((prev) =>
      prev.map((a) => (a.key === key ? { ...a, [field]: value } : a)),
    );
  };

  const buildInput = (): TrainingSlotInput | null => {
    if (!startTime || !endTime) {
      toast({
        title: "Horaires requis",
        description: "Veuillez saisir les heures de debut et fin.",
        variant: "destructive",
      });
      return null;
    }
    if (!location.trim()) {
      toast({
        title: "Lieu requis",
        description: "Veuillez saisir un lieu.",
        variant: "destructive",
      });
      return null;
    }
    return {
      day_of_week: Number(dayOfWeek),
      start_time: startTime,
      end_time: endTime,
      location: location.trim(),
      assignments: assignments
        .filter((a) => a.group_id && a.coach_id)
        .map((a) => ({
          group_id: Number(a.group_id),
          coach_id: Number(a.coach_id),
          lane_count: a.lane_count ? Number(a.lane_count) : null,
        })),
    };
  };

  const createMutation = useMutation({
    mutationFn: (input: TrainingSlotInput) => api.createTrainingSlot(input),
    onSuccess: () => {
      toast({ title: "Creneau cree" });
      void queryClient.invalidateQueries({ queryKey: ["training-slots"] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: TrainingSlotInput) =>
      api.updateTrainingSlot(slot!.id, input),
    onSuccess: () => {
      toast({ title: "Creneau mis a jour" });
      void queryClient.invalidateQueries({ queryKey: ["training-slots"] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteTrainingSlot(slot!.id),
    onSuccess: () => {
      toast({ title: "Creneau supprime" });
      void queryClient.invalidateQueries({ queryKey: ["training-slots"] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    const input = buildInput();
    if (!input) return;
    if (isEdit) {
      updateMutation.mutate(input);
    } else {
      createMutation.mutate(input);
    }
  };

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>
              {isEdit ? "Modifier le creneau" : "Nouveau creneau"}
            </SheetTitle>
            <SheetDescription>
              {isEdit
                ? "Modifiez les details de ce creneau."
                : "Definissez un nouveau creneau hebdomadaire."}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {/* Day of week */}
            <div className="space-y-2">
              <Label>Jour de la semaine *</Label>
              <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_FR.map((d, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Time range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="slot-start">Debut *</Label>
                <input
                  id="slot-start"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slot-end">Fin *</Label>
                <input
                  id="slot-end"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="slot-location">Lieu *</Label>
              <Input
                id="slot-location"
                placeholder="Ex : Piscine Erstein"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            <Separator />

            {/* Assignments */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Groupes & Coachs</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addAssignment}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Ajouter
                </Button>
              </div>

              {assignments.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Aucun groupe assigne.
                </p>
              )}

              {assignments.map((row) => (
                <div
                  key={row.key}
                  className="rounded-lg border p-3 space-y-2"
                >
                  <div className="space-y-1.5">
                    <Select
                      value={row.group_id}
                      onValueChange={(v) =>
                        updateAssignment(row.key, "group_id", v)
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Groupe..." />
                      </SelectTrigger>
                      <SelectContent>
                        {groups.map((g) => (
                          <SelectItem key={g.id} value={String(g.id)}>
                            {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={row.coach_id}
                      onValueChange={(v) =>
                        updateAssignment(row.key, "coach_id", v)
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Coach..." />
                      </SelectTrigger>
                      <SelectContent>
                        {coaches.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.display_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        placeholder="Lignes d'eau"
                        value={row.lane_count}
                        onChange={(e) =>
                          updateAssignment(row.key, "lane_count", e.target.value)
                        }
                        className="h-8 text-xs flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => removeAssignment(row.key)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={isPending || !startTime || !endTime || !location.trim()}
              >
                {isPending
                  ? "Enregistrement..."
                  : isEdit
                    ? "Enregistrer"
                    : "Creer"}
              </Button>

              {isEdit && (
                <Button
                  variant="outline"
                  className="w-full text-destructive hover:text-destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isPending}
                >
                  Supprimer ce creneau
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le creneau</AlertDialogTitle>
            <AlertDialogDescription>
              Ce creneau sera desactive. Les exceptions associees resteront en
              base mais ne seront plus visibles.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteMutation.mutate();
                setShowDeleteConfirm(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

// ── Override Form Sheet ──────────────────────────────────────────

type OverrideFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: TrainingSlot | null;
};

const OverrideFormSheet = ({
  open,
  onOpenChange,
  slot,
}: OverrideFormSheetProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [overrideDate, setOverrideDate] = useState("");
  const [status, setStatus] = useState<"cancelled" | "modified">("cancelled");
  const [newStartTime, setNewStartTime] = useState("");
  const [newEndTime, setNewEndTime] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) return;
    setOverrideDate("");
    setStatus("cancelled");
    setNewStartTime(slot ? formatTime(slot.start_time) : "");
    setNewEndTime(slot ? formatTime(slot.end_time) : "");
    setNewLocation(slot?.location ?? "");
    setReason("");
  }, [open, slot]);

  const createMutation = useMutation({
    mutationFn: (input: TrainingSlotOverrideInput) =>
      api.createSlotOverride(input),
    onSuccess: () => {
      toast({ title: "Exception enregistree" });
      void queryClient.invalidateQueries({
        queryKey: ["training-slot-overrides"],
      });
      void queryClient.invalidateQueries({ queryKey: ["training-slots"] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!slot) return;
    if (!overrideDate) {
      toast({
        title: "Date requise",
        description: "Veuillez saisir la date de l'exception.",
        variant: "destructive",
      });
      return;
    }

    const input: TrainingSlotOverrideInput = {
      slot_id: slot.id,
      override_date: overrideDate,
      status,
      new_start_time: status === "modified" ? newStartTime || null : null,
      new_end_time: status === "modified" ? newEndTime || null : null,
      new_location:
        status === "modified" && newLocation.trim()
          ? newLocation.trim()
          : null,
      reason: reason.trim() || null,
    };

    createMutation.mutate(input);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>Exception</SheetTitle>
          <SheetDescription>
            Annulez ou modifiez ce creneau pour une date precise.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="override-date">Date *</Label>
            <input
              id="override-date"
              type="date"
              value={overrideDate}
              onChange={(e) => setOverrideDate(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>Type</Label>
            <RadioGroup
              value={status}
              onValueChange={(v) =>
                setStatus(v as "cancelled" | "modified")
              }
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="cancelled" id="ovr-cancelled" />
                <Label htmlFor="ovr-cancelled" className="font-normal">
                  Annule
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="modified" id="ovr-modified" />
                <Label htmlFor="ovr-modified" className="font-normal">
                  Modifie
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Modified fields */}
          {status === "modified" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="ovr-start">Nouvel horaire debut</Label>
                  <input
                    id="ovr-start"
                    type="time"
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ovr-end">Nouvel horaire fin</Label>
                  <input
                    id="ovr-end"
                    type="time"
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ovr-location">Nouveau lieu</Label>
                <Input
                  id="ovr-location"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                />
              </div>
            </>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="ovr-reason">Motif</Label>
            <Input
              id="ovr-reason"
              placeholder="Ex : Vacances scolaires"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {/* Submit */}
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={createMutation.isPending || !overrideDate}
          >
            {createMutation.isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

// ── Main Component ──────────────────────────────────────────────

const CoachTrainingSlotsScreen = ({
  onBack,
  groups,
}: CoachTrainingSlotsScreenProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showSlotForm, setShowSlotForm] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TrainingSlot | null>(null);
  const [overrideSlot, setOverrideSlot] = useState<TrainingSlot | null>(null);
  const [showOverrideForm, setShowOverrideForm] = useState(false);

  // Fetch slots
  const { data: slots = [], isLoading: slotsLoading } = useQuery({
    queryKey: ["training-slots"],
    queryFn: () => api.getTrainingSlots(),
  });

  // Fetch upcoming overrides
  const { data: upcomingOverrides = [] } = useQuery({
    queryKey: ["training-slot-overrides", "upcoming"],
    queryFn: () => api.getSlotOverrides({ fromDate: todayIso() }),
  });

  // Fetch coaches
  const { data: coaches = [] } = useQuery({
    queryKey: ["users", "coaches"],
    queryFn: () => api.listUsers({ role: "coach" }),
  });

  // Group slots by day
  const slotsByDay = useMemo(() => {
    const map = new Map<number, TrainingSlot[]>();
    for (let d = 1; d <= 7; d++) {
      map.set(d, []);
    }
    for (const s of slots) {
      const list = map.get(s.day_of_week) ?? [];
      list.push(s);
      map.set(s.day_of_week, list);
    }
    return map;
  }, [slots]);

  // Overrides by slot_id
  const overridesBySlot = useMemo(() => {
    const map = new Map<string, TrainingSlotOverride[]>();
    for (const o of upcomingOverrides) {
      const list = map.get(o.slot_id) ?? [];
      list.push(o);
      map.set(o.slot_id, list);
    }
    return map;
  }, [upcomingOverrides]);

  const deleteOverrideMutation = useMutation({
    mutationFn: (overrideId: string) => api.deleteSlotOverride(overrideId),
    onSuccess: () => {
      toast({ title: "Exception supprimee" });
      void queryClient.invalidateQueries({
        queryKey: ["training-slot-overrides"],
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleCreate = () => {
    setEditingSlot(null);
    setShowSlotForm(true);
  };

  const handleEdit = (slot: TrainingSlot) => {
    setEditingSlot(slot);
    setShowSlotForm(true);
  };

  const handleOverride = (slot: TrainingSlot) => {
    setOverrideSlot(slot);
    setShowOverrideForm(true);
  };

  const coachesForForm = coaches.map((c) => ({
    id: c.id,
    display_name: c.display_name,
  }));

  const description =
    slots.length === 0
      ? "Planning hebdomadaire des entrainements."
      : `${slots.length} creneau${slots.length > 1 ? "x" : ""}`;

  return (
    <div className="space-y-6 pb-24">
      <CoachSectionHeader
        title="Creneaux"
        description={description}
        onBack={onBack}
        actions={
          <Button variant="outline" size="sm" onClick={handleCreate}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Nouveau creneau
          </Button>
        }
      />

      {slotsLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border p-3 animate-pulse motion-reduce:animate-none"
            >
              <div className="flex items-center gap-3">
                <div className="h-4 w-40 rounded bg-muted" />
                <div className="ml-auto h-5 w-12 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : slots.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <Clock className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            Aucun creneau defini.
          </p>
          <Button variant="outline" size="sm" onClick={handleCreate}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Creer le premier creneau
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from({ length: 7 }, (_, i) => i + 1).map((day) => {
            const daySlots = slotsByDay.get(day) ?? [];
            return (
              <div key={day}>
                {/* Day separator */}
                <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-2">
                  {DAYS_FR[day - 1]}
                </h3>

                {daySlots.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60 ml-1 mb-3">
                    Aucun entrainement
                  </p>
                ) : (
                  <div className="space-y-2 mb-3">
                    {daySlots.map((slot) => {
                      const slotOverrides = overridesBySlot.get(slot.id) ?? [];
                      return (
                        <div
                          key={slot.id}
                          className="rounded-xl border bg-card p-3 space-y-2"
                        >
                          {/* Header: time + location */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                                <span className="text-sm font-semibold">
                                  {formatTime(slot.start_time)} –{" "}
                                  {formatTime(slot.end_time)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 mt-0.5">
                                <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span className="text-xs text-muted-foreground truncate">
                                  {slot.location}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleEdit(slot)}
                                title="Modifier"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleOverride(slot)}
                                title="Exception"
                              >
                                <AlertTriangle className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Assignments */}
                          {slot.assignments.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {slot.assignments.map((a) => (
                                <div
                                  key={a.id}
                                  className="flex items-center gap-1"
                                >
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] px-1.5 py-0"
                                  >
                                    {a.group_name}
                                  </Badge>
                                  <span className="text-[10px] text-muted-foreground">
                                    {a.coach_name}
                                    {a.lane_count != null &&
                                      ` · ${a.lane_count} ligne${a.lane_count > 1 ? "s" : ""}`}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Upcoming overrides */}
                          {slotOverrides.length > 0 && (
                            <div className="space-y-1 pt-1 border-t border-dashed">
                              {slotOverrides.map((ovr) => (
                                <div
                                  key={ovr.id}
                                  className="flex items-center gap-1.5 text-[10px]"
                                >
                                  <AlertTriangle className="h-3 w-3 text-orange-500 shrink-0" />
                                  <span className="text-muted-foreground">
                                    {new Date(
                                      ovr.override_date + "T00:00:00",
                                    ).toLocaleDateString("fr-FR", {
                                      day: "2-digit",
                                      month: "2-digit",
                                    })}
                                  </span>
                                  <Badge
                                    variant={
                                      ovr.status === "cancelled"
                                        ? "destructive"
                                        : "outline"
                                    }
                                    className="text-[9px] px-1 py-0"
                                  >
                                    {ovr.status === "cancelled"
                                      ? "Annule"
                                      : "Modifie"}
                                  </Badge>
                                  {ovr.reason && (
                                    <span className="text-muted-foreground truncate">
                                      {ovr.reason}
                                    </span>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 ml-auto shrink-0 text-muted-foreground hover:text-destructive"
                                    onClick={() =>
                                      deleteOverrideMutation.mutate(ovr.id)
                                    }
                                    title="Supprimer l'exception"
                                  >
                                    <Trash2 className="h-2.5 w-2.5" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Slot Form Sheet */}
      <SlotFormSheet
        open={showSlotForm}
        onOpenChange={setShowSlotForm}
        slot={editingSlot}
        groups={groups}
        coaches={coachesForForm}
      />

      {/* Override Form Sheet */}
      <OverrideFormSheet
        open={showOverrideForm}
        onOpenChange={setShowOverrideForm}
        slot={overrideSlot}
      />
    </div>
  );
};

export default CoachTrainingSlotsScreen;
