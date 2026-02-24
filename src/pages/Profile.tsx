import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { useLocation } from "wouter";
import { Lock, Pen, Target, Trophy, LogOut, Save, AlertCircle, Download, Camera, Trash2 } from "lucide-react";
import { compressImage, isAcceptedImageType } from "@/lib/imageUtils";
import AvatarCropDialog from "@/components/profile/AvatarCropDialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { fadeIn } from "@/lib/animations";
import SwimmerObjectivesView from "@/components/profile/SwimmerObjectivesView";

declare const __BUILD_TIMESTAMP__: string;

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

// Profile edit validation schema
const profileEditSchema = z.object({
  group_id: z.string().optional(),
  bio: z.string().optional(),
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
  phone: z.string().optional(),
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
  const [, navigate] = useLocation();

  const showRecords = shouldShowRecords(role);
  const canUpdatePassword = role === "athlete" || role === "coach" || role === "admin";
  const roleLabel = getRoleLabel(role);

  const [activeSection, setActiveSection] = useState<"home" | "objectives">("home");
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [isPasswordSheetOpen, setIsPasswordSheetOpen] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [cropDialogSrc, setCropDialogSrc] = useState<string | null>(null);

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    localStorage.removeItem("app_build_timestamp");
    try {
      // 1. Force SW to check for a new version
      const reg = (window as any).__pwaRegistration as ServiceWorkerRegistration | undefined
        ?? await navigator.serviceWorker?.getRegistration();
      if (reg) {
        await reg.update();
        // Wait for new SW to install + activate (skipWaiting is enabled)
        await new Promise((r) => setTimeout(r, 1500));
      }
      // 2. Clear all Workbox caches so reload fetches fresh assets
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
      // 3. Hard reload
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  // Profile edit form with React Hook Form + Zod
  const profileForm = useForm<ProfileEditForm>({
    resolver: zodResolver(profileEditSchema),
    defaultValues: {
      group_id: "",
      bio: "",
      birthdate: "",
      ffn_iuf: "",
      phone: "",
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
        profile: {
          group_id: data.group_id ? Number(data.group_id) : null,
          birthdate: data.birthdate || null,
          bio: data.bio,
          ffn_iuf: (data.ffn_iuf || "").trim() || null,
          phone: data.phone || null,
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

  const uploadAvatarMutation = useMutation({
    mutationFn: async (croppedBlob: Blob) => {
      if (!userId) throw new Error("Utilisateur non identifié");
      const file = new File([croppedBlob], "avatar.png", { type: "image/png" });
      const { blob, mimeType, extension } = await compressImage(file);
      return api.uploadAvatar({ userId, blob, mimeType, extension });
    },
    onSuccess: () => {
      setCropDialogSrc(null);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({ title: "Photo de profil mise à jour" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Impossible de charger la photo",
        description: String((error as Error)?.message || error),
        variant: "destructive",
      });
    },
  });

  const handleFileSelected = (file: File) => {
    if (!isAcceptedImageType(file)) {
      toast({
        title: "Format non supporté",
        description: "Utilisez JPEG, PNG ou WebP.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Fichier trop volumineux",
        description: "La taille maximale est de 10 Mo.",
        variant: "destructive",
      });
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setCropDialogSrc(objectUrl);
  };

  const deleteAvatarMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Utilisateur non identifié");
      return api.deleteAvatar(userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({ title: "Photo supprimée" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Impossible de supprimer la photo",
        description: String((error as Error)?.message || error),
        variant: "destructive",
      });
    },
  });

  const startEdit = () => {
    profileForm.reset({
      group_id: profile?.group_id ? String(profile.group_id) : "",
      bio: profile?.bio || "",
      birthdate: profile?.birthdate ? String(profile.birthdate).split("T")[0] : "",
      ffn_iuf: profile?.ffn_iuf ? String(profile.ffn_iuf) : "",
      phone: profile?.phone || "",
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
        <div className="rounded-xl bg-accent p-5">
          <div className="flex items-center gap-4">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
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

  if (activeSection === "objectives") {
    return <SwimmerObjectivesView onBack={() => setActiveSection("home")} />;
  }

  return (
    <motion.div
      className="space-y-6"
      variants={fadeIn}
      initial="hidden"
      animate="visible"
    >
      {/* Hero compact */}
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
            {profile?.bio && (
              <p className="text-xs opacity-70 mt-1.5 line-clamp-2">{profile.bio}</p>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Grid 2x2 */}
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={startEdit}
          className="rounded-xl border bg-card p-4 text-left shadow-sm active:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Pen className="h-5 w-5 text-primary mb-2" />
          <p className="text-sm font-bold">Mon profil</p>
          <p className="text-xs text-muted-foreground">Modifier mes infos</p>
        </button>
        {canUpdatePassword && (
          <button type="button" onClick={() => setIsPasswordSheetOpen(true)}
            className="rounded-xl border bg-card p-4 text-left shadow-sm active:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Lock className="h-5 w-5 text-primary mb-2" />
            <p className="text-sm font-bold">Sécurité</p>
            <p className="text-xs text-muted-foreground">Mot de passe</p>
          </button>
        )}
        {showRecords && (
          <button type="button" onClick={() => navigate("/records")}
            className="rounded-xl border bg-card p-4 text-left shadow-sm active:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Trophy className="h-5 w-5 text-primary mb-2" />
            <p className="text-sm font-bold">Records</p>
            <p className="text-xs text-muted-foreground">Mes perfs personnelles</p>
          </button>
        )}
        <button type="button" onClick={() => setActiveSection("objectives")}
          className="rounded-xl border bg-card p-4 text-left shadow-sm active:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Target className="h-5 w-5 text-primary mb-2" />
          <p className="text-sm font-bold">Objectifs</p>
          <p className="text-xs text-muted-foreground">Mon plan</p>
        </button>
      </div>

      {/* Logout */}
      <Button variant="destructive" onClick={logout} className="w-full gap-2">
        <LogOut className="h-4 w-4" />
        Se déconnecter
      </Button>

      {/* Version info */}
      <div className="space-y-1 pt-2">
        <button type="button" onClick={handleCheckUpdate} disabled={isCheckingUpdate}
          className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-2">
          <Download className={["h-3 w-3", isCheckingUpdate ? "animate-bounce" : ""].join(" ")} />
          {isCheckingUpdate ? "Recherche en cours..." : "Rechercher des mises à jour"}
        </button>
        <p className="text-[10px] text-center text-muted-foreground/60">
          Version du {new Date(__BUILD_TIMESTAMP__).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>

      {/* Edit profile bottom sheet */}
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
              <Label>Bio</Label>
              <Textarea {...profileForm.register("bio")} />
              {profileForm.formState.errors.bio && (
                <p className="text-xs text-destructive" role="alert" aria-live="assertive">{profileForm.formState.errors.bio.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Photo de profil</Label>
              <div className="flex items-center gap-3">
                <Avatar className="h-16 w-16 ring-2 ring-primary/20">
                  <AvatarImage src={avatarSrc} alt="Avatar" />
                  <AvatarFallback>{(user || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={uploadAvatarMutation.isPending}
                    onClick={() => document.getElementById("avatar-upload")?.click()}
                  >
                    <Camera className="h-4 w-4" />
                    {uploadAvatarMutation.isPending ? "Envoi..." : "Changer la photo"}
                  </Button>
                  {profile?.avatar_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-2 text-destructive hover:text-destructive"
                      disabled={deleteAvatarMutation.isPending}
                      onClick={() => deleteAvatarMutation.mutate()}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Supprimer
                    </Button>
                  )}
                </div>
              </div>
              <input
                id="avatar-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp,.heic,.heif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelected(file);
                  e.target.value = "";
                }}
              />
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

            {/* Phone */}
            <div className="grid gap-2">
              <Label htmlFor="edit-phone">Telephone</Label>
              <Input
                id="edit-phone"
                type="tel"
                placeholder="06 12 34 56 78"
                {...profileForm.register("phone")}
              />
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

      {/* Password change bottom sheet */}
      <Sheet open={isPasswordSheetOpen} onOpenChange={setIsPasswordSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Changer le mot de passe</SheetTitle>
            <SheetDescription>Votre mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre.</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleUpdatePassword} className="space-y-3 mt-4">
            <div className="grid gap-2">
              <Label>Nouveau mot de passe</Label>
              <Input type="password" {...passwordForm.register("password")} placeholder="••••••••" />
              {passwordForm.formState.errors.password && (
                <p className="text-xs text-destructive" role="alert" aria-live="assertive">{passwordForm.formState.errors.password.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Confirmer</Label>
              <Input type="password" {...passwordForm.register("confirmPassword")} placeholder="••••••••" />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-xs text-destructive" role="alert" aria-live="assertive">{passwordForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={updatePassword.isPending}>
              Mettre à jour le mot de passe
            </Button>
          </form>
        </SheetContent>
      </Sheet>
      {/* Avatar crop dialog */}
      {cropDialogSrc && (
        <AvatarCropDialog
          open={!!cropDialogSrc}
          imageSrc={cropDialogSrc}
          onClose={() => {
            URL.revokeObjectURL(cropDialogSrc);
            setCropDialogSrc(null);
          }}
          onCropDone={(blob) => {
            URL.revokeObjectURL(cropDialogSrc);
            uploadAvatarMutation.mutate(blob);
          }}
        />
      )}
    </motion.div>
  );
}
