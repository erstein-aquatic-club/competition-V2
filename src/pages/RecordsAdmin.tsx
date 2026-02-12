import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, summarizeApiError, type ClubRecordSwimmer } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Eye, RefreshCw, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const SEX_OPTIONS = [
  { value: "M", label: "Garçon" },
  { value: "F", label: "Fille" },
];

const formatSource = (source: ClubRecordSwimmer["source_type"]) =>
  source === "user" ? "Compte" : "Ancien";

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR") + " " + date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
};

const formatDateOnly = (value?: string | null) => {
  if (!value) return "Jamais";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR");
};

const isStale = (value?: string | null, daysThreshold = 30) => {
  if (!value) return true;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return true;
  const diffMs = Date.now() - date.getTime();
  return diffMs > daysThreshold * 24 * 60 * 60 * 1000;
};

const statusBadgeVariant = (status: string) => {
  switch (status) {
    case "success":
      return "default" as const;
    case "running":
      return "secondary" as const;
    case "error":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
};

const statusLabel = (status: string) => {
  switch (status) {
    case "success":
      return "OK";
    case "running":
      return "En cours";
    case "error":
      return "Erreur";
    case "pending":
      return "En attente";
    default:
      return status;
  }
};

export default function RecordsAdmin() {
  const role = useAuth((state) => state.role);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newSwimmer, setNewSwimmer] = useState({
    display_name: "",
    iuf: "",
    sex: "",
  });
  const [swimmers, setSwimmers] = useState<ClubRecordSwimmer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [rateLimits, setRateLimits] = useState<{ coach_monthly: number; athlete_monthly: number; admin_monthly: number } | null>(null);

  const canAccess = role === "coach" || role === "admin";
  const isAdmin = role === "admin";

  // Import logs query
  const { data: importLogs = [], refetch: refetchLogs } = useQuery({
    queryKey: ["import-logs"],
    queryFn: () => api.getImportLogs({ limit: 20 }),
    enabled: canAccess,
  });

  const load = useCallback(async () => {
    if (!canAccess) return;
    setIsLoading(true);
    setError(null);
    try {
      // Auto-sync users first
      await api.syncClubRecordSwimmersFromUsers();
      const data = await api.getClubRecordSwimmers();
      setSwimmers(data);
    } catch (err) {
      const summary = summarizeApiError(err, "Impossible de charger la liste.");
      setError(summary.message);
      setSwimmers([]);
    } finally {
      setIsLoading(false);
    }
  }, [canAccess]);

  useEffect(() => {
    void load();
  }, [load]);

  // Load rate limit settings
  useEffect(() => {
    if (!isAdmin) return;
    void api.getAppSettings("import_rate_limits").then((value) => {
      if (value) setRateLimits(value);
    });
  }, [isAdmin]);

  const createSwimmer = useMutation({
    mutationFn: () =>
      api.createClubRecordSwimmer({
        display_name: newSwimmer.display_name.trim(),
        iuf: newSwimmer.iuf.trim() || null,
        sex: newSwimmer.sex ? (newSwimmer.sex as "M" | "F") : null,
        is_active: true,
      }),
    onSuccess: () => {
      toast({ title: "Nageur ajouté" });
      setNewSwimmer({ display_name: "", iuf: "", sex: "" });
      void load();
    },
    onError: () => {
      toast({ title: "Impossible d'ajouter le nageur", variant: "destructive" });
    },
  });

  const updateSwimmer = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) =>
      api.updateClubRecordSwimmer(id, payload),
    onSuccess: () => {
      void load();
      toast({ title: "Sauvegardé" });
    },
    onError: () => {
      toast({ title: "Mise à jour impossible", variant: "destructive" });
    },
  });

  const updateUserSwimmer = useMutation({
    mutationFn: ({ userId, payload }: { userId: number; payload: Record<string, unknown> }) =>
      api.updateClubRecordSwimmerForUser(userId, payload),
    onSuccess: () => {
      void load();
      toast({ title: "Sauvegardé" });
    },
    onError: () => {
      toast({ title: "Mise à jour impossible", variant: "destructive" });
    },
  });

  const updateSwimmerEntry = (swimmer: ClubRecordSwimmer, payload: Record<string, unknown>) => {
    if (swimmer.source_type === "user" && swimmer.user_id) {
      updateUserSwimmer.mutate({ userId: swimmer.user_id, payload });
      return;
    }
    if (swimmer.id) {
      updateSwimmer.mutate({ id: swimmer.id, payload });
    }
  };

  const importRecords = useMutation({
    mutationFn: () => api.importClubRecords(),
    onSuccess: (summary) => {
      toast({
        title: "Import terminé",
        description: summary
          ? `Performances importées: ${summary.imported ?? 0}. Erreurs: ${summary.errors ?? 0}.`
          : "",
      });
      void load();
      void refetchLogs();
      void queryClient.invalidateQueries({ queryKey: ["club-records"] });
    },
    onError: (err: any) => {
      const msg = err?.message?.includes("Rate limit") || err?.message?.includes("Limite")
        ? err.message
        : "Import impossible";
      toast({ title: msg, variant: "destructive" });
      void refetchLogs();
    },
  });

  // Per-swimmer import mutation
  const importSingle = useMutation({
    mutationFn: ({ iuf, name }: { iuf: string; name?: string }) =>
      api.importSingleSwimmer(iuf, name),
    onSuccess: (result, variables) => {
      toast({
        title: `Import de ${variables.name ?? variables.iuf}`,
        description: `${result.total_found} performances trouvées, ${result.new_imported} nouvelles importées.`,
      });
      void refetchLogs();
      // Trigger club records recalculation after individual import
      void api.recalculateClubRecords().then(() => {
        void queryClient.invalidateQueries({ queryKey: ["club-records"] });
      });
      void load();
    },
    onError: (_err: any, variables) => {
      const msg = _err?.message?.includes("Rate limit") || _err?.message?.includes("Limite")
        ? _err.message
        : `Erreur import ${variables.name ?? variables.iuf}`;
      toast({ title: msg, variant: "destructive" });
      void refetchLogs();
    },
  });

  const saveRateLimits = useMutation({
    mutationFn: (limits: { coach_monthly: number; athlete_monthly: number; admin_monthly: number }) =>
      api.updateAppSettings("import_rate_limits", limits),
    onSuccess: () => {
      toast({ title: "Limites sauvegardées" });
    },
    onError: () => {
      toast({ title: "Erreur de sauvegarde", variant: "destructive" });
    },
  });

  const sortedSwimmers = useMemo(() => {
    return [...swimmers].sort((a, b) => {
      if (a.source_type !== b.source_type) return a.source_type.localeCompare(b.source_type);
      return a.display_name.localeCompare(b.display_name);
    });
  }, [swimmers]);

  const incompleteCount = useMemo(
    () => swimmers.filter((s) => s.is_active && (!s.iuf || !s.sex)).length,
    [swimmers],
  );

  const recalculate = useMutation({
    mutationFn: () => api.recalculateClubRecords(),
    onSuccess: () => {
      toast({ title: "Records recalculés" });
      void queryClient.invalidateQueries({ queryKey: ["club-records"] });
    },
    onError: () => {
      toast({ title: "Erreur de recalcul", variant: "destructive" });
    },
  });

  if (!canAccess) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-display font-bold uppercase italic text-primary">Administration des records</h1>
        <p className="text-sm text-muted-foreground">Accès réservé aux coachs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold uppercase italic text-primary">Administration des records</h1>
          <p className="text-sm text-muted-foreground">
            Gérez les nageurs pris en compte pour les records et lancez l'import FFN.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { window.location.hash = "#/records-club"; }}
          >
            <Eye className="h-4 w-4 mr-1" />
            Voir les records
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => recalculate.mutate()}
            disabled={recalculate.isPending}
          >
            <RefreshCw className={cn("h-4 w-4 mr-1", recalculate.isPending && "animate-spin")} />
            Recalculer
          </Button>
          <Button onClick={() => importRecords.mutate()} disabled={importRecords.isPending}>
            {importRecords.isPending ? "Import en cours..." : "Mettre à jour les records"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ajouter un ancien nageur</CardTitle>
          <CardDescription>Ajoutez un nageur sans compte pour l'import des performances FFN.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[2fr_1fr_1fr_auto]">
          <Input
            placeholder="Nom du nageur"
            value={newSwimmer.display_name}
            onChange={(event) => setNewSwimmer((prev) => ({ ...prev, display_name: event.target.value }))}
          />
          <Input
            placeholder="IUF"
            value={newSwimmer.iuf}
            onChange={(event) => setNewSwimmer((prev) => ({ ...prev, iuf: event.target.value }))}
          />
          <Select
            value={newSwimmer.sex}
            onValueChange={(value) => setNewSwimmer((prev) => ({ ...prev, sex: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sexe" />
            </SelectTrigger>
            <SelectContent>
              {SEX_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => createSwimmer.mutate()}
            disabled={!newSwimmer.display_name.trim() || createSwimmer.isPending}
          >
            Ajouter
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Liste des nageurs suivis</CardTitle>
          <CardDescription>Mettre à jour l'IUF, le sexe ou l'activation pour l'import FFN.</CardDescription>
        </CardHeader>
        <CardContent>
          {!isLoading && incompleteCount > 0 && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
              <strong>{incompleteCount} nageur{incompleteCount > 1 ? "s" : ""} incomplet{incompleteCount > 1 ? "s" : ""}</strong>{" "}
              — les champs IUF et Sexe sont requis pour le calcul des records.
            </div>
          )}
          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-4 w-32 rounded bg-muted animate-pulse motion-reduce:animate-none" />
                  <div className="h-4 w-20 rounded bg-muted animate-pulse motion-reduce:animate-none" />
                  <div className="h-4 w-16 rounded bg-muted animate-pulse motion-reduce:animate-none" />
                  <div className="h-4 w-24 rounded bg-muted animate-pulse motion-reduce:animate-none" />
                </div>
              ))}
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!isLoading && !error && swimmers.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun nageur disponible.</p>
          )}
          {!isLoading && !error && swimmers.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nageur</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>IUF</TableHead>
                    <TableHead>Sexe</TableHead>
                    <TableHead>Dernière maj</TableHead>
                    <TableHead>Actif</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedSwimmers.map((swimmer) => {
                    const rowKey = swimmer.id ?? `user-${swimmer.user_id ?? "unknown"}`;
                    const stale = isStale((swimmer as any).last_imported_at);
                    return (
                    <TableRow key={rowKey} className={stale ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}>
                      <TableCell className="font-medium">{swimmer.display_name}</TableCell>
                      <TableCell>
                        <Badge variant={swimmer.source_type === "manual" ? "secondary" : "outline"}>
                          {formatSource(swimmer.source_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Input
                          key={`${rowKey}-${swimmer.iuf ?? ""}`}
                          defaultValue={swimmer.iuf ?? ""}
                          onBlur={(event) =>
                            updateSwimmerEntry(swimmer, { iuf: event.target.value.trim() || null })
                          }
                          className={cn("w-24", swimmer.is_active && !swimmer.iuf && "ring-2 ring-destructive/50")}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={swimmer.sex ?? ""}
                          onValueChange={(value) =>
                            updateSwimmerEntry(swimmer, { sex: value || null })
                          }
                        >
                          <SelectTrigger className={cn("w-28", swimmer.is_active && !swimmer.sex && "ring-2 ring-destructive/50")}>
                            <SelectValue placeholder="Sexe" />
                          </SelectTrigger>
                          <SelectContent>
                            {SEX_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <span className={stale ? "text-amber-600 dark:text-amber-400 text-xs font-medium" : "text-xs text-muted-foreground"}>
                          {formatDateOnly((swimmer as any).last_imported_at)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={Boolean(swimmer.is_active)}
                          onCheckedChange={(checked) =>
                            updateSwimmerEntry(swimmer, { is_active: checked })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        {swimmer.iuf ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={importSingle.isPending}
                            onClick={() =>
                              importSingle.mutate({
                                iuf: swimmer.iuf!,
                                name: swimmer.display_name,
                              })
                            }
                          >
                            Importer
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Pas d'IUF</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique des imports</CardTitle>
          <CardDescription>Les 20 derniers imports de performances FFN.</CardDescription>
        </CardHeader>
        <CardContent>
          {importLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun import effectué.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nageur</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Trouvées</TableHead>
                  <TableHead>Importées</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Erreur</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importLogs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">
                      {log.swimmer_name ?? log.swimmer_iuf}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(log.status)}>
                        {statusLabel(log.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{log.performances_found ?? "-"}</TableCell>
                    <TableCell>{log.performances_imported ?? "-"}</TableCell>
                    <TableCell className="text-xs">
                      {formatDateTime(log.started_at)}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-destructive">
                      {log.error_message ?? ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Paramètres d'import</CardTitle>
              <CardDescription>Limites mensuelles d'import par rôle.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowSettings(!showSettings)}>
              <Settings className="h-4 w-4" />
            </Button>
          </CardHeader>
          {showSettings && rateLimits && (
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-xs text-muted-foreground">Coach (par mois)</label>
                  <Input
                    type="number"
                    value={rateLimits.coach_monthly}
                    onChange={(e) => setRateLimits({ ...rateLimits, coach_monthly: Number(e.target.value) })}
                    min={-1}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Nageur (par mois)</label>
                  <Input
                    type="number"
                    value={rateLimits.athlete_monthly}
                    onChange={(e) => setRateLimits({ ...rateLimits, athlete_monthly: Number(e.target.value) })}
                    min={-1}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Admin (par mois, -1=illimité)</label>
                  <Input
                    type="number"
                    value={rateLimits.admin_monthly}
                    onChange={(e) => setRateLimits({ ...rateLimits, admin_monthly: Number(e.target.value) })}
                    min={-1}
                  />
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => saveRateLimits.mutate(rateLimits)}
                disabled={saveRateLimits.isPending}
              >
                Enregistrer
              </Button>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
