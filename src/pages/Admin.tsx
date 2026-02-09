import * as React from "react";
import { Redirect } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, UserMinus, UserPlus, Search, CheckCircle, XCircle, Clock } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api, summarizeApiError, type UserSummary } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const userRoleOptions = ["athlete", "coach", "comite", "admin"] as const;
type UserRole = (typeof userRoleOptions)[number];

const isActiveUser = (isActive: boolean | number | null | undefined) => !(isActive === false || isActive === 0);

export const updateUserRoleInList = (users: UserSummary[], userId: number, role: UserRole) =>
  users.map((user) => (user.id === userId ? { ...user, role } : user));

const parseErrorMessage = (error: unknown, fallbackMessage: string) =>
  summarizeApiError(error, fallbackMessage).message;

export default function Admin() {
  const { useMemo, useState } = React;
  const role = typeof window === "undefined" ? useAuth.getState().role : useAuth((state) => state.role);
  const userId = useAuth((state) => state.userId);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchValue, setSearchValue] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const [createCoachName, setCreateCoachName] = useState("");
  const [createCoachEmail, setCreateCoachEmail] = useState("");
  const [createCoachPassword, setCreateCoachPassword] = useState("");
  const [createdCoachPassword, setCreatedCoachPassword] = useState<string | null>(null);

  const isAdmin = role === "admin";

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users", includeInactive],
    queryFn: () => api.listUsers({ includeInactive }),
    enabled: isAdmin,
  });

  const createCoach = useMutation({
    mutationFn: (payload: { display_name: string; email?: string; password?: string }) => api.createCoach(payload),
    onMutate: () => {
      setCreatedCoachPassword(null);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setCreateCoachName("");
      setCreateCoachEmail("");
      setCreateCoachPassword("");
      setCreatedCoachPassword(data.initialPassword ?? null);
      toast({ title: "Coach créé" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Erreur création coach",
        description: parseErrorMessage(error, "Impossible de créer le coach."),
      });
    },
  });

  const updateUserRole = useMutation({
    mutationFn: (payload: { userId: number; role: UserRole }) => api.updateUserRole(payload),
    onSuccess: (_data, variables) => {
      queryClient.setQueryData<UserSummary[]>(["admin-users", includeInactive], (current) =>
        current ? updateUserRoleInList(current, variables.userId, variables.role) : current,
      );
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "Rôle mis à jour" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Erreur mise à jour rôle",
        description: parseErrorMessage(error, "Impossible de mettre à jour le rôle."),
      });
    },
  });

  const disableUser = useMutation({
    mutationFn: (payload: { userId: number }) => api.disableUser(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "Compte désactivé" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Erreur désactivation",
        description: parseErrorMessage(error, "Impossible de désactiver le compte."),
      });
    },
  });

  const { data: pendingApprovals = [] } = useQuery({
    queryKey: ["pending-approvals"],
    queryFn: () => api.getPendingApprovals(),
    enabled: isAdmin,
  });

  const approveUser = useMutation({
    mutationFn: (userId: number) => api.approveUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "Inscription validée" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Erreur validation",
        description: parseErrorMessage(error, "Impossible de valider l'inscription."),
      });
    },
  });

  const rejectUser = useMutation({
    mutationFn: (userId: number) => api.rejectUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "Inscription rejetée" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Erreur rejet",
        description: parseErrorMessage(error, "Impossible de rejeter l'inscription."),
      });
    },
  });

  const existingAdminId = useMemo(() => {
    const existingAdmin = users.find((user) => user.role === "admin");
    return existingAdmin?.id ?? null;
  }, [users]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter !== "all" && user.role !== roleFilter) {
        return false;
      }
      const displayName = user.display_name?.toLowerCase() ?? "";
      const email = user.email?.toLowerCase() ?? "";
      if (normalizedSearch && !displayName.includes(normalizedSearch) && !email.includes(normalizedSearch)) {
        return false;
      }
      return true;
    });
  }, [users, roleFilter, searchValue]);

  const selectedUser = useMemo(() => {
    if (!selectedUserId) return null;
    return users.find((user) => user.id === selectedUserId) ?? null;
  }, [selectedUserId, users]);

  if (!isAdmin) {
    if (typeof window === "undefined") {
      return null;
    }
    return <Redirect to="/" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display font-bold uppercase italic text-primary">Administration</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span>Accès admin</span>
        </div>
      </div>

      {pendingApprovals.length > 0 ? (
        <Card className="border-status-warning/30 bg-status-warning-bg dark:border-status-warning/30 dark:bg-status-warning-bg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-status-warning" />
              Inscriptions en attente
              <Badge variant="secondary" className="ml-2">{pendingApprovals.length}</Badge>
            </CardTitle>
            <CardDescription>
              Ces utilisateurs ont créé un compte et attendent votre validation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingApprovals.map((pending) => (
                <div
                  key={pending.user_id}
                  className="flex flex-col gap-3 rounded-lg border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{pending.display_name}</p>
                    <p className="text-sm text-muted-foreground">{pending.email || "Pas d'email"}</p>
                    <p className="text-xs text-muted-foreground">
                      Inscrit le {new Date(pending.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="bg-status-success hover:opacity-90 text-white"
                      onClick={() => approveUser.mutate(pending.user_id)}
                      disabled={approveUser.isPending || rejectUser.isPending}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Approuver
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        const confirmed = window.confirm(
                          `Rejeter l'inscription de "${pending.display_name}" ? Le compte sera désactivé.`,
                        );
                        if (!confirmed) return;
                        rejectUser.mutate(pending.user_id);
                      }}
                      disabled={approveUser.isPending || rejectUser.isPending}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Rejeter
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Créer un coach</CardTitle>
          <CardDescription>
            Laissez le mot de passe vide pour en générer un automatiquement (affiché une seule fois).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const trimmedName = createCoachName.trim();
              if (!trimmedName) return;
              createCoach.mutate({
                display_name: trimmedName,
                email: createCoachEmail.trim() || undefined,
                password: createCoachPassword || undefined,
              });
            }}
          >
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="coach-create-name">Nom affiché</Label>
                <Input
                  id="coach-create-name"
                  value={createCoachName}
                  onChange={(event) => setCreateCoachName(event.target.value)}
                  placeholder="Ex: Coach Martin"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coach-create-email">Email</Label>
                <Input
                  id="coach-create-email"
                  type="email"
                  value={createCoachEmail}
                  onChange={(event) => setCreateCoachEmail(event.target.value)}
                  placeholder="coach@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coach-create-password">Mot de passe (optionnel)</Label>
                <Input
                  id="coach-create-password"
                  type="text"
                  value={createCoachPassword}
                  onChange={(event) => setCreateCoachPassword(event.target.value)}
                  placeholder="Laisser vide pour auto"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={!createCoachName.trim() || createCoach.isPending}>
                {createCoach.isPending ? "Création..." : "Créer le coach"}
              </Button>
              {createdCoachPassword ? (
                <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-2 text-sm">
                  <p className="font-medium text-primary">Mot de passe initial (à copier)</p>
                  <p className="font-mono">{createdCoachPassword}</p>
                </div>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
        <CardTitle>Gestion des comptes</CardTitle>
        <CardDescription>Mettre à jour les rôles, filtrer et désactiver les comptes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="admin-search">Recherche</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="admin-search"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Nom ou email"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Rôle</Label>
              <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as "all" | UserRole)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="athlete">Athlète</SelectItem>
                  <SelectItem value="coach">Entraineur EAC</SelectItem>
                  <SelectItem value="comite">Comité</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={includeInactive} onCheckedChange={setIncludeInactive} id="inactive-toggle" />
              <Label htmlFor="inactive-toggle" className="text-sm">
                Inclure désactivés
              </Label>
            </div>
          </div>

          {usersLoading ? (
            <p className="text-sm text-muted-foreground">Chargement des utilisateurs...</p>
          ) : filteredUsers.length ? (
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => {
                    const active = isActiveUser(user.is_active);
                    const isSelf = userId === user.id;
                    const disableAdminOption = existingAdminId !== null && existingAdminId !== user.id;
                    return (
                      <TableRow key={user.id} data-selected={selectedUserId === user.id}>
                        <TableCell className="font-medium">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="px-2"
                            onClick={() => setSelectedUserId(user.id)}
                          >
                            {user.display_name}
                          </Button>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{user.email || "-"}</TableCell>
                        <TableCell>
                          <Select
                            value={user.role}
                            onValueChange={(value) => {
                              if (!userRoleOptions.includes(value as UserRole)) return;
                              if (!user.id) return;
                              if (value === user.role) return;
                              updateUserRole.mutate({ userId: user.id, role: value as UserRole });
                            }}
                            disabled={!active || updateUserRole.isPending}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="athlete">Athlète</SelectItem>
                              <SelectItem value="coach">Entraineur EAC</SelectItem>
                              <SelectItem value="comite">Comité</SelectItem>
                              <SelectItem value="admin" disabled={disableAdminOption}>
                                Admin
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {active ? <Badge variant="secondary">Actif</Badge> : <Badge variant="outline">Désactivé</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              if (!user.id) return;
                              if (isSelf) {
                                toast({
                                  title: "Action impossible",
                                  description: "Vous ne pouvez pas désactiver votre propre compte.",
                                });
                                return;
                              }
                              const confirmed = window.confirm(
                                `Confirmer la désactivation du compte "${user.display_name}" ?`,
                              );
                              if (!confirmed) return;
                              disableUser.mutate({ userId: user.id });
                            }}
                            disabled={!active || disableUser.isPending || isSelf}
                          >
                            <UserMinus className="mr-2 h-4 w-4" />
                            Désactiver
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserPlus className="h-4 w-4" />
              Aucun utilisateur ne correspond à votre recherche.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fiche utilisateur</CardTitle>
          <CardDescription>Sélectionnez un compte pour afficher les détails.</CardDescription>
        </CardHeader>
        <CardContent>
          {selectedUser ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Nom affiché</p>
                <p className="text-lg font-semibold">{selectedUser.display_name}</p>
                <p className="text-sm text-muted-foreground">Email</p>
                <p>{selectedUser.email || "-"}</p>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Rôle</p>
                  <Select
                    value={selectedUser.role}
                    onValueChange={(value) => {
                      if (!userRoleOptions.includes(value as UserRole)) return;
                      if (!selectedUser.id) return;
                      if (value === selectedUser.role) return;
                      updateUserRole.mutate({ userId: selectedUser.id, role: value as UserRole });
                    }}
                    disabled={!isActiveUser(selectedUser.is_active) || updateUserRole.isPending}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="athlete">Athlète</SelectItem>
                      <SelectItem value="coach">Entraineur EAC</SelectItem>
                      <SelectItem value="comite">Comité</SelectItem>
                      <SelectItem value="admin" disabled={existingAdminId !== null && existingAdminId !== selectedUser.id}>
                        Admin
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Statut</p>
                  {isActiveUser(selectedUser.is_active) ? (
                    <Badge variant="secondary">Actif</Badge>
                  ) : (
                    <Badge variant="outline">Désactivé</Badge>
                  )}
                </div>
                {selectedUser.group_label ? (
                  <div>
                    <p className="text-sm text-muted-foreground">Groupe</p>
                    <p>{selectedUser.group_label}</p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun utilisateur sélectionné.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
