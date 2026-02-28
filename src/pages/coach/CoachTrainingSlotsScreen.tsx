import { useEffect, useMemo, useRef, useState } from "react";
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
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Plus,
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

const DAYS_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

/** Timeline range */
const TIMELINE_START = 6; // 06:00
const TIMELINE_END = 22; // 22:00
const TIMELINE_HOURS = TIMELINE_END - TIMELINE_START; // 16h
const PX_PER_HOUR = 40;
const TIMELINE_HEIGHT = TIMELINE_HOURS * PX_PER_HOUR; // 640px
const HOUR_LABELS = Array.from({ length: TIMELINE_HOURS + 1 }, (_, i) => TIMELINE_START + i);

/** Mobile compact timeline */
const MOBILE_PX_PER_HOUR = 40;

// ── Helpers ──────────────────────────────────────────────────────

function formatTime(t: string): string {
  // "08:00:00" → "08:00"
  return t.slice(0, 5);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Convert "HH:MM" or "HH:MM:SS" to minutes since midnight */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Convert time to pixel offset from timeline top */
function timeToPx(t: string): number {
  const mins = timeToMinutes(t);
  return ((mins - TIMELINE_START * 60) / 60) * PX_PER_HOUR;
}

/** Duration in px between two time strings */
function durationPx(start: string, end: string): number {
  return timeToPx(end) - timeToPx(start);
}

/** Get Monday of the week containing `date` */
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon...6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** ISO week number (ISO 8601) */
function getISOWeek(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const jan4 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
}

/** Format date as "DD/MM" */
function formatDayMonth(date: Date): string {
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

/** ISO date string "YYYY-MM-DD" from a Date */
function toIsoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** True if slot is a swimming session (vs PPG/muscu) based on location */
function isSwimSlot(location: string): boolean {
  const loc = location.toLowerCase();
  return loc.includes("piscine") || loc.includes("bassin") || (!loc.includes("salle") && !loc.includes("muscu") && !loc.includes("ppg") && !loc.includes("gym"));
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

// ── Timeline Slot Block (positioned absolutely on the timeline) ──

type TimelineSlotProps = {
  slot: TrainingSlot;
  hasOverrides: boolean;
  cancelled?: boolean;
  onSelect: (slot: TrainingSlot) => void;
};

const TimelineSlot = ({ slot, hasOverrides, cancelled = false, onSelect }: TimelineSlotProps) => {
  const top = timeToPx(slot.start_time);
  const height = durationPx(slot.start_time, slot.end_time);
  const isShort = height < 50;
  const swim = isSwimSlot(slot.location);

  const bgClass = cancelled
    ? "bg-muted/50 border-muted-foreground/20 opacity-50 line-through"
    : swim
      ? "bg-blue-500/15 border-blue-400/40 hover:bg-blue-500/25"
      : "bg-amber-400/15 border-amber-400/40 hover:bg-amber-400/25";

  const iconClass = swim ? "text-blue-500" : "text-amber-500";

  return (
    <button
      type="button"
      className={`absolute left-0.5 right-0.5 rounded-md border px-1.5 py-0.5 text-left overflow-hidden cursor-pointer transition-colors ${bgClass}`}
      style={{ top, height, minHeight: 24 }}
      onClick={() => onSelect(slot)}
      title={`${formatTime(slot.start_time)}–${formatTime(slot.end_time)} · ${slot.location}`}
    >
      <div className={`flex flex-col gap-0.5 ${isShort ? "flex-row items-center" : ""}`}>
        {/* Location */}
        <div className="flex items-center gap-1 min-w-0">
          <MapPin className={`h-2.5 w-2.5 shrink-0 ${iconClass}`} />
          <span className="text-[10px] font-medium text-foreground truncate">
            {slot.location}
          </span>
          {hasOverrides && !cancelled && (
            <AlertTriangle className="h-2.5 w-2.5 text-orange-500 shrink-0" />
          )}
        </div>

        {/* Group badges */}
        {!isShort && slot.assignments.length > 0 && (
          <div className="flex flex-wrap gap-0.5">
            {slot.assignments.map((a) => (
              <Badge
                key={a.id}
                variant="secondary"
                className="text-[9px] px-1 py-0 leading-tight"
              >
                {a.group_name}
              </Badge>
            ))}
          </div>
        )}

        {/* Coach names for taller slots */}
        {!isShort && height >= 70 && slot.assignments.length > 0 && (
          <span className="text-[9px] text-muted-foreground truncate">
            {[...new Set(slot.assignments.map((a) => a.coach_name))].join(", ")}
          </span>
        )}
      </div>
    </button>
  );
};

// ── Slot Detail Sheet (bottom sheet on tap) ─────────────────────

type SlotDetailSheetProps = {
  slot: TrainingSlot | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overrides: TrainingSlotOverride[];
  onEdit: () => void;
  onOverride: () => void;
  onDeleteOverride: (id: string) => void;
};

const SlotDetailSheet = ({
  slot,
  open,
  onOpenChange,
  overrides,
  onEdit,
  onOverride,
  onDeleteOverride,
}: SlotDetailSheetProps) => {
  if (!slot) return null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[60vh] overflow-y-auto rounded-t-2xl"
      >
        <SheetHeader className="pb-2">
          <SheetTitle className="text-left text-base">
            {DAYS_FR[slot.day_of_week - 1]} · {formatTime(slot.start_time)}–
            {formatTime(slot.end_time)}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Details du creneau
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3">
          {/* Location */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {slot.location}
          </div>

          {/* Assignments */}
          {slot.assignments.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {slot.assignments.map((a) => (
                <div key={a.id} className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-xs px-2 py-0.5">
                    {a.group_name}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {a.coach_name}
                    {a.lane_count != null &&
                      ` · ${a.lane_count} ligne${a.lane_count > 1 ? "s" : ""}`}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Overrides */}
          {overrides.length > 0 && (
            <div className="space-y-1.5 pt-1 border-t border-dashed">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Exceptions
              </span>
              {overrides.map((ovr) => (
                <div
                  key={ovr.id}
                  className="flex items-center gap-1.5 text-xs"
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
                      ovr.status === "cancelled" ? "destructive" : "outline"
                    }
                    className="text-[10px] px-1 py-0"
                  >
                    {ovr.status === "cancelled" ? "Annule" : "Modifie"}
                  </Badge>
                  {ovr.reason && (
                    <span className="text-muted-foreground truncate flex-1">
                      {ovr.reason}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 ml-auto shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onDeleteOverride(ovr.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={onEdit}>
              Modifier
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={onOverride}>
              Exception
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

// ── Mobile Week Timeline ─────────────────────────────────────────

type MobileTimelineProps = {
  slotsByDay: Map<number, TrainingSlot[]>;
  weekDates: Date[];
  todayStr: string;
  overridesBySlot: Map<string, TrainingSlotOverride[]>;
  cancelledSlotIds: Set<string>;
  onSelect: (slot: TrainingSlot) => void;
  mobileTimeRange: { start: number; end: number };
  onPrevWeek: () => void;
  onNextWeek: () => void;
  weekNumber: number;
};

const MobileTimeline = ({
  slotsByDay,
  weekDates,
  todayStr,
  overridesBySlot,
  cancelledSlotIds,
  onSelect,
  mobileTimeRange,
  onPrevWeek,
  onNextWeek,
  weekNumber,
}: MobileTimelineProps) => {
  const todayColRef = useRef<HTMLDivElement>(null);
  const rangeHours = mobileTimeRange.end - mobileTimeRange.start;
  const timelineH = rangeHours * MOBILE_PX_PER_HOUR;
  const hourLabels = Array.from({ length: rangeHours + 1 }, (_, i) => mobileTimeRange.start + i);

  useEffect(() => {
    todayColRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, []);

  const mTimeToPx = (t: string) => {
    const mins = timeToMinutes(t);
    return ((mins - mobileTimeRange.start * 60) / 60) * MOBILE_PX_PER_HOUR;
  };
  const mDurationPx = (start: string, end: string) => mTimeToPx(end) - mTimeToPx(start);

  return (
    <div className="space-y-2">
      {/* Week nav row */}
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          className="flex items-center justify-center h-8 w-8 rounded-full text-muted-foreground hover:bg-muted active:scale-90 transition-all"
          onClick={onPrevWeek}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs font-bold text-primary uppercase tracking-wider font-display">
            S{weekNumber}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {formatDayMonth(weekDates[0])} – {formatDayMonth(weekDates[6])}
          </span>
        </div>
        <button
          type="button"
          className="flex items-center justify-center h-8 w-8 rounded-full text-muted-foreground hover:bg-muted active:scale-90 transition-all"
          onClick={onNextWeek}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Timeline grid */}
      <div className="overflow-x-auto overflow-y-auto no-scrollbar -mx-4 px-4" style={{ maxHeight: "calc(100vh - 220px)" }}>
        <div
          className="grid min-w-max"
          style={{ gridTemplateColumns: "1.5rem repeat(7, 80px)" }}
        >
          {/* Day headers */}
          <div /> {/* empty corner */}
          {weekDates.map((date, i) => {
            const isToday = toIsoDate(date) === todayStr;
            return (
              <div key={i} ref={isToday ? todayColRef : undefined} className="text-center pb-1.5 sticky top-0 bg-background z-10">
                <span className={`text-[9px] font-semibold uppercase tracking-wider ${
                  isToday ? "text-primary" : "text-muted-foreground"
                }`}>
                  {DAYS_SHORT[i]}
                </span>
                <br />
                <span className={`text-[10px] font-bold tabular-nums ${
                  isToday ? "text-primary" : "text-foreground"
                }`}>
                  {date.getDate()}
                </span>
              </div>
            );
          })}

          {/* Time labels column */}
          <div className="relative sticky top-0" style={{ height: timelineH }}>
            {hourLabels.map((h) => (
              <span
                key={h}
                className="absolute right-0.5 text-[8px] text-muted-foreground/60 leading-none -translate-y-1/2 tabular-nums"
                style={{ top: (h - mobileTimeRange.start) * MOBILE_PX_PER_HOUR }}
              >
                {h}
              </span>
            ))}
          </div>

          {/* 7 day columns */}
          {Array.from({ length: 7 }, (_, i) => i + 1).map((day) => {
            const daySlots = slotsByDay.get(day) ?? [];
            const isToday = toIsoDate(weekDates[day - 1]) === todayStr;
            return (
              <div
                key={day}
                className={`relative border-l ${
                  isToday ? "border-primary/20 bg-primary/3" : "border-border/30"
                }`}
                style={{ height: timelineH }}
              >
                {/* Hour grid lines */}
                {hourLabels.map((h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-border/15"
                    style={{ top: (h - mobileTimeRange.start) * MOBILE_PX_PER_HOUR }}
                  />
                ))}

                {/* Slot blocks */}
                {daySlots.map((slot) => {
                  const top = mTimeToPx(slot.start_time);
                  const height = mDurationPx(slot.start_time, slot.end_time);
                  const swim = isSwimSlot(slot.location);
                  const cancelled = cancelledSlotIds.has(slot.id);
                  const hasOverrides = (overridesBySlot.get(slot.id) ?? []).length > 0;
                  const isShort = height < 40;

                  const bgClass = cancelled
                    ? "bg-muted/40 border-muted-foreground/15"
                    : swim
                      ? "bg-blue-500/12 border-blue-400/30 active:bg-blue-500/25"
                      : "bg-amber-400/12 border-amber-400/30 active:bg-amber-400/25";

                  return (
                    <button
                      key={slot.id}
                      type="button"
                      className={`absolute left-0.5 right-0.5 rounded-md border overflow-hidden text-left transition-colors ${bgClass} ${
                        cancelled ? "opacity-50" : ""
                      }`}
                      style={{ top, height: Math.max(height, 20), minHeight: 20 }}
                      onClick={() => onSelect(slot)}
                    >
                      <div className="px-1 py-0.5 h-full flex flex-col justify-center">
                        {/* Time */}
                        <span className={`text-[8px] font-bold tabular-nums leading-none ${
                          cancelled
                            ? "line-through text-muted-foreground"
                            : swim ? "text-blue-700" : "text-amber-700"
                        }`}>
                          {formatTime(slot.start_time)}
                        </span>

                        {/* Location (only if enough height) */}
                        {!isShort && (
                          <span className="text-[7px] text-muted-foreground leading-tight mt-0.5 truncate">
                            {slot.location.replace(/Piscine |Salle /i, "")}
                          </span>
                        )}

                        {/* Group badges (only for tall blocks) */}
                        {!isShort && height >= 55 && slot.assignments.length > 0 && (
                          <div className="flex flex-wrap gap-0.5 mt-0.5">
                            {slot.assignments.slice(0, 2).map((a) => (
                              <span
                                key={a.id}
                                className={`text-[6px] font-medium px-1 py-0 rounded leading-tight ${
                                  swim ? "bg-blue-500/10 text-blue-600" : "bg-amber-400/10 text-amber-600"
                                }`}
                              >
                                {a.group_name}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Override warning dot */}
                        {hasOverrides && !cancelled && (
                          <div className="absolute top-0.5 right-0.5">
                            <span className="block h-1.5 w-1.5 rounded-full bg-orange-500" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
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
  const [selectedSlot, setSelectedSlot] = useState<TrainingSlot | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  // Week navigation state
  const [weekMonday, setWeekMonday] = useState(() => getMonday(new Date()));

  const weekNumber = useMemo(() => getISOWeek(weekMonday), [weekMonday]);
  const weekSunday = useMemo(() => {
    const d = new Date(weekMonday);
    d.setDate(d.getDate() + 6);
    return d;
  }, [weekMonday]);

  /** Dates for each day column (Mon=0 … Sun=6) */
  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekMonday);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekMonday]);

  const prevWeek = () =>
    setWeekMonday((m) => {
      const d = new Date(m);
      d.setDate(d.getDate() - 7);
      return d;
    });
  const nextWeek = () =>
    setWeekMonday((m) => {
      const d = new Date(m);
      d.setDate(d.getDate() + 7);
      return d;
    });
  const goToday = () => setWeekMonday(getMonday(new Date()));

  // Filter state
  const [filterValue, setFilterValue] = useState<string>("all");

  // Fetch slots
  const { data: slots = [], isLoading: slotsLoading } = useQuery({
    queryKey: ["training-slots"],
    queryFn: () => api.getTrainingSlots(),
  });

  // Fetch all overrides (we filter client-side per week)
  const { data: allOverrides = [] } = useQuery({
    queryKey: ["training-slot-overrides"],
    queryFn: () => api.getSlotOverrides(),
  });

  // Fetch coaches
  const { data: coaches = [] } = useQuery({
    queryKey: ["users", "coaches"],
    queryFn: () => api.listUsers({ role: "coach" }),
  });

  // Filter slots
  const filteredSlots = useMemo(() => {
    if (filterValue === "all") return slots;
    if (filterValue.startsWith("group:")) {
      const gid = Number(filterValue.split(":")[1]);
      return slots.filter((s) =>
        s.assignments.some((a) => a.group_id === gid),
      );
    }
    if (filterValue.startsWith("coach:")) {
      const cid = Number(filterValue.split(":")[1]);
      return slots.filter((s) =>
        s.assignments.some((a) => a.coach_id === cid),
      );
    }
    return slots;
  }, [slots, filterValue]);

  // Group filtered slots by day, sorted by start_time
  const slotsByDay = useMemo(() => {
    const map = new Map<number, TrainingSlot[]>();
    for (let d = 1; d <= 7; d++) map.set(d, []);
    for (const s of filteredSlots) {
      map.get(s.day_of_week)!.push(s);
    }
    // Sort each day by start_time
    for (const list of map.values()) {
      list.sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
    return map;
  }, [filteredSlots]);

  // Overrides scoped to the selected week
  const weekMondayIso = toIsoDate(weekMonday);
  const weekSundayIso = toIsoDate(weekSunday);

  const weekOverrides = useMemo(() => {
    return allOverrides.filter(
      (o) => o.override_date >= weekMondayIso && o.override_date <= weekSundayIso,
    );
  }, [allOverrides, weekMondayIso, weekSundayIso]);

  // Overrides indexed by slot_id for the selected week
  const overridesBySlot = useMemo(() => {
    const map = new Map<string, TrainingSlotOverride[]>();
    for (const o of weekOverrides) {
      const list = map.get(o.slot_id) ?? [];
      list.push(o);
      map.set(o.slot_id, list);
    }
    return map;
  }, [weekOverrides]);

  /** Set of slot IDs cancelled this week */
  const cancelledSlotIds = useMemo(() => {
    const set = new Set<string>();
    for (const o of weekOverrides) {
      if (o.status === "cancelled") set.add(o.slot_id);
    }
    return set;
  }, [weekOverrides]);

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

  const handleSelect = (slot: TrainingSlot) => {
    setSelectedSlot(slot);
    setShowDetail(true);
  };

  const handleEditFromDetail = () => {
    if (!selectedSlot) return;
    setShowDetail(false);
    setEditingSlot(selectedSlot);
    setShowSlotForm(true);
  };

  const handleOverrideFromDetail = () => {
    if (!selectedSlot) return;
    setShowDetail(false);
    setOverrideSlot(selectedSlot);
    setShowOverrideForm(true);
  };

  const coachesForForm = coaches.map((c) => ({
    id: c.id,
    display_name: c.display_name,
  }));

  // Compute a smart mobile time range based on actual slot times (±1h padding)
  const mobileTimeRange = useMemo(() => {
    let minH = 22;
    let maxH = 6;
    for (const s of filteredSlots) {
      const startH = Math.floor(timeToMinutes(s.start_time) / 60);
      const endH = Math.ceil(timeToMinutes(s.end_time) / 60);
      if (startH < minH) minH = startH;
      if (endH > maxH) maxH = endH;
    }
    if (minH >= maxH) return { start: TIMELINE_START, end: TIMELINE_END };
    return {
      start: Math.max(0, minH - 1),
      end: Math.min(24, maxH + 1),
    };
  }, [filteredSlots]);

  const description =
    slots.length === 0
      ? "Planning hebdomadaire des entrainements."
      : `${slots.length} creneau${slots.length > 1 ? "x" : ""}`;


  return (
    <div className="space-y-4 pb-24">
      {/* ── Mobile header ── */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2" onClick={onBack}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div>
              <h2 className="text-lg font-display font-semibold uppercase italic text-primary leading-tight">
                Créneaux
              </h2>
              {slots.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  {slots.length} créneau{slots.length > 1 ? "x" : ""} actif{slots.length > 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            className="flex items-center justify-center h-9 w-9 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 active:scale-90 transition-all"
            onClick={handleCreate}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Desktop header ── */}
      <div className="hidden sm:block">
        <CoachSectionHeader
          title="Creneaux"
          description={description}
          onBack={onBack}
          actions={
            <Button variant="outline" size="sm" onClick={handleCreate}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Nouveau
            </Button>
          }
        />
      </div>

      {/* ── Mobile filter ── */}
      {!slotsLoading && slots.length > 0 && (
        <div className="sm:hidden">
          <Select value={filterValue} onValueChange={setFilterValue}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filtrer..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les créneaux</SelectItem>
              <SelectSeparator />
              {groups.map((g) => (
                <SelectItem key={g.id} value={`group:${g.id}`}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* ── Desktop week navigation + filters ── */}
      <div className="hidden sm:block space-y-3">
        {/* Week nav bar */}
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm font-semibold hover:bg-muted/50 transition-colors"
            onClick={goToday}
            title="Revenir a cette semaine"
          >
            <span className="text-primary">S{weekNumber}</span>
            <span className="text-muted-foreground text-xs font-normal">
              {formatDayMonth(weekMonday)} – {formatDayMonth(weekSunday)}
            </span>
          </button>

          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-row items-center gap-3">
          <Select value={filterValue} onValueChange={setFilterValue}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Filtrer..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les créneaux</SelectItem>
              <SelectSeparator />
              {groups.map((g) => (
                <SelectItem key={g.id} value={`group:${g.id}`}>
                  {g.name}
                </SelectItem>
              ))}
              {coaches.length > 0 && <SelectSeparator />}
              {coaches.map((c) => (
                <SelectItem key={c.id} value={`coach:${c.id}`}>
                  {c.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Content ── */}
      {slotsLoading ? (
        <>
          {/* Mobile skeleton */}
          <div className="sm:hidden space-y-2">
            <div className="flex items-center justify-between px-1">
              <div className="h-8 w-8 rounded-full bg-muted animate-pulse motion-reduce:animate-none" />
              <div className="h-4 w-28 rounded bg-muted animate-pulse motion-reduce:animate-none" />
              <div className="h-8 w-8 rounded-full bg-muted animate-pulse motion-reduce:animate-none" />
            </div>
            <div
              className="grid gap-0 -mx-4 px-4"
              style={{ gridTemplateColumns: "1.5rem repeat(7, 1fr)" }}
            >
              <div />
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i} className="text-center pb-1.5">
                  <div className="h-3 w-6 mx-auto rounded bg-muted animate-pulse motion-reduce:animate-none mb-0.5" />
                  <div className="h-3.5 w-4 mx-auto rounded bg-muted animate-pulse motion-reduce:animate-none" />
                </div>
              ))}
              <div />
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i} className="border-l border-border/30 h-64 relative">
                  <div className="absolute left-0.5 right-0.5 top-8 h-16 rounded-md bg-muted animate-pulse motion-reduce:animate-none" />
                  <div className="absolute left-0.5 right-0.5 top-32 h-12 rounded-md bg-muted animate-pulse motion-reduce:animate-none" />
                </div>
              ))}
            </div>
          </div>
          {/* Desktop skeleton */}
          <div className="hidden sm:grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-12 rounded bg-muted animate-pulse motion-reduce:animate-none" />
                <div className="h-40 rounded-lg bg-muted animate-pulse motion-reduce:animate-none" />
              </div>
            ))}
          </div>
        </>
      ) : slots.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center">
            <Clock className="h-7 w-7 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              Aucun créneau défini
            </p>
            <p className="text-xs text-muted-foreground">
              Créez votre premier créneau d'entraînement.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleCreate}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Créer un créneau
          </Button>
        </div>
      ) : (
        <>
          {/* ── Mobile timeline ── */}
          <div className="sm:hidden">
            <MobileTimeline
              slotsByDay={slotsByDay}
              weekDates={weekDates}
              todayStr={todayIso()}
              overridesBySlot={overridesBySlot}
              cancelledSlotIds={cancelledSlotIds}
              onSelect={handleSelect}
              mobileTimeRange={mobileTimeRange}
              onPrevWeek={prevWeek}
              onNextWeek={nextWeek}
              weekNumber={weekNumber}
            />
          </div>

          {/* ── Desktop timeline ── */}
          <div className="hidden sm:block overflow-x-auto -mx-4 px-4">
            <div
              className="grid"
              style={{
                minWidth: "760px",
                gridTemplateColumns: "2rem repeat(7, 1fr)",
              }}
            >
              {/* ── Day headers row ── */}
              <div /> {/* empty cell above time labels */}
              {weekDates.map((date, i) => {
                const isToday = toIsoDate(date) === todayIso();
                return (
                  <div key={i} className="text-center pb-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      {DAYS_FR[i]}
                    </span>
                    <br />
                    <span className={`text-[10px] ${isToday ? "text-primary font-bold" : "text-muted-foreground/60"}`}>
                      {formatDayMonth(date)}
                    </span>
                  </div>
                );
              })}

              {/* ── Time labels column ── */}
              <div className="relative" style={{ height: TIMELINE_HEIGHT }}>
                {HOUR_LABELS.map((h) => (
                  <span
                    key={h}
                    className="absolute right-1 text-[9px] text-muted-foreground/70 leading-none -translate-y-1/2"
                    style={{ top: (h - TIMELINE_START) * PX_PER_HOUR }}
                  >
                    {h}h
                  </span>
                ))}
              </div>

              {/* ── 7 day columns ── */}
              {Array.from({ length: 7 }, (_, i) => i + 1).map((day) => {
                const daySlots = slotsByDay.get(day) ?? [];
                return (
                  <div
                    key={day}
                    className="relative border-l border-border/40"
                    style={{ height: TIMELINE_HEIGHT }}
                  >
                    {/* Hour grid lines */}
                    {HOUR_LABELS.map((h) => (
                      <div
                        key={h}
                        className="absolute left-0 right-0 border-t border-border/20"
                        style={{ top: (h - TIMELINE_START) * PX_PER_HOUR }}
                      />
                    ))}

                    {/* Slot blocks */}
                    {daySlots.map((slot) => (
                      <TimelineSlot
                        key={slot.id}
                        slot={slot}
                        hasOverrides={
                          (overridesBySlot.get(slot.id) ?? []).length > 0
                        }
                        cancelled={cancelledSlotIds.has(slot.id)}
                        onSelect={handleSelect}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Slot Detail Sheet (tap on timeline) */}
      <SlotDetailSheet
        slot={selectedSlot}
        open={showDetail}
        onOpenChange={setShowDetail}
        overrides={
          selectedSlot ? (overridesBySlot.get(selectedSlot.id) ?? []) : []
        }
        onEdit={handleEditFromDetail}
        onOverride={handleOverrideFromDetail}
        onDeleteOverride={(id) => deleteOverrideMutation.mutate(id)}
      />

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
