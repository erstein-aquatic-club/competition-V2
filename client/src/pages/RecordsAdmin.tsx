import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
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

const SEX_OPTIONS = [
  { value: "M", label: "Garçon" },
  { value: "F", label: "Fille" },
];

const formatSource = (source: ClubRecordSwimmer["source_type"]) =>
  source === "user" ? "Compte" : "Ancien";

export default function RecordsAdmin() {
  const role = useAuth((state) => state.role);
  const { toast } = useToast();
  const [newSwimmer, setNewSwimmer] = useState({
    display_name: "",
    iuf: "",
    sex: "",
    birthdate: "",
  });
  const [swimmers, setSwimmers] = useState<ClubRecordSwimmer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAccess = role === "coach" || role === "admin";

  const load = useCallback(async () => {
    if (!canAccess) return;
    setIsLoading(true);
    setError(null);
    try {
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

  const createSwimmer = useMutation({
    mutationFn: () =>
      api.createClubRecordSwimmer({
        display_name: newSwimmer.display_name.trim(),
        iuf: newSwimmer.iuf.trim() || null,
        sex: newSwimmer.sex ? (newSwimmer.sex as "M" | "F") : null,
        birthdate: newSwimmer.birthdate || null,
        is_active: true,
      }),
    onSuccess: () => {
      toast({ title: "Nageur ajouté" });
      setNewSwimmer({ display_name: "", iuf: "", sex: "", birthdate: "" });
      void load();
    },
    onError: () => {
      toast({ title: "Impossible d'ajouter le nageur", variant: "destructive" });
    },
  });

  const updateSwimmer = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, any> }) =>
      api.updateClubRecordSwimmer(id, payload),
    onSuccess: () => {
      void load();
    },
    onError: () => {
      toast({ title: "Mise à jour impossible", variant: "destructive" });
    },
  });

  const updateUserSwimmer = useMutation({
    mutationFn: ({ userId, payload }: { userId: number; payload: Record<string, any> }) =>
      api.updateClubRecordSwimmerForUser(userId, payload),
    onSuccess: () => {
      void load();
    },
    onError: () => {
      toast({ title: "Mise à jour impossible", variant: "destructive" });
    },
  });

  const updateSwimmerEntry = (swimmer: ClubRecordSwimmer, payload: Record<string, any>) => {
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
          ? `Performances importées: ${summary.imported ?? 0}. Erreurs: ${summary.errors?.length ?? 0}.`
          : "",
      });
      void load();
    },
    onError: () => {
      toast({ title: "Import impossible", variant: "destructive" });
    },
  });

  const sortedSwimmers = useMemo(() => {
    return [...swimmers].sort((a, b) => {
      if (a.source_type !== b.source_type) return a.source_type.localeCompare(b.source_type);
      return a.display_name.localeCompare(b.display_name);
    });
  }, [swimmers]);

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
        <Button onClick={() => importRecords.mutate()} disabled={importRecords.isPending}>
          {importRecords.isPending ? "Import en cours..." : "Mettre à jour les records"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ajouter un ancien nageur</CardTitle>
          <CardDescription>Ajoutez un nageur sans compte pour l'import des performances FFN.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
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
          <Input
            type="date"
            value={newSwimmer.birthdate}
            onChange={(event) => setNewSwimmer((prev) => ({ ...prev, birthdate: event.target.value }))}
          />
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
          {isLoading && <p className="text-sm text-muted-foreground">Chargement...</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!isLoading && !error && swimmers.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun nageur disponible.</p>
          )}
          {!isLoading && !error && swimmers.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nageur</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>IUF</TableHead>
                  <TableHead>Sexe</TableHead>
                  <TableHead>Naissance</TableHead>
                  <TableHead>Actif</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSwimmers.map((swimmer) => {
                  const rowKey = swimmer.id ?? `user-${swimmer.user_id ?? "unknown"}`;
                  return (
                  <TableRow key={rowKey}>
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
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={swimmer.sex ?? ""}
                        onValueChange={(value) =>
                          updateSwimmerEntry(swimmer, { sex: value || null })
                        }
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
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        key={`${rowKey}-${swimmer.birthdate ?? ""}`}
                        defaultValue={swimmer.birthdate ?? ""}
                        onBlur={(event) =>
                          updateSwimmerEntry(swimmer, { birthdate: event.target.value || null })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={Boolean(swimmer.is_active)}
                        onCheckedChange={(checked) =>
                          updateSwimmerEntry(swimmer, { is_active: checked })
                        }
                      />
                    </TableCell>
                  </TableRow>
                );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
