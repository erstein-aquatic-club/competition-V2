import { useMemo, useState } from "react";
import { Bell, ChevronDown } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CoachSectionHeader from "./CoachSectionHeader";

type CoachAssignScreenProps = {
  onBack: () => void;
  swimSessions?: Array<{ id: number; name: string }>;
  strengthSessions?: Array<{ id: number; title: string }>;
  athletes: Array<{ id: number | null; display_name: string; group_label?: string | null }>;
  groups: Array<{ id: number | string; name: string }>;
};

type AssignSlot = "morning" | "evening";

type AssignState = {
  session_type: "swim" | "strength";
  session_id: string;
  assigned_date: string;
  assigned_slot: AssignSlot;
};

const CoachAssignScreen = ({
  onBack,
  swimSessions,
  strengthSessions,
  athletes,
  groups,
}: CoachAssignScreenProps) => {
  const { toast } = useToast();

  const [assignData, setAssignData] = useState<AssignState>({
    session_type: "swim",
    session_id: "",
    assigned_date: new Date().toISOString().split("T")[0],
    assigned_slot: "morning",
  });

  // Pour éviter d'envoyer une seule requête « multi-groupes » (non supportée backend),
  // on déclenche 1 requête par groupe sélectionné.
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);

  const [assignTargetType, setAssignTargetType] = useState<"user" | "group">("user");
  const [assignTargetValue, setAssignTargetValue] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);

  const toGroupId = (id: unknown): number | null => {
    const n = typeof id === "number" ? id : Number(id);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const athleteOptions = useMemo(
    () =>
      athletes.map((athlete) => ({
        value: athlete.id ? `id:${athlete.id}` : `name:${athlete.display_name}`,
        label: athlete.group_label
          ? `${athlete.display_name} · ${athlete.group_label}`
          : athlete.display_name,
        id: athlete.id,
        name: athlete.display_name,
      })),
    [athletes],
  );
  const athleteLookup = useMemo(
    () => new Map(athleteOptions.map((athlete) => [athlete.value, athlete])),
    [athleteOptions],
  );

  const groupsWithId = useMemo(
    () =>
      groups
        .map((group) => {
          const gid = toGroupId(group.id);
          return gid ? { ...group, gid } : null;
        })
        .filter((g): g is { id: number | string; name: string; gid: number } => Boolean(g)),
    [groups],
  );

  const selectedGroups = useMemo(
    () => groupsWithId.filter((group) => selectedGroupIds.includes(group.gid)),
    [groupsWithId, selectedGroupIds],
  );

  const groupsTriggerLabel = useMemo(() => {
    if (selectedGroups.length === 0) return "Choisir des groupes";
    const firstTwo = selectedGroups
      .slice(0, 2)
      .map((group) => group.name)
      .join(", ");
    const suffix = selectedGroups.length > 2 ? ` +${selectedGroups.length - 2}` : "";
    return `${firstTwo}${suffix}`;
  }, [selectedGroups]);

  const assignSession = useMutation({
    mutationFn: async (data: any) => {
      return api.assignments_create(data);
    },
    onSuccess: () => {
      toast({ title: "Séance assignée & notifiée" });
    },
    onError: (error: unknown) => {
      const fallbackMessage = "Impossible d'assigner la séance. Vérifiez les champs et réessayez.";
      const errorMessage = error instanceof Error ? error.message : typeof error === "string" ? error : fallbackMessage;
      let parsedMessage = errorMessage;
      const match = errorMessage.match(/HTTP \d+:\s*(\{.*\})/);
      if (match) {
        try {
          const payload = JSON.parse(match[1]);
          parsedMessage = payload?.error || fallbackMessage;
        } catch {
          parsedMessage = fallbackMessage;
        }
      }
      toast({ title: "Erreur d'assignation", description: parsedMessage });
    },
  });

  const handleAssign = async () => {
    const sessionId = Number(assignData.session_id);
    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      toast({
        title: "Séance invalide",
        description: "Sélectionnez une séance valide.",
      });
      return;
    }

    if (assignTargetType === "group") {
      if (selectedGroupIds.length === 0) {
        toast({ title: "Groupe manquant", description: "Sélectionnez au moins un groupe." });
        return;
      }

      // IMPORTANT: 1 requête backend par groupe (le backend ne gère pas une liste).
      setIsBulkAssigning(true);
      try {
        const basePayload = {
          assignment_type: assignData.session_type,
          session_id: sessionId,
          scheduled_date: assignData.assigned_date,
          scheduled_slot: assignData.assigned_slot,
        };

        const uniqueGroupIds = Array.from(new Set(selectedGroupIds));
        await Promise.all(
          uniqueGroupIds.map((groupId) =>
            api.assignments_create({ ...basePayload, target_group_id: groupId }),
          ),
        );

        toast({ title: "Séance assignée & notifiée" });
      } catch (error: unknown) {
        const fallbackMessage = "Impossible d'assigner la séance. Vérifiez les champs et réessayez.";
        const errorMessage =
          error instanceof Error ? error.message : typeof error === "string" ? error : fallbackMessage;
        let parsedMessage = errorMessage;
        const match = errorMessage.match(/HTTP \d+:\s*(\{.*\})/);
        if (match) {
          try {
            const payload = JSON.parse(match[1]);
            parsedMessage = payload?.error || fallbackMessage;
          } catch {
            parsedMessage = fallbackMessage;
          }
        }
        toast({ title: "Erreur d'assignation", description: parsedMessage });
      } finally {
        setIsBulkAssigning(false);
      }
      return;
    }

    const trimmedTarget = assignTargetValue.trim();
    if (!trimmedTarget) {
      toast({ title: "Nageur manquant", description: "Sélectionnez un nageur." });
      return;
    }

    const athlete = athleteLookup.get(trimmedTarget);
    const targetUserId =
      athlete?.id ??
      (Number.isFinite(Number(trimmedTarget)) && Number(trimmedTarget) > 0 ? Number(trimmedTarget) : undefined);

    if (!Number.isFinite(targetUserId) || Number(targetUserId) <= 0) {
      toast({
        title: "Nageur invalide",
        description: "Sélectionnez un nageur avec un identifiant valide.",
      });
      return;
    }

    const targetAthlete = athlete?.name ?? trimmedTarget.replace(/^name:/, "");

    assignSession.mutate({
      assignment_type: assignData.session_type,
      session_id: sessionId,
      target_athlete: targetAthlete,
      target_user_id: targetUserId,
      scheduled_date: assignData.assigned_date,
      scheduled_slot: assignData.assigned_slot,
    });
  };

  const isAssignDisabled =
    !assignData.session_id ||
    (assignTargetType === "group" ? selectedGroupIds.length === 0 : !assignTargetValue.trim()) ||
    assignSession.isPending ||
    isBulkAssigning;

  return (
    <div className="space-y-6 pb-24">
      <CoachSectionHeader
        title="Assigner une séance"
        description="Planifiez une séance pour un nageur ou un ou plusieurs groupes."
        onBack={onBack}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader>
            <CardTitle>Séance</CardTitle>
            <CardDescription>Choisissez le type et la séance à envoyer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={assignData.session_type}
                onValueChange={(value) => setAssignData({ ...assignData, session_type: value as AssignState["session_type"], session_id: "" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="swim">Natation</SelectItem>
                  <SelectItem value="strength">Musculation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Séance</Label>
              <Select
                value={assignData.session_id}
                onValueChange={(value) => setAssignData({ ...assignData, session_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir..." />
                </SelectTrigger>
                <SelectContent>
                  {assignData.session_type === "swim"
                    ? swimSessions?.map((session) => (
                        <SelectItem key={session.id} value={session.id.toString()}>
                          {session.name}
                        </SelectItem>
                      ))
                    : strengthSessions?.map((session) => (
                        <SelectItem key={session.id} value={session.id.toString()}>
                          {session.title}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cible & planification</CardTitle>
            <CardDescription>Définissez le destinataire, la date et le créneau.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Cible</Label>
              <Select
                value={assignTargetType}
                onValueChange={(value: "user" | "group") => {
                  setAssignTargetType(value);
                  setAssignTargetValue("");
                  setSelectedGroupIds([]);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Nageur</SelectItem>
                  <SelectItem value="group">Groupe(s)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {assignTargetType === "user" ? (
              <div className="space-y-2">
                <Label>Nageur</Label>
                {athleteOptions.length > 0 ? (
                  <Select value={assignTargetValue} onValueChange={setAssignTargetValue}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir un nageur" />
                    </SelectTrigger>
                    <SelectContent>
                      {athleteOptions.map((athlete) => (
                        <SelectItem key={athlete.value} value={athlete.value}>
                          {athlete.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={assignTargetValue}
                    onChange={(event) => setAssignTargetValue(event.target.value)}
                    placeholder="ex: Camille"
                  />
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Groupes</Label>
                {groups.length > 0 ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-between"
                        aria-label="Sélection des groupes"
                      >
                        <span className="truncate">{groupsTriggerLabel}</span>
                        <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-2" align="start">
                      <div className="max-h-64 overflow-auto">
                        <div className="space-y-1">
                          {groupsWithId.map((group) => {
                            const isChecked = selectedGroupIds.includes(group.gid);
                            return (
                              <label
                                key={group.gid}
                                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
                              >
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={(checked) => {
                                    const isNowChecked = checked === true;
                                    setSelectedGroupIds((prev) => {
                                      if (isNowChecked) return prev.includes(group.gid) ? prev : [...prev, group.gid];
                                      return prev.filter((id) => id !== group.gid);
                                    });
                                  }}
                                />
                                <span className="text-sm">{group.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                      {selectedGroupIds.length > 0 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-2 w-full"
                          onClick={() => setSelectedGroupIds([])}
                        >
                          Tout désélectionner
                        </Button>
                      ) : null}
                    </PopoverContent>
                  </Popover>
                ) : (
                  <div className="text-xs text-muted-foreground">Aucun groupe disponible.</div>
                )}
                {selectedGroupIds.length > 0 ? (
                  <div className="text-xs text-muted-foreground">
                    {selectedGroupIds.length} groupe{selectedGroupIds.length > 1 ? "s" : ""} sélectionné
                    {selectedGroupIds.length > 1 ? "s" : ""}.
                  </div>
                ) : null}
              </div>
            )}

            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={assignData.assigned_date}
                onChange={(event) => setAssignData({ ...assignData, assigned_date: event.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Créneau</Label>
              <Select
                value={assignData.assigned_slot}
                onValueChange={(value) => setAssignData({ ...assignData, assigned_slot: value as AssignSlot })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">Matin</SelectItem>
                  <SelectItem value="evening">Soir</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background/95 p-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:p-0">
        <Button className="w-full sm:w-auto" onClick={handleAssign} disabled={isAssignDisabled}>
          <Bell className="mr-2 h-4 w-4" />
          {assignSession.isPending || isBulkAssigning ? "Assignation..." : "Assigner & notifier"}
        </Button>
      </div>
    </div>
  );
};

export default CoachAssignScreen;
