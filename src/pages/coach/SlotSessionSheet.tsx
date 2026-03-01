/**
 * SlotSessionSheet — Bottom sheet for slot actions (create/edit/visibility/delete)
 *
 * Opens when the coach taps a slot card in CoachSlotCalendar.
 * Behavior adapts to SlotState (empty / draft / published / cancelled).
 */

import { useState, useEffect, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  BookOpen,
  Pencil,
  Copy,
  Eye,
  EyeOff,
  Trash2,
  Clock,
  MapPin,
  CalendarDays,
  Loader2,
} from "lucide-react";
import { updateSlotVisibility, deleteSlotAssignments } from "@/lib/api/assignments";
import type { SlotInstance, SlotState } from "@/hooks/useSlotCalendar";

// ── Props ────────────────────────────────────────────────────

export interface SlotSessionSheetProps {
  instance: SlotInstance | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateNew: (slotInstance: SlotInstance) => void;
  onEditSession: (sessionId: number) => void;
  onPickTemplate: (slotInstance: SlotInstance) => void;
}

// ── Helpers ──────────────────────────────────────────────────

const DAY_NAMES = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
];

function formatTime(hhmm: string): string {
  return hhmm.slice(0, 5);
}

function formatDateFr(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dayIndex = (date.getDay() + 6) % 7; // Monday=0
  const dayName = DAY_NAMES[dayIndex];
  const monthName = date.toLocaleDateString("fr-FR", { month: "long" });
  return `${dayName} ${d} ${monthName}`;
}

const STATE_CONFIG: Record<
  SlotState,
  { label: string; badgeClass: string }
> = {
  empty: { label: "", badgeClass: "" },
  draft: {
    label: "Brouillon",
    badgeClass:
      "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25",
  },
  published: {
    label: "Publié",
    badgeClass:
      "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
  },
  cancelled: {
    label: "Annulé",
    badgeClass: "bg-muted text-muted-foreground border-border/50",
  },
};

// ── Component ────────────────────────────────────────────────

