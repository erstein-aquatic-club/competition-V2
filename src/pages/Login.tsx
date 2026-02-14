import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PasswordStrength } from "@/components/shared/PasswordStrength";
import eacLogo from "@assets/logo-eac.png";
import {
  getLandingRouteForRole,
  shouldFocusSignup,
} from "@/pages/loginHelpers";

// Validation schemas
const loginSchema = z.object({
  email: z.string().min(1, "Email requis").email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

const signupSchema = z.object({
  name: z.string().min(2, "Minimum 2 caractères"),
  email: z.string().min(1, "Email requis").email("Email invalide"),
  birthdate: z.string().min(1, "Date de naissance requise").refine((val) => {
    const date = new Date(val);
    if (Number.isNaN(date.getTime())) return false;
    const age = (Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    return age >= 6 && age <= 100;
  }, "Âge invalide (6-100 ans)"),
  sex: z.enum(["M", "F"], { required_error: "Sexe requis" }),
  groupId: z.string().min(1, "Groupe requis"),
  password: z.string()
    .min(8, "Minimum 8 caractères")
    .regex(/[A-Z]/, "Au moins une majuscule")
    .regex(/[0-9]/, "Au moins un chiffre"),
});

const resetPasswordSchema = z.object({
  email: z.string().min(1, "Email requis").email("Email invalide"),
});

type LoginFormData = z.infer<typeof loginSchema>;
type SignupFormData = z.infer<typeof signupSchema>;
type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export default function Login() {
  const [error, setError] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [signupComplete, setSignupComplete] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const { loginFromSession, loadUser } = useAuth();
  const [, setLocation] = useLocation();
  const registerNameInputRef = useRef<HTMLInputElement>(null);

  // React Hook Form instances
  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      birthdate: "",
      sex: undefined,
      groupId: "",
      password: "",
    },
  });

  const resetPasswordForm = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email: "" },
  });

  const { data: groups = [], isLoading: groupsLoading, isError: groupsError } = useQuery({
    queryKey: ["register-groups"],
    queryFn: () => api.getGroups(),
    enabled: showRegister,
    retry: 2,
  });

  // Set default group when groups load
  useEffect(() => {
    if (!showRegister) return;
    const currentGroupId = signupForm.watch("groupId");
    if (!currentGroupId && groups.length > 0) {
      signupForm.setValue("groupId", String(groups[0].id));
    }
  }, [groups, showRegister, signupForm]);

  // Focus name input when register dialog opens
  useEffect(() => {
    if (shouldFocusSignup(showRegister)) {
      registerNameInputRef.current?.focus();
    }
  }, [showRegister]);

  const formatAuthError = (message: string) => {
    if (message.includes("Invalid login")) {
      return "Identifiant ou mot de passe incorrect.";
    }
    if (message.includes("Email not confirmed")) {
      return "Veuillez confirmer votre email avant de vous connecter.";
    }
    return message;
  };

  const handleLogin = async (data: LoginFormData) => {
    setError(null);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email.trim(),
        password: data.password,
      });
      if (authError) {
        throw new Error(formatAuthError(authError.message));
      }
      if (!authData.session) {
        throw new Error("Session non reçue.");
      }
      loginFromSession(authData.session);
      const hydrated = await loadUser();
      if (!hydrated) {
        throw new Error("Impossible de récupérer le profil utilisateur.");
      }
      const resolvedRole = useAuth.getState().role;
      setLocation(getLandingRouteForRole(resolvedRole), { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connexion impossible.";
      setError(message);
    }
  };

  const handleSignup = async (data: SignupFormData) => {
    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: data.email.trim(),
        password: data.password,
        options: {
          data: {
            display_name: data.name.trim(),
            birthdate: data.birthdate,
            group_id: Number(data.groupId),
            sex: data.sex,
          },
        },
      });
      if (signUpError) {
        throw new Error(signUpError.message);
      }
      if (authData.user) {
        // Sign out immediately — the user must be approved before logging in
        await supabase.auth.signOut();
        setSignupComplete(true);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Création impossible.";
      signupForm.setError("root", { message });
    }
  };

  const handleResetPassword = async (data: ResetPasswordFormData) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email.trim(), {
        redirectTo: window.location.origin + "/competition/#/reset-password",
      });
      if (error) throw error;
      setResetSent(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de l'envoi";
      resetPasswordForm.setError("root", { message });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <Card className="w-full max-w-sm relative z-10 shadow-2xl border-t-8 border-t-primary animate-in fade-in zoom-in duration-500 motion-reduce:animate-none">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-6 h-24 w-24 rounded-full bg-foreground flex items-center justify-center border-4 border-primary shadow-lg">
            <img src={eacLogo} alt="EAC Logo" loading="lazy" className="h-full w-full object-cover rounded-full opacity-90" />
          </div>
          <CardTitle className="text-3xl font-display italic uppercase tracking-tighter">
            SUIVI<span className="text-primary">NATATION</span>
          </CardTitle>
          <CardDescription className="uppercase tracking-widest text-xs font-bold">Erstein Aquatic Club</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="login-email" className="sr-only">Email</Label>
              <Input
                id="login-email"
                aria-label="Email"
                placeholder="Email"
                type="email"
                {...loginForm.register("email")}
                onChange={(e) => {
                  loginForm.register("email").onChange(e);
                  if (showRegister) setShowRegister(false);
                }}
                className="text-center text-lg h-12 border-2 focus-visible:ring-primary"
                autoFocus
              />
              {loginForm.formState.errors.email && (
                <p className="text-xs text-destructive text-center">{loginForm.formState.errors.email.message}</p>
              )}
              <p className="text-xs text-muted-foreground text-center">Saisissez votre email et votre mot de passe.</p>

              <Label htmlFor="login-password" className="sr-only">Mot de passe</Label>
              <Input
                id="login-password"
                aria-label="Mot de passe"
                placeholder="Mot de passe"
                type="password"
                {...loginForm.register("password")}
                className="text-center text-lg h-12 border-2 focus-visible:ring-primary"
              />
              {loginForm.formState.errors.password && (
                <p className="text-xs text-destructive text-center">{loginForm.formState.errors.password.message}</p>
              )}
              {error && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive text-center">
                  {error}
                </div>
              )}
            </div>
            <Button
              type="submit"
              className="w-full h-12 text-lg font-bold uppercase tracking-wider shadow-md hover:scale-[1.02] transition-transform"
              disabled={loginForm.formState.isSubmitting}
            >
              {loginForm.formState.isSubmitting ? "Connexion..." : "CONNEXION"}
            </Button>
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowRegister(true);
                  const email = loginForm.getValues("email").trim();
                  signupForm.setValue("email", email);
                }}
                className="text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                Créer un compte
              </button>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-primary underline"
                onClick={() => {
                  setShowForgotPassword(true);
                  const email = loginForm.getValues("email").trim();
                  resetPasswordForm.setValue("email", email);
                }}
              >
                Mot de passe oublié ?
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Register Dialog */}
      <Dialog
        open={showRegister}
        onOpenChange={(open) => {
          setShowRegister(open);
          if (!open) {
            signupForm.reset();
            setSignupComplete(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          {signupComplete ? (
            <div className="text-center space-y-4 py-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <span className="text-3xl text-primary">&#10003;</span>
              </div>
              <h2 className="text-xl font-semibold">Compte créé avec succès !</h2>
              <p className="text-sm text-muted-foreground">
                Un coach ou un administrateur doit valider votre inscription avant votre première connexion.
              </p>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => {
                  setSignupComplete(false);
                  setShowRegister(false);
                }}
              >
                Retour à la connexion
              </Button>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Créer un compte</DialogTitle>
                <DialogDescription>Complétez les informations pour créer votre profil.</DialogDescription>
              </DialogHeader>
              <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-name">Nom d'affichage</Label>
                  <Input
                    id="register-name"
                    {...signupForm.register("name")}
                    placeholder="Votre nom"
                    ref={registerNameInputRef}
                  />
                  {signupForm.formState.errors.name && (
                    <p className="text-xs text-destructive">{signupForm.formState.errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-email">Email</Label>
                  <Input
                    id="register-email"
                    type="email"
                    {...signupForm.register("email")}
                    placeholder="prenom.nom@email.com"
                  />
                  {signupForm.formState.errors.email && (
                    <p className="text-xs text-destructive">{signupForm.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-birthdate">Date de naissance</Label>
                  <Input
                    id="register-birthdate"
                    type="date"
                    {...signupForm.register("birthdate")}
                  />
                  {signupForm.formState.errors.birthdate && (
                    <p className="text-xs text-destructive">{signupForm.formState.errors.birthdate.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-sex">Sexe</Label>
                  <Select
                    value={signupForm.watch("sex")}
                    onValueChange={(value) => signupForm.setValue("sex", value as "M" | "F")}
                  >
                    <SelectTrigger id="register-sex">
                      <SelectValue placeholder="Sélectionnez" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Garçon</SelectItem>
                      <SelectItem value="F">Fille</SelectItem>
                    </SelectContent>
                  </Select>
                  {signupForm.formState.errors.sex && (
                    <p className="text-xs text-destructive">{signupForm.formState.errors.sex.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-group">Groupe</Label>
                  <Select
                    value={signupForm.watch("groupId")}
                    onValueChange={(value) => signupForm.setValue("groupId", value)}
                    disabled={groupsLoading || groups.length === 0}
                  >
                    <SelectTrigger id="register-group">
                      <SelectValue placeholder={groupsLoading ? "Chargement..." : groupsError ? "Erreur de chargement" : "Sélectionnez un groupe"} />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={String(group.id)}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {signupForm.formState.errors.groupId && (
                    <p className="text-xs text-destructive">{signupForm.formState.errors.groupId.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-password">Mot de passe</Label>
                  <Input
                    id="register-password"
                    type="password"
                    {...signupForm.register("password")}
                    placeholder="Choisissez un mot de passe"
                  />
                  {signupForm.formState.errors.password && (
                    <p className="text-xs text-destructive">{signupForm.formState.errors.password.message}</p>
                  )}
                  <PasswordStrength password={signupForm.watch("password")} />
                </div>

                {signupForm.formState.errors.root && (
                  <p className="text-sm text-destructive">{signupForm.formState.errors.root.message}</p>
                )}

                <Button type="submit" className="w-full" disabled={signupForm.formState.isSubmitting}>
                  {signupForm.formState.isSubmitting ? "Création..." : "Créer le compte"}
                </Button>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Forgot Password Dialog */}
      <Dialog
        open={showForgotPassword}
        onOpenChange={(open) => {
          setShowForgotPassword(open);
          if (!open) {
            resetPasswordForm.reset();
            setResetSent(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          {resetSent ? (
            <div className="text-center space-y-4 py-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <span className="text-3xl text-primary">&#9993;</span>
              </div>
              <h2 className="text-xl font-semibold">Email envoyé</h2>
              <p className="text-sm text-muted-foreground">
                Un email de réinitialisation a été envoyé. Vérifiez votre boîte de réception.
              </p>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => {
                  setShowForgotPassword(false);
                  setResetSent(false);
                }}
              >
                Retour à la connexion
              </Button>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
                <DialogDescription>
                  Entrez votre adresse email pour recevoir un lien de réinitialisation.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={resetPasswordForm.handleSubmit(handleResetPassword)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    {...resetPasswordForm.register("email")}
                    placeholder="votre@email.com"
                    autoFocus
                  />
                  {resetPasswordForm.formState.errors.email && (
                    <p className="text-xs text-destructive">{resetPasswordForm.formState.errors.email.message}</p>
                  )}
                </div>

                {resetPasswordForm.formState.errors.root && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive text-center">
                    {resetPasswordForm.formState.errors.root.message}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={resetPasswordForm.formState.isSubmitting}>
                  {resetPasswordForm.formState.isSubmitting ? "Envoi..." : "Envoyer le lien"}
                </Button>

                <div className="flex justify-center">
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-primary underline"
                    onClick={() => setShowForgotPassword(false)}
                  >
                    Retour à la connexion
                  </button>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      <div className="absolute bottom-4 text-xs text-muted-foreground opacity-50 uppercase font-bold tracking-widest">
        EAC Performance Tracking
      </div>
    </div>
  );
}
