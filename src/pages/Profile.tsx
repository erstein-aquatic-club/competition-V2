import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Edit2, LogOut, RefreshCw, Save } from "lucide-react";

export const shouldShowRecords = (role: string | null) => role !== "coach" && role !== "admin" && role !== "comite";

export const getRoleLabel = (role: string | null) => {
  switch (role) {
    case "coach":
      return "Entraineur EAC";
    case "admin":
      return "Admin";
    case "comite":
      return "Comité";
    default:
      return "Nageur";
  }
};

function formatBirthdate(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("fr-FR");
}

export default function Profile() {
  const { user, userId, logout, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const showRecords = shouldShowRecords(role);
  const canUpdatePassword = role === "athlete" || role === "coach" || role === "admin";
  const roleLabel = getRoleLabel(role);

  const [isEditing, setIsEditing] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [editForm, setEditForm] = useState({
    group_id: "",
    objectives: "",
    bio: "",
    avatar_url: "",
    birthdate: "",
    ffn_iuf: "",
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user, userId],
    queryFn: () => api.getProfile({ displayName: user, userId }),
    enabled: !!user,
  });

  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ["profile-groups"],
    queryFn: () => api.getGroups(),
    enabled: !!user,
  });

  const avatarSrc = useMemo(() => {
    const src = (profile as any)?.avatar_url;
    if (src) return src;
    if (user) return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user)}`;
    return "";
  }, [profile, user]);

  const updateProfile = useMutation({
    mutationFn: (data: typeof editForm) =>
      api.updateProfile({
        userId,
        // api.updateProfile est typé sans ffn_iuf : on cast pour garder le change minimal côté front
        profile: {
          group_id: data.group_id ? Number(data.group_id) : null,
          birthdate: data.birthdate || null,
          objectives: data.objectives,
          bio: data.bio,
          avatar_url: data.avatar_url,
          ffn_iuf: (data.ffn_iuf || "").trim() || null,
        } as any,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setIsEditing(false);
      toast({ title: "Profil mis à jour" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Mise à jour impossible",
        description: String((error as any)?.message || error),
        variant: "destructive",
      });
    },
  });

  const updatePassword = useMutation({
    mutationFn: (payload: { password: string }) => api.authPasswordUpdate(payload),
    onSuccess: () => {
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Mot de passe mis à jour" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Mise à jour impossible",
        description: String((error as any)?.message || error),
        variant: "destructive",
      });
    },
  });

  const syncFfn = useMutation({
    mutationFn: async () => {
      const iuf = String((profile as any)?.ffn_iuf ?? "").trim();
      if (!iuf) throw new Error("IUF FFN manquant. Ajoutez-le dans votre profil.");
      return api.syncFfnSwimRecords({
        athleteId: userId ?? undefined,
        athleteName: user ?? undefined,
        iuf,
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["swim-records"] });
      toast({
        title: "Records FFN importés",
        description: `${data?.inserted ?? 0} ajouté(s), ${data?.updated ?? 0} mis à jour, ${data?.skipped ?? 0} inchangé(s)`,
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Import FFN impossible",
        description: String((error as any)?.message || error),
        variant: "destructive",
      });
    },
  });

  const startEdit = () => {
    setEditForm({
      group_id: (profile as any)?.group_id ? String((profile as any).group_id) : "",
      objectives: (profile as any)?.objectives || "",
      bio: (profile as any)?.bio || "",
      avatar_url: (profile as any)?.avatar_url || "",
      birthdate: (profile as any)?.birthdate ? String((profile as any).birthdate).split("T")[0] : "",
      ffn_iuf: (profile as any)?.ffn_iuf ? String((profile as any).ffn_iuf) : "",
    });
    setIsEditing(true);
  };

  const handleSaveProfile = () => updateProfile.mutate(editForm);

  const handleUpdatePassword = () => {
    if (!newPassword || newPassword.length < 6) {
      toast({
        title: "Mot de passe invalide",
        description: "Minimum 6 caractères.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: "Mot de passe invalide",
        description: "Les mots de passe ne correspondent pas.",
        variant: "destructive",
      });
      return;
    }
    updatePassword.mutate({ password: newPassword });
  };

  const groupLabel =
    groups.find((g: any) => g.id === (profile as any)?.group_id)?.name ||
    (profile as any)?.group_label ||
    "Non défini";

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display font-bold uppercase italic text-primary">Profil</h1>

      <Card>
        <CardHeader className="relative">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={avatarSrc} alt={user || "Profil"} />
              <AvatarFallback>{(user || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-xl font-semibold truncate">{user}</p>
              <p className="text-sm text-muted-foreground uppercase font-bold tracking-wider">{roleLabel}</p>
            </div>
          </div>

          {!isEditing && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4"
              onClick={startEdit}
              aria-label="Modifier le profil"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {isEditing ? (
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>Groupe</Label>
                <Select
                  value={editForm.group_id}
                  onValueChange={(value) => setEditForm({ ...editForm, group_id: value })}
                  disabled={groupsLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={groupsLoading ? "Chargement..." : "Choisir un groupe"} />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group: any) => (
                      <SelectItem key={group.id} value={String(group.id)}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {showRecords ? (
                <div className="grid gap-2">
                  <Label>IUF FFN</Label>
                  <Input
                    value={editForm.ffn_iuf}
                    onChange={(e) => setEditForm({ ...editForm, ffn_iuf: e.target.value })}
                    placeholder="879576"
                    inputMode="numeric"
                  />
                  <div className="text-xs text-muted-foreground">
                    Identifiant unique FFN (utilisé pour importer vos records compétition).
                  </div>
                </div>
              ) : null}

              <div className="grid gap-2">
                <Label>Objectifs</Label>
                <Input value={editForm.objectives} onChange={(e) => setEditForm({ ...editForm, objectives: e.target.value })} />
              </div>

              <div className="grid gap-2">
                <Label>Bio</Label>
                <Textarea value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} />
              </div>

              <div className="grid gap-2">
                <Label>Avatar (URL)</Label>
                <Input
                  value={editForm.avatar_url}
                  onChange={(e) => setEditForm({ ...editForm, avatar_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div className="grid gap-2">
                <Label>Date de naissance</Label>
                <Input
                  type="date"
                  value={editForm.birthdate}
                  onChange={(e) => setEditForm({ ...editForm, birthdate: e.target.value })}
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSaveProfile} disabled={updateProfile.isPending} className="w-full">
                  <Save className="mr-2 h-4 w-4" />
                  Enregistrer
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)} disabled={updateProfile.isPending}>
                  Annuler
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-xs text-muted-foreground uppercase">Groupe</Label>
                <div className="font-medium">{groupLabel}</div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground uppercase">Date de naissance</Label>
                <div className="font-medium">{formatBirthdate((profile as any)?.birthdate ?? null)}</div>
              </div>

              {showRecords ? (
                <div>
                  <Label className="text-xs text-muted-foreground uppercase">IUF FFN</Label>
                  <div className="font-medium">{String((profile as any)?.ffn_iuf ?? "") || "Non renseigné"}</div>
                </div>
              ) : null}

              <div className={showRecords ? "" : "col-span-2"}>
                <Label className="text-xs text-muted-foreground uppercase">Objectifs</Label>
                <div className="font-medium">{(profile as any)?.objectives || "Aucun objectif défini."}</div>
              </div>

              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground uppercase">Bio</Label>
                <div className="font-medium">{(profile as any)?.bio || "Non renseignée."}</div>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-end">
          <Button variant="outline" onClick={logout} className="gap-2">
            <LogOut className="h-4 w-4" />
            Se déconnecter
          </Button>
        </CardFooter>
      </Card>

      {showRecords ? (
        <Card>
          <CardHeader>
            <CardTitle>FFN</CardTitle>
            <CardDescription>Importer vos records compétition depuis Extranat.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              IUF enregistré : <span className="font-medium text-foreground">{String((profile as any)?.ffn_iuf ?? "") || "—"}</span>
            </div>
            <Button
              className="w-full gap-2"
              onClick={() => syncFfn.mutate()}
              disabled={syncFfn.isPending || !String((profile as any)?.ffn_iuf ?? "").trim()}
            >
              <RefreshCw className={["h-4 w-4", syncFfn.isPending ? "animate-spin" : ""].join(" ")} />
              {syncFfn.isPending ? "Import en cours..." : "Récupérer records depuis FFN"}
            </Button>
            {!String((profile as any)?.ffn_iuf ?? "").trim() ? (
              <div className="text-xs text-muted-foreground">
                Ajoutez votre IUF FFN dans le profil (bouton crayon) pour activer l’import.
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {canUpdatePassword ? (
        <Card>
          <CardHeader>
            <CardTitle>Mot de passe</CardTitle>
            <CardDescription>Modifiez votre mot de passe.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2">
              <Label>Nouveau mot de passe</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="grid gap-2">
              <Label>Confirmer</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button className="w-full" onClick={handleUpdatePassword} disabled={updatePassword.isPending}>
              Mettre à jour le mot de passe
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {showRecords ? (
        <Card>
          <CardHeader>
            <CardTitle>Records</CardTitle>
            <CardDescription>Consultez vos records de natation et musculation.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/records">
              <Button asChild>
                <a>Voir mes records</a>
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