export default function SlotSessionSheet({
  instance,
  open,
  onOpenChange,
  onCreateNew,
  onEditSession,
  onPickTemplate,
}: SlotSessionSheetProps) {
  const queryClient = useQueryClient();

  // ── Local state ──────────────────────────────────────────
  const [selectedGroups, setSelectedGroups] = useState<number[]>([]);
  const [visibleFrom, setVisibleFrom] = useState("");
  const [showVisibilityPicker, setShowVisibilityPicker] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Reset local state when instance changes
  useEffect(() => {
    if (!instance) return;

    // Pre-check all groups from slot assignments
    setSelectedGroups(instance.groups.map((g) => g.group_id));

    // Default visible_from to instance date
    setVisibleFrom(instance.assignment?.visible_from ?? instance.date);

    // Reset toggles
    setShowVisibilityPicker(false);
    setDeleteConfirmOpen(false);
  }, [instance]);

  // ── Mutations ────────────────────────────────────────────
  const invalidateSlotAssignments = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["slot-assignments"] });
  }, [queryClient]);

  const visibilityMutation = useMutation({
    mutationFn: (params: {
      trainingSlotId: string;
      scheduledDate: string;
      visibleFrom: string | null;
    }) => updateSlotVisibility(params),
    onSuccess: () => {
      invalidateSlotAssignments();
      setShowVisibilityPicker(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (params: {
      trainingSlotId: string;
      scheduledDate: string;
    }) => deleteSlotAssignments(params),
    onSuccess: () => {
      invalidateSlotAssignments();
      setDeleteConfirmOpen(false);
      onOpenChange(false);
    },
  });

  // ── Handlers ─────────────────────────────────────────────
  const handleToggleGroup = (groupId: number) => {
    setSelectedGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId],
    );
  };

  const handleSaveVisibility = () => {
    if (!instance) return;
    visibilityMutation.mutate({
      trainingSlotId: instance.slot.id,
      scheduledDate: instance.date,
      visibleFrom: visibleFrom || null,
    });
  };

  const handleConfirmDelete = () => {
    if (!instance) return;
    deleteMutation.mutate({
      trainingSlotId: instance.slot.id,
      scheduledDate: instance.date,
    });
  };

  // ── Guard ────────────────────────────────────────────────
  if (!instance) return null;

  const { state, slot, assignment, override, groups } = instance;
  const cfg = STATE_CONFIG[state];

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl max-h-[85vh] overflow-y-auto px-5 pb-8 pt-4"
        >
          {/* ── Drag handle ── */}
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border/60" />

          {/* ── Header ── */}
          <SheetHeader className="text-left space-y-1.5 mb-5">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-base font-bold leading-tight">
                {formatDateFr(instance.date)}
              </SheetTitle>
              {state !== "empty" && (
                <Badge
                  variant="outline"
                  className={`text-[10px] px-2 py-0.5 font-medium leading-none ${cfg.badgeClass}`}
                >
                  {cfg.label}
                </Badge>
              )}
            </div>
            <SheetDescription className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3 opacity-60" />
                {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3 opacity-60" />
                {slot.location}
              </span>
            </SheetDescription>
          </SheetHeader>

          {/* ── Body: adapts to slot state ── */}
          {state === "cancelled" && <CancelledBody override={override} />}
          {state === "empty" && (
            <EmptyBody
              instance={instance}
              groups={groups}
              selectedGroups={selectedGroups}
              visibleFrom={visibleFrom}
              onToggleGroup={handleToggleGroup}
              onVisibleFromChange={setVisibleFrom}
              onCreateNew={onCreateNew}
              onPickTemplate={onPickTemplate}
              onClose={() => onOpenChange(false)}
            />
          )}
          {(state === "draft" || state === "published") && (
            <FilledBody
              instance={instance}
              assignment={assignment!}
              showVisibilityPicker={showVisibilityPicker}
              visibleFrom={visibleFrom}
              visibilityLoading={visibilityMutation.isPending}
              deleteLoading={deleteMutation.isPending}
              onToggleVisibilityPicker={() =>
                setShowVisibilityPicker((v) => !v)
              }
              onVisibleFromChange={setVisibleFrom}
              onSaveVisibility={handleSaveVisibility}
              onEditSession={onEditSession}
              onRequestDelete={() => setDeleteConfirmOpen(true)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* ── Delete confirmation dialog ── */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la séance ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprimera définitivement la séance assignée pour ce
              créneau le {formatDateFr(instance.date)}. Les nageurs ne verront
              plus cette séance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Suppression...
                </>
              ) : (
                "Supprimer"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── CancelledBody ───────────────────────────────────────────

function CancelledBody({
  override,
}: {
  override?: SlotInstance["override"];
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-muted/40 border border-border/50 p-4 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          Ce créneau a été annulé
        </p>
        {override?.reason && (
          <p className="mt-1.5 text-xs text-muted-foreground/70 italic">
            {override.reason}
          </p>
        )}
      </div>
    </div>
  );
}

// ── EmptyBody ───────────────────────────────────────────────

function EmptyBody({
  instance,
  groups,
  selectedGroups,
  visibleFrom,
  onToggleGroup,
  onVisibleFromChange,
  onCreateNew,
  onPickTemplate,
  onClose,
}: {
  instance: SlotInstance;
  groups: SlotInstance["groups"];
  selectedGroups: number[];
  visibleFrom: string;
  onToggleGroup: (groupId: number) => void;
  onVisibleFromChange: (date: string) => void;
  onCreateNew: (inst: SlotInstance) => void;
  onPickTemplate: (inst: SlotInstance) => void;
  onClose: () => void;
}) {
  const handleCreateNew = () => {
    onClose();
    onCreateNew(instance);
  };

  const handlePickTemplate = () => {
    onClose();
    onPickTemplate(instance);
  };

  return (
    <div className="space-y-5">
      {/* Group checkboxes */}
      {groups.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Groupes
          </p>
          <div className="space-y-2.5">
            {groups.map((g) => (
              <label
                key={g.id}
                className="flex items-center gap-3 cursor-pointer"
              >
                <Checkbox
                  checked={selectedGroups.includes(g.group_id)}
                  onCheckedChange={() => onToggleGroup(g.group_id)}
                  className="h-5 w-5"
                />
                <span className="text-sm font-medium text-foreground">
                  {g.group_name}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Visible from date */}
      <div className="space-y-2">
        <Label
          htmlFor="visible-from-empty"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          <CalendarDays className="inline h-3 w-3 mr-1 opacity-60" />
          Visible à partir du
        </Label>
        <input
          id="visible-from-empty"
          type="date"
          value={visibleFrom}
          onChange={(e) => onVisibleFromChange(e.target.value)}
          className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <Separator className="my-1" />

      {/* Action buttons */}
      <div className="space-y-2.5">
        <button
          type="button"
          onClick={handleCreateNew}
          className="flex w-full items-center gap-3 rounded-xl bg-primary/10 px-4 py-3.5 text-left transition-colors active:bg-primary/20 hover:bg-primary/15"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15">
            <Plus className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Nouvelle séance
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Créer une séance de zéro
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={handlePickTemplate}
          className="flex w-full items-center gap-3 rounded-xl bg-muted/50 border border-border/50 px-4 py-3.5 text-left transition-colors active:bg-muted/80 hover:bg-muted/70"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <BookOpen className="h-4.5 w-4.5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Depuis la bibliothèque
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Utiliser une séance existante
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}

// ── FilledBody (draft / published) ──────────────────────────

function FilledBody({
  instance,
  assignment,
  showVisibilityPicker,
  visibleFrom,
  visibilityLoading,
  deleteLoading,
  onToggleVisibilityPicker,
  onVisibleFromChange,
  onSaveVisibility,
  onEditSession,
  onRequestDelete,
}: {
  instance: SlotInstance;
  assignment: NonNullable<SlotInstance["assignment"]>;
  showVisibilityPicker: boolean;
  visibleFrom: string;
  visibilityLoading: boolean;
  deleteLoading: boolean;
  onToggleVisibilityPicker: () => void;
  onVisibleFromChange: (date: string) => void;
  onSaveVisibility: () => void;
  onEditSession: (sessionId: number) => void;
  onRequestDelete: () => void;
}) {
  return (
    <div className="space-y-5">
      {/* Session preview */}
      <div className="rounded-xl bg-muted/30 border border-border/50 p-4">
        <p className="text-sm font-semibold text-foreground leading-snug">
          {assignment.session_name ?? "Séance sans nom"}
        </p>
        {assignment.session_distance != null &&
          assignment.session_distance > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {assignment.session_distance} m
            </p>
          )}
        <div className="flex items-center gap-2 mt-2">
          <Badge
            variant="outline"
            className={`text-[10px] px-2 py-0.5 font-medium leading-none ${STATE_CONFIG[instance.state].badgeClass}`}
          >
            {STATE_CONFIG[instance.state].label}
          </Badge>
          {assignment.visible_from && (
            <span className="text-[10px] text-muted-foreground">
              Visible le{" "}
              {new Date(assignment.visible_from).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
              })}
            </span>
          )}
        </div>
      </div>

      {/* Groups */}
      {instance.groups.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {instance.groups.map((g) => (
            <span
              key={g.id}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border border-border/50 bg-muted/60 text-muted-foreground"
            >
              {g.group_name}
            </span>
          ))}
        </div>
      )}

      <Separator className="my-1" />

      {/* Action buttons */}
      <div className="space-y-2.5">
        {/* Modifier */}
        {assignment.swim_catalog_id != null && (
          <ActionButton
            icon={<Pencil className="h-4 w-4" />}
            label="Modifier"
            description="Ouvrir dans l'éditeur"
            onClick={() => onEditSession(assignment.swim_catalog_id!)}
          />
        )}

        {/* Dupliquer (disabled v1) */}
        <ActionButton
          icon={<Copy className="h-4 w-4" />}
          label="Dupliquer vers..."
          description="Bientôt disponible"
          disabled
          onClick={() => {}}
        />

        {/* Visibilité */}
        <ActionButton
          icon={
            showVisibilityPicker ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )
          }
          label="Visibilité"
          description="Date de publication pour les nageurs"
          onClick={onToggleVisibilityPicker}
        />

        {/* Inline visibility picker */}
        {showVisibilityPicker && (
          <div className="ml-12 space-y-2.5 rounded-xl border border-border/50 bg-muted/20 p-3">
            <Label
              htmlFor="visible-from-edit"
              className="text-xs text-muted-foreground"
            >
              Visible à partir du
            </Label>
            <input
              id="visible-from-edit"
              type="date"
              value={visibleFrom}
              onChange={(e) => onVisibleFromChange(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 rounded-lg"
                disabled={visibilityLoading}
                onClick={onSaveVisibility}
              >
                {visibilityLoading ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : null}
                Enregistrer
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="rounded-lg"
                disabled={visibilityLoading}
                onClick={onToggleVisibilityPicker}
              >
                Annuler
              </Button>
            </div>
          </div>
        )}

        {/* Supprimer */}
        <ActionButton
          icon={<Trash2 className="h-4 w-4" />}
          label="Supprimer"
          description="Retirer cette séance du créneau"
          variant="destructive"
          disabled={deleteLoading}
          onClick={onRequestDelete}
        />
      </div>
    </div>
  );
}

// ── ActionButton ────────────────────────────────────────────

function ActionButton({
  icon,
  label,
  description,
  variant = "default",
  disabled = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  variant?: "default" | "destructive";
  disabled?: boolean;
  onClick: () => void;
}) {
  const isDestructive = variant === "destructive";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left transition-colors
        ${disabled ? "opacity-40 cursor-not-allowed" : "active:scale-[0.98]"}
        ${
          isDestructive
            ? "bg-destructive/5 hover:bg-destructive/10 active:bg-destructive/15"
            : "bg-muted/40 hover:bg-muted/60 active:bg-muted/80"
        }
      `}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          isDestructive
            ? "bg-destructive/10 text-destructive"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-semibold ${
            isDestructive ? "text-destructive" : "text-foreground"
          }`}
        >
          {label}
        </p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
    </button>
  );
}
