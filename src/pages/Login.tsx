
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import eacLogo from "@assets/logo-eac.png";
import {
  getLandingRouteForRole,
  shouldFocusSignup,
} from "@/pages/loginHelpers";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerBirthdate, setRegisterBirthdate] = useState("");
  const [registerGroupId, setRegisterGroupId] = useState("");
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [signupComplete, setSignupComplete] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const { loginFromSession, loadUser } = useAuth();
  const [, setLocation] = useLocation();
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const registerNameInputRef = useRef<HTMLInputElement>(null);
  const { data: groups = [], isLoading: groupsLoading, isError: groupsError } = useQuery({
    queryKey: ["register-groups"],
    queryFn: () => api.getGroups(),
    enabled: showRegister,
    retry: 2,
  });

  useEffect(() => {
    if (!showRegister) return;
    if (!registerGroupId && groups.length > 0) {
      setRegisterGroupId(String(groups[0].id));
    }
  }, [groups, registerGroupId, showRegister]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const identifier = email.trim();
    if (!identifier) return;
    if (!password.trim()) {
      setError("Mot de passe requis.");
      passwordInputRef.current?.focus();
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: identifier,
        password,
      });
      if (authError) {
        throw new Error(formatAuthError(authError.message));
      }
      if (!data.session) {
        throw new Error("Session non reçue.");
      }
      loginFromSession(data.session);
      const hydrated = await loadUser();
      if (!hydrated) {
        throw new Error("Impossible de récupérer le profil utilisateur.");
      }
      // Read role from the auth store (loadUser fetches it from public.users)
      // instead of the JWT claim which can be stale.
      const resolvedRole = useAuth.getState().role;
      setLocation(getLandingRouteForRole(resolvedRole), { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connexion impossible.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    setResetLoading(true);
    setResetError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: window.location.origin + '/competition/#/reset-password',
      });
      if (error) throw error;
      setResetSent(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de l'envoi";
      setResetError(message);
    } finally {
      setResetLoading(false);
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
          <CardTitle className="text-3xl font-display italic uppercase tracking-tighter">SUIVI<span className="text-primary">NATATION</span></CardTitle>
          <CardDescription className="uppercase tracking-widest text-xs font-bold">Erstein Aquatic Club</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="login-email" className="sr-only">Email</Label>
              <Input
                id="login-email"
                aria-label="Email"
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (showRegister) {
                    setShowRegister(false);
                  }
                }}
                className="text-center text-lg h-12 border-2 focus-visible:ring-primary"
                autoFocus
              />
              <p className="text-xs text-muted-foreground text-center">
                Saisissez votre email et votre mot de passe.
              </p>
              <Label htmlFor="login-password" className="sr-only">Mot de passe</Label>
              <Input
                id="login-password"
                aria-label="Mot de passe"
                placeholder="Mot de passe"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                ref={passwordInputRef}
                className="text-center text-lg h-12 border-2 focus-visible:ring-primary"
              />
              {error ? (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive text-center">{error}</div>
              ) : null}
            </div>
            <Button
              type="submit"
              className="w-full h-12 text-lg font-bold uppercase tracking-wider shadow-md hover:scale-[1.02] transition-transform"
              disabled={!email.trim() || !password.trim() || isSubmitting}
            >
              {isSubmitting ? "Connexion..." : "CONNEXION"}
            </Button>
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowRegister(true);
                  const trimmedEmail = email.trim();
                  setRegisterEmail(trimmedEmail);
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
                  setResetEmail(email.trim());
                }}
              >
                Mot de passe oublié ?
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Dialog
        open={showRegister}
        onOpenChange={(open) => {
          setShowRegister(open);
          if (!open) {
          setRegisterError(null);
          setRegisterPassword("");
          setRegisterBirthdate("");
          setRegisterGroupId("");
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
            <DialogDescription>
              Complétez les informations pour créer votre profil.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!registerName.trim()) {
                setRegisterError("Ajoutez votre nom.");
                return;
              }
              if (!registerEmail.trim()) {
                setRegisterError("Ajoutez votre email.");
                return;
              }
              if (!registerGroupId) {
                setRegisterError("Sélectionnez un groupe.");
                return;
              }
              if (!registerBirthdate) {
                setRegisterError("Ajoutez votre date de naissance.");
                return;
              }
              if (!registerPassword) {
                setRegisterError("Choisissez un mot de passe.");
                return;
              }
              setRegisterError(null);
              setIsRegistering(true);
              try {
                const { data, error: signUpError } = await supabase.auth.signUp({
                  email: registerEmail.trim(),
                  password: registerPassword,
                  options: {
                    data: {
                      display_name: registerName.trim(),
                      birthdate: registerBirthdate,
                      group_id: Number(registerGroupId),
                    },
                  },
                });
                if (signUpError) {
                  throw new Error(signUpError.message);
                }
                if (data.user) {
                  // Sign out immediately — the user must be approved before logging in
                  await supabase.auth.signOut();
                  setSignupComplete(true);
                  setIsRegistering(false);
                  return;
                }
                setRegisterError("Création impossible.");
              } catch (err) {
                const message = err instanceof Error ? err.message : "Création impossible.";
                setRegisterError(message);
              } finally {
                setIsRegistering(false);
              }
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="register-name">Nom d'affichage</Label>
              <Input
                id="register-name"
                value={registerName}
                onChange={(event) => setRegisterName(event.target.value)}
                placeholder="Votre nom"
                ref={registerNameInputRef}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-email">Email</Label>
              <Input
                id="register-email"
                type="email"
                value={registerEmail}
                onChange={(event) => setRegisterEmail(event.target.value)}
                placeholder="prenom.nom@email.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-birthdate">Date de naissance</Label>
              <Input
                id="register-birthdate"
                type="date"
                value={registerBirthdate}
                onChange={(event) => setRegisterBirthdate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-group">Groupe</Label>
              <Select
                value={registerGroupId}
                onValueChange={setRegisterGroupId}
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-password">Mot de passe</Label>
              <Input
                id="register-password"
                type="password"
                value={registerPassword}
                onChange={(event) => setRegisterPassword(event.target.value)}
                placeholder="Choisissez un mot de passe"
              />
            </div>
            {registerError ? (
              <p className="text-sm text-destructive">{registerError}</p>
            ) : null}
            <Button type="submit" className="w-full" disabled={isRegistering || !registerName.trim()}>
              {isRegistering ? "Création..." : "Créer le compte"}
            </Button>
          </form>
          </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={showForgotPassword}
        onOpenChange={(open) => {
          setShowForgotPassword(open);
          if (!open) {
            setResetError(null);
            setResetSent(false);
            setResetEmail("");
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
                  setResetEmail("");
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
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleResetPassword();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="votre@email.com"
                    required
                    autoFocus
                  />
                </div>
                {resetError ? (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive text-center">
                    {resetError}
                  </div>
                ) : null}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={!resetEmail.trim() || resetLoading}
                >
                  {resetLoading ? "Envoi..." : "Envoyer le lien"}
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
