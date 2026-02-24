import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Competition, CompetitionInput, CompetitionAssignment } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import CoachSectionHeader from "./CoachSectionHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trophy, MapPin, Users, MessageSquare } from "lucide-react";
import { supabase } from "@/lib/supabase";

// ── Helpers ─────────────────────────────────────────────────────

function formatDateFr(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Competition Form Sheet ──────────────────────────────────────

type CompetitionFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competition?: Competition | null;
};

const CompetitionFormSheet = ({
  open,
  onOpenChange,
  competition,
}: CompetitionFormProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!competition;

  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [multiDay, setMultiDay] = useState(true);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [assignedAthleteIds, setAssignedAthleteIds] = useState<Set<number>>(new Set());

  const { data: athletes = [] } = useQuery({
    queryKey: ["athletes"],
    queryFn: () => api.getAthletes(),
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: () => api.getGroups(),
  });

  const { data: existingAssignments } = useQuery({
    queryKey: ["competition-assignments", competition?.id],
    queryFn: () => api.getCompetitionAssignments(competition!.id),
    enabled: !!competition?.id,
  });

  // Sync form fields when sheet opens or competition changes
  useEffect(() => {
    if (!open) return;
    if (competition) {
      setName(competition.name);
      setDate(competition.date);
      setEndDate(competition.end_date ?? "");
      setMultiDay(!!competition.end_date);
      setLocation(competition.location ?? "");
      setDescription(competition.description ?? "");
      // Set athlete assignments
      if (existingAssignments) {
        setAssignedAthleteIds(new Set(existingAssignments.map((a) => a.athlete_id)));
      }
    } else {
      setName("");
      setDate("");
      setEndDate("");
      setMultiDay(true);
      setLocation("");
      setDescription("");
      setAssignedAthleteIds(new Set());
    }
  }, [open, competition, existingAssignments]);

  const createMutation = useMutation({
    mutationFn: (input: CompetitionInput) => api.createCompetition(input),
    onSuccess: async (result) => {
      // Save competition assignments
      if (assignedAthleteIds.size > 0) {
        try {
          await api.setCompetitionAssignments(result.id, Array.from(assignedAthleteIds));
        } catch (e) {
          console.warn("[EAC] Failed to save competition assignments:", e);
        }
      }
      toast({ title: "Competition creee" });
      void queryClient.invalidateQueries({ queryKey: ["competitions"] });
      void queryClient.invalidateQueries({ queryKey: ["competition-assignments"] });
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
    mutationFn: (input: Partial<CompetitionInput>) =>
      api.updateCompetition(competition!.id, input),
    onSuccess: async () => {
      // Save competition assignments
      try {
        await api.setCompetitionAssignments(competition!.id, Array.from(assignedAthleteIds));
      } catch (e) {
        console.warn("[EAC] Failed to save competition assignments:", e);
      }
      toast({ title: "Competition mise a jour" });
      void queryClient.invalidateQueries({ queryKey: ["competitions"] });
      void queryClient.invalidateQueries({ queryKey: ["competition-assignments"] });
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
    mutationFn: () => api.deleteCompetition(competition!.id),
    onSuccess: () => {
      toast({ title: "Competition supprimee" });
      void queryClient.invalidateQueries({ queryKey: ["competitions"] });
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
    if (!name.trim()) {
      toast({
        title: "Nom requis",
        description: "Veuillez saisir un nom pour la competition.",
        variant: "destructive",
      });
      return;
    }
    if (!date) {
      toast({
        title: "Date requise",
        description: "Veuillez saisir une date.",
        variant: "destructive",
      });
      return;
    }

    const input: CompetitionInput = {
      name: name.trim(),
      date,
      end_date: multiDay && endDate ? endDate : null,
      location: location.trim() || null,
      description: description.trim() || null,
    };

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
              {isEdit ? "Modifier la competition" : "Nouvelle competition"}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="comp-name">Nom *</Label>
              <Input
                id="comp-name"
                placeholder="Ex : Championnats Regionaux"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="comp-date">Date *</Label>
              <input
                id="comp-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* Multi-day toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="comp-multiday">Multi-jours</Label>
              <Switch
                id="comp-multiday"
                checked={multiDay}
                onCheckedChange={setMultiDay}
              />
            </div>

            {/* End date (only if multi-day) */}
            {multiDay && (
              <div className="space-y-2">
                <Label htmlFor="comp-end-date">Date de fin</Label>
                <input
                  id="comp-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={date || undefined}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            )}

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="comp-location">Lieu</Label>
              <Input
                id="comp-location"
                placeholder="Ex : Piscine de Strasbourg"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="comp-description">Description</Label>
              <Textarea
                id="comp-description"
                placeholder="Notes, informations complementaires..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            {/* Athlete assignment */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <Label>Nageurs assignes</Label>
              </div>

              {/* Group quick-select */}
              <Select
                value=""
                onValueChange={(groupId) => {
                  const groupMembers = athletes.filter((a) => a.group_id === Number(groupId));
                  setAssignedAthleteIds((prev) => {
                    const next = new Set(prev);
                    groupMembers.forEach((m) => { if (m.id != null) next.add(m.id); });
                    return next;
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Ajouter un groupe..." />
                </SelectTrigger>
                <SelectContent>
                  {groups.filter((g) => !g.is_temporary).map((g) => (
                    <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Individual checkboxes */}
              <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-1">
                {athletes.map((athlete) => {
                  if (athlete.id == null) return null;
                  const checked = assignedAthleteIds.has(athlete.id);
                  return (
                    <label key={athlete.id} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/50 cursor-pointer">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(c) => {
                          setAssignedAthleteIds((prev) => {
                            const next = new Set(prev);
                            if (c) next.add(athlete.id!);
                            else next.delete(athlete.id!);
                            return next;
                          });
                        }}
                      />
                      <span className="text-sm">{athlete.display_name}</span>
                      {athlete.group_label && (
                        <span className="text-xs text-muted-foreground ml-auto">{athlete.group_label}</span>
                      )}
                    </label>
                  );
                })}
              </div>

              <p className="text-xs text-muted-foreground">
                {assignedAthleteIds.size} nageur{assignedAthleteIds.size > 1 ? "s" : ""} assigne{assignedAthleteIds.size > 1 ? "s" : ""}
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={isPending || !name.trim() || !date}
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
                  Supprimer cette competition
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la competition</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irreversible. La competition &laquo;{" "}
              {competition?.name} &raquo; sera supprimee definitivement.
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

// ── Competition Card ────────────────────────────────────────────

type CompetitionCardProps = {
  competition: Competition;
  onEdit: (comp: Competition) => void;
  onSendSms?: (comp: Competition, assignments: CompetitionAssignment[]) => void;
};

const CompetitionCard = ({ competition, onEdit, onSendSms }: CompetitionCardProps) => {
  const { data: assignments = [] } = useQuery({
    queryKey: ["competition-assignments", competition.id],
    queryFn: () => api.getCompetitionAssignments(competition.id),
  });

  const days = daysUntil(competition.date);
  const isPast = days < 0;
  const isUpcoming = days >= 0;

  const dateLabel = competition.end_date
    ? `du ${formatDateFr(competition.date)} au ${formatDateFr(competition.end_date)}`
    : formatDateFr(competition.date);

  return (
    <button
      type="button"
      className={`w-full text-left rounded-xl border bg-card p-3 space-y-1 transition-colors hover:bg-muted/50 ${isPast ? "opacity-60" : ""}`}
      onClick={() => onEdit(competition)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{competition.name}</p>
          <p className="text-xs text-muted-foreground">{dateLabel}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isUpcoming && (
            <Badge
              variant="outline"
              className="border-orange-300 text-orange-600 dark:text-orange-400 text-[10px] px-1.5 py-0"
            >
              J-{days}
            </Badge>
          )}
          {isPast && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              Passee
            </Badge>
          )}
        </div>
      </div>
      {competition.location && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{competition.location}</span>
        </div>
      )}
      {assignments.length > 0 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="h-3 w-3 shrink-0" />
          <span>{assignments.length} nageur{assignments.length > 1 ? "s" : ""}</span>
        </div>
      )}
      {assignments.length > 0 && onSendSms && (
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-primary hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            onSendSms(competition, assignments);
          }}
        >
          <MessageSquare className="h-3 w-3" />
          SMS
        </button>
      )}
    </button>
  );
};

// ── Main Component ──────────────────────────────────────────────

type CoachCompetitionsScreenProps = {
  onBack: () => void;
};

const CoachCompetitionsScreen = ({ onBack }: CoachCompetitionsScreenProps) => {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingComp, setEditingComp] = useState<Competition | null>(null);

  const { data: competitions = [], isLoading } = useQuery({
    queryKey: ["competitions"],
    queryFn: () => api.getCompetitions(),
  });

  const { data: athletePhones } = useQuery({
    queryKey: ["athlete-phones"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("user_id, phone")
        .not("phone", "is", null);
      return new Map((data ?? []).map((p: any) => [p.user_id as number, p.phone as string]));
    },
  });

  // Sort: upcoming first (by date ascending), then past (by date descending)
  const sorted = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    const upcoming: Competition[] = [];
    const past: Competition[] = [];

    for (const c of competitions) {
      const d = new Date(c.date + "T00:00:00").getTime();
      if (d >= todayMs) {
        upcoming.push(c);
      } else {
        past.push(c);
      }
    }

    upcoming.sort(
      (a, b) =>
        new Date(a.date + "T00:00:00").getTime() -
        new Date(b.date + "T00:00:00").getTime(),
    );
    past.sort(
      (a, b) =>
        new Date(b.date + "T00:00:00").getTime() -
        new Date(a.date + "T00:00:00").getTime(),
    );

    return [...upcoming, ...past];
  }, [competitions]);

  const handleCreate = () => {
    setEditingComp(null);
    setShowForm(true);
  };

  const handleEdit = (comp: Competition) => {
    setEditingComp(comp);
    setShowForm(true);
  };

  const handleSendSms = (comp: Competition, compAssignments: CompetitionAssignment[]) => {
    if (!athletePhones) return;
    const phones = compAssignments
      .map((a) => athletePhones.get(a.athlete_id))
      .filter((p): p is string => !!p && p.trim().length > 0);

    if (phones.length === 0) {
      toast({
        title: "Aucun numero",
        description: "Aucun nageur assigne n'a renseigne de numero de telephone.",
        variant: "destructive",
      });
      return;
    }

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      const body = encodeURIComponent(`[${comp.name}] `);
      window.location.href = `sms:${phones.join(",")}?body=${body}`;
    } else {
      // Desktop fallback: copy phones to clipboard
      navigator.clipboard.writeText(phones.join(", ")).then(() => {
        toast({
          title: "Numeros copies",
          description: `${phones.length} numero${phones.length > 1 ? "s" : ""} copie${phones.length > 1 ? "s" : ""} dans le presse-papiers. Utilisez votre telephone pour envoyer le SMS.`,
        });
      }).catch(() => {
        toast({ title: "Erreur", description: "Impossible de copier les numéros.", variant: "destructive" });
      });
    }
  };

  const description =
    competitions.length === 0
      ? "Gerez les competitions du club."
      : `${competitions.length} competition${competitions.length > 1 ? "s" : ""}`;

  return (
    <div className="space-y-6 pb-24">
      <CoachSectionHeader
        title="Competitions"
        description={description}
        onBack={onBack}
        actions={
          <Button variant="outline" size="sm" onClick={handleCreate}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Ajouter
          </Button>
        }
      />

      {isLoading ? (
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
      ) : sorted.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <Trophy className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            Aucune competition creee.
          </p>
          <Button variant="outline" size="sm" onClick={handleCreate}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Creer la premiere competition
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((comp) => (
            <CompetitionCard
              key={comp.id}
              competition={comp}
              onEdit={handleEdit}
              onSendSms={handleSendSms}
            />
          ))}
        </div>
      )}

      <CompetitionFormSheet
        open={showForm}
        onOpenChange={setShowForm}
        competition={editingComp}
      />
    </div>
  );
};

export default CoachCompetitionsScreen;
