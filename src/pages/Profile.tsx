import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import type { UserProfile as ProfileData, GroupSummary } from "@/lib/api";
import { Link } from "wouter";
import { ChevronRight, Edit2, LogOut, RefreshCw, Save, AlertCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { fadeIn } from "@/lib/animations";

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

// Profile edit validation schema
const profileEditSchema = z.object({
  group_id: z.string().optional(),
  objectives: z.string().optional(),
  bio: z.string().optional(),
  avatar_url: z.string().url("URL invalide").optional().or(z.literal("")),
  birthdate: z.string().optional().refine(
    (val) => {
      if (!val) return true;
      const date = new Date(val);
      if (isNaN(date.getTime())) return false;
      const age = (new Date().getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      return age >= 6 && age <= 100;
    },
    { message: "L'âge doit être entre 6 et 100 ans" }
  ),
  ffn_iuf: z.string().optional().refine(
    (val) => {
      if (!val) return true;
      return /^\d+$/.test(val);
    },
    { message: "L'IUF FFN doit être un nombre" }
  ),
});

type ProfileEditForm = z.infer<typeof profileEditSchema>;

// Password change validation schema
const passwordChangeSchema = z.object({
  password: z
    .string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères")
    .regex(/[A-Z]/, "Le mot de passe doit contenir au moins une majuscule")
    .regex(/\d/, "Le mot de passe doit contenir au moins un chiffre"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

type PasswordChangeForm = z.infer<typeof passwordChangeSchema>;

export default function Profile() {
  const { user, userId, logout, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const showRecords = shouldShowRecords(role);
  const canUpdatePassword = role === "athlete" || role === "coach" || role === "admin";
  const roleLabel = getRoleLabel(role);

  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);

  // Profile edit form with React Hook Form + Zod
  const profileForm = useForm<ProfileEditForm>({
    resolver: zodResolver(profileEditSchema),
    defaultValues: {
      group_id: "",
      objectives: "",
      bio: "",
      avatar_url: "",
      birthdate: "",
      ffn_iuf: "",
    },
  });

  // Password change form with React Hook Form + Zod
  const passwordForm = useForm<PasswordChangeForm>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const { data: profile, isLoading: profileLoading, error: profileError, refetch: refetchProfile } = useQuery({
    queryKey: ["profile", user, userId],
    queryFn: () => api.getProfile({ displayName: user, userId }),
    enabled: !!user,
  });

  const { data: groups = [], isLoading: groupsLoading, error: groupsError, refetch: refetchGroups } = useQuery({
    queryKey: ["profile-groups"],
    queryFn: () => api.getGroups(),
    enabled: !!user,
  });

  const error = profileError || groupsError;
  const refetch = () => {
    refetchProfile();
    refetchGroups();
  };

  const avatarSrc = useMemo(() => {
    const src = profile?.avatar_url;
    if (src) return src;
    if (user) return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user)}`;
    return "";
  }, [profile, user]);

  const updateProfile = useMutation({
    mutationFn: (data: ProfileEditForm) =>
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
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setIsEditSheetOpen(false);
      toast({ title: "Profil mis à jour" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Mise à jour impossible",
        description: String((error as Error)?.message || error),
        variant: "destructive",
      });
    },
  });

  const updatePassword = useMutation({
    mutationFn: (payload: { password: string }) => api.authPasswordUpdate(payload),
    onSuccess: () => {
      passwordForm.reset();
      toast({ title: "Mot de passe mis à jour" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Mise à jour impossible",
        description: String((error as Error)?.message || error),
        variant: "destructive",
      });
    },
  });

  const syncFfn = useMutation({
    mutationFn: async () => {
      const iuf = String(profile?.ffn_iuf ?? "").trim();
      if (!iuf) throw new Error("IUF FFN manquant. Ajoutez-le dans votre profil.");
      return api.syncFfnSwimRecords({
        athleteId: userId ?? undefined,
        athleteName: user ?? undefined,
        iuf,
      });
    },
    onSuccess: (data: { inserted: number; updated: number; skipped: number }) => {
      queryClient.invalidateQueries({ queryKey: ["swim-records"] });
      toast({
        title: "Records FFN importés",
        description: `${data?.inserted ?? 0} ajouté(s), ${data?.updated ?? 0} mis à jour, ${data?.skipped ?? 0} inchangé(s)`,
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Import FFN impossible",
        description: String((error as Error)?.message || error),
        variant: "destructive",
      });
    },
  });

  const startEdit = () => {
    profileForm.reset({
      group_id: profile?.group_id ? String(profile.group_id) : "",
      objectives: profile?.objectives || "",
      bio: profile?.bio || "",
      avatar_url: profile?.avatar_url || "",
      birthdate: profile?.birthdate ? String(profile.birthdate).split("T")[0] : "",
      ffn_iuf: profile?.ffn_iuf ? String(profile.ffn_iuf) : "",
    });
    setIsEditSheetOpen(true);
  };

  const handleSaveProfile = profileForm.handleSubmit((data) => {
    updateProfile.mutate(data);
  });

  const handleUpdatePassword = passwordForm.handleSubmit((data) => {
    updatePassword.mutate({ password: data.password });
  });

  const groupLabel =
    groups.find((g) => g.id === profile?.group_id)?.name ||
    profile?.group_label ||
    "Non défini";

  if (profileLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-32" />

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-5 w-24" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-20" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-28" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-5 w-32" />
              </div>
              <div className="col-span-2 space-y-2">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-12 w-full" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="font-semibold">Impossible de charger les données</h3>
        <p className="text-sm text-muted-foreground mt-2">{(error as Error).message}</p>
        <Button onClick={() => refetch()} className="mt-4">
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-6"
      variants={fadeIn}
      initial="hidden"
      animate="visible"
    >
      {/* Hero Banner */}
      <div className="rounded-xl bg-accent text-accent-foreground p-5">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20 ring-2 ring-primary ring-offset-2 ring-offset-accent">
            <AvatarImage src={avatarSrc} alt={user || "Profil"} />
            <AvatarFallback className="text-lg">{(user || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-display font-bold uppercase italic text-accent-foreground truncate">{user}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">{roleLabel}</Badge>
              <span className="text-sm opacity-80">{groupLabel}</span>
            </div>
            {showRecords && String(profile?.ffn_iuf ?? "").trim() && (
              <p className="text-xs opacity-60 mt-1">IUF {profile?.ffn_iuf}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-accent-foreground hover:bg-accent-foreground/10"
            onClick={startEdit}
            aria-label="Modifier le profil"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <Label className="text-xs text-muted-foreground uppercase">Groupe</Label>
              <div className="font-medium">{groupLabel}</div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground uppercase">Date de naissance</Label>
              <div className="font-medium">{formatBirthdate(profile?.birthdate ?? null)}</div>
            </div>

            {showRecords ? (
              <div>
                <Label className="text-xs text-muted-foreground uppercase">IUF FFN</Label>
                <div className="font-medium">{String(profile?.ffn_iuf ?? "") || "Non renseigné"}</div>
              </div>
            ) : null}

            <div className={showRecords ? "" : "col-span-2"}>
              <Label className="text-xs text-muted-foreground uppercase">Objectifs</Label>
              <div className="font-medium">{profile?.objectives || "Aucun objectif défini."}</div>
            </div>

            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground uppercase">Bio</Label>
              <div className="font-medium">{profile?.bio || "Non renseignée."}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Modifier le profil</SheetTitle>
            <SheetDescription>Mettez à jour vos informations personnelles.</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSaveProfile} className="space-y-4 mt-4">
            <div className="grid gap-2">
              <Label>Groupe</Label>
              <Select
                value={profileForm.watch("group_id")}
                onValueChange={(value) => profileForm.setValue("group_id", value)}
                disabled={groupsLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={groupsLoading ? "Chargement..." : "Choisir un groupe"} />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
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
                  {...profileForm.register("ffn_iuf")}
                  placeholder="879576"
                  inputMode="numeric"
                />
                {profileForm.formState.errors.ffn_iuf && (
                  <p className="text-xs text-destructive" role="alert" aria-live="assertive">{profileForm.formState.errors.ffn_iuf.message}</p>
                )}
                <div className="text-xs text-muted-foreground">
                  Identifiant unique FFN (utilisé pour importer vos records compétition).
                </div>
              </div>
            ) : null}

            <div className="grid gap-2">
              <Label>Objectifs</Label>
              <Input {...profileForm.register("objectives")} />
              {profileForm.formState.errors.objectives && (
                <p className="text-xs text-destructive" role="alert" aria-live="assertive">{profileForm.formState.errors.objectives.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Bio</Label>
              <Textarea {...profileForm.register("bio")} />
              {profileForm.formState.errors.bio && (
                <p className="text-xs text-destructive" role="alert" aria-live="assertive">{profileForm.formState.errors.bio.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Avatar (URL)</Label>
              <Input
                {...profileForm.register("avatar_url")}
                placeholder="https://..."
              />
              {profileForm.formState.errors.avatar_url && (
                <p className="text-xs text-destructive" role="alert" aria-live="assertive">{profileForm.formState.errors.avatar_url.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Date de naissance</Label>
              <Input
                type="date"
                {...profileForm.register("birthdate")}
              />
              {profileForm.formState.errors.birthdate && (
                <p className="text-xs text-destructive" role="alert" aria-live="assertive">{profileForm.formState.errors.birthdate.message}</p>
              )}
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={updateProfile.isPending} className="w-full">
                <Save className="mr-2 h-4 w-4" />
                Enregistrer
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsEditSheetOpen(false)} disabled={updateProfile.isPending}>
                Annuler
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {showRecords ? (
        <Card>
          <CardHeader>
            <CardTitle>FFN & Records</CardTitle>
            <CardDescription>Gérez vos records de natation et l'import FFN.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              IUF enregistré : <span className="font-medium text-foreground">{String(profile?.ffn_iuf ?? "") || "—"}</span>
            </div>
            <Button
              className="w-full gap-2"
              onClick={() => syncFfn.mutate()}
              disabled={syncFfn.isPending || !String(profile?.ffn_iuf ?? "").trim()}
            >
              <RefreshCw className={["h-4 w-4", syncFfn.isPending ? "animate-spin" : ""].join(" ")} />
              {syncFfn.isPending ? "Import en cours..." : "Récupérer records depuis FFN"}
            </Button>
            {!String(profile?.ffn_iuf ?? "").trim() ? (
              <div className="text-xs text-muted-foreground">
                Ajoutez votre IUF FFN dans le profil (bouton crayon) pour activer l'import.
              </div>
            ) : null}
            <Link href="/records">
              <Button variant="outline" className="w-full">
                Voir mes records
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {canUpdatePassword ? (
        <Collapsible className="group">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 w-full text-left py-3 px-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
              <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
              Sécurité
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card>
              <CardContent className="pt-4">
                <form onSubmit={handleUpdatePassword} className="space-y-3">
                  <div className="grid gap-2">
                    <Label>Nouveau mot de passe</Label>
                    <Input
                      type="password"
                      {...passwordForm.register("password")}
                      placeholder="••••••••"
                    />
                    {passwordForm.formState.errors.password && (
                      <p className="text-xs text-destructive" role="alert" aria-live="assertive">{passwordForm.formState.errors.password.message}</p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label>Confirmer</Label>
                    <Input
                      type="password"
                      {...passwordForm.register("confirmPassword")}
                      placeholder="••••••••"
                    />
                    {passwordForm.formState.errors.confirmPassword && (
                      <p className="text-xs text-destructive" role="alert" aria-live="assertive">{passwordForm.formState.errors.confirmPassword.message}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full" disabled={updatePassword.isPending}>
                    Mettre à jour le mot de passe
                  </Button>
                </form>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      <Button variant="ghost" onClick={logout} className="w-full gap-2 text-muted-foreground">
        <LogOut className="h-4 w-4" />
        Se déconnecter
      </Button>
    </motion.div>
  );
}
