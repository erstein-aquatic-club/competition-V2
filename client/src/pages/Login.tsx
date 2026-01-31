
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import {
  AUTH_ENDPOINT_MISSING_MESSAGE,
  AUTH_ENDPOINT_INVALID_MESSAGE,
  buildAuthUrl,
} from "@/lib/authRequests";
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
  shouldOpenSignupOnAuthError,
} from "@/pages/loginHelpers";

export default function Login() {
  const [name, setName] = useState("");
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
  const { login, loadUser } = useAuth();
  const [, setLocation] = useLocation();
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const registerNameInputRef = useRef<HTMLInputElement>(null);
  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ["register-groups"],
    queryFn: () => api.getGroups(),
    enabled: showRegister,
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

  const formatAuthError = (message: string, code?: string) => {
    if (code === "config_error" || message.includes("AUTH_SECRET")) {
      return "AUTH_SECRET manquant côté Worker. Ajoutez une variable d'environnement AUTH_SECRET puis redéployez le Worker.";
    }
    return message;
  };

  const resolveAuthUrl = (action: string, onError: (message: string) => void = setError) => {
    try {
      return buildAuthUrl(action);
    } catch (err) {
      const message = err instanceof Error ? err.message : AUTH_ENDPOINT_MISSING_MESSAGE;
      const safeMessage = message === AUTH_ENDPOINT_INVALID_MESSAGE ? message : AUTH_ENDPOINT_MISSING_MESSAGE;
      onError(safeMessage);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const identifier = name.trim();
    if (!identifier) return;
    if (!password.trim()) {
      setError("Mot de passe requis.");
      passwordInputRef.current?.focus();
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const url = resolveAuthUrl("auth_login");
      if (!url) {
        throw new Error(AUTH_ENDPOINT_MISSING_MESSAGE);
      }
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier,
          password,
        }),
      });
      const payload = await res.json();
      if (!res.ok || payload?.ok !== true) {
        const error = payload?.error || `Erreur ${res.status}`;
        const code = payload?.code || payload?.data?.code;
        const formatted = formatAuthError(error, code);
        if (shouldOpenSignupOnAuthError(code)) {
          setShowRegister(true);
          setRegisterName(identifier);
          setRegisterEmail(identifier.includes("@") ? identifier : "");
        }
        throw new Error(formatted);
      }
      const { user, access_token: accessToken, refresh_token: refreshToken } = payload.data || {};
      if (!accessToken || !refreshToken) {
        throw new Error("Tokens manquants dans la réponse.");
      }
      const displayName = user?.display_name || identifier;
      const rawUserId = Number(user?.id);
      const userId = Number.isFinite(rawUserId) ? rawUserId : null;
      login({ user: displayName, accessToken, refreshToken, userId, role: user?.role ?? null });
      const hydrated = await loadUser();
      if (!hydrated) {
        throw new Error("Impossible de récupérer le profil utilisateur.");
      }
      const role = user?.role ? String(user.role) : null;
      setLocation(getLandingRouteForRole(role), { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connexion impossible.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      
      <Card className="w-full max-w-sm relative z-10 shadow-2xl border-t-8 border-t-primary animate-in fade-in zoom-in duration-500">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-6 h-24 w-24 rounded-full bg-black flex items-center justify-center border-4 border-primary shadow-lg">
             <img src={eacLogo} alt="EAC Logo" className="h-full w-full object-cover rounded-full opacity-90" />
          </div>
          <CardTitle className="text-3xl font-display italic uppercase tracking-tighter">SUIVI<span className="text-primary">NATATION</span></CardTitle>
          <CardDescription className="uppercase tracking-widest text-xs font-bold">Erstein Aquatic Club</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Input
                placeholder="Votre Nom (ex: Camille)"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (showRegister) {
                    setShowRegister(false);
                  }
                }}
                className="text-center text-lg h-12 border-2 focus-visible:ring-primary"
                autoFocus
              />
              <p className="text-xs text-muted-foreground text-center">
                Saisissez votre identifiant et votre mot de passe.
              </p>
              <Input
                placeholder="Mot de passe"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                ref={passwordInputRef}
                className="text-center text-lg h-12 border-2 focus-visible:ring-primary"
              />
              {error ? (
                <p className="text-sm text-destructive text-center">{error}</p>
              ) : null}
            </div>
            <Button
              type="submit"
              className="w-full h-12 text-lg font-bold uppercase tracking-wider shadow-md hover:scale-[1.02] transition-transform"
              disabled={!name.trim() || !password.trim() || isSubmitting}
            >
              {isSubmitting ? "Connexion..." : "CONNEXION"}
            </Button>
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => {
                  setShowRegister(true);
                  const trimmedName = name.trim();
                  setRegisterName(trimmedName);
                  setRegisterEmail(trimmedName.includes("@") ? trimmedName : "");
                }}
                className="text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                Créer un compte
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
        }
      }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Créer un compte</DialogTitle>
            <DialogDescription>
              Ce compte n'existe pas encore. Complétez les informations pour créer votre profil.
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
                const url = resolveAuthUrl("auth_register", setRegisterError);
                if (!url) {
                  throw new Error(AUTH_ENDPOINT_MISSING_MESSAGE);
                }
                const res = await fetch(url, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    identifier: registerName.trim(),
                    email: registerEmail.trim() || undefined,
                    password: registerPassword,
                    birthdate: registerBirthdate,
                    group_id: Number(registerGroupId),
                  }),
                });
                const payload = await res.json();
                if (!res.ok || payload?.ok !== true) {
                  const message = payload?.error || `Erreur ${res.status}`;
                  throw new Error(message);
                }
                const { user, access_token: accessToken, refresh_token: refreshToken } = payload.data || {};
                if (!accessToken || !refreshToken) {
                  throw new Error("Tokens manquants dans la réponse.");
                }
                const displayName = user?.display_name || registerName.trim();
                const rawUserId = Number(user?.id);
                const userId = Number.isFinite(rawUserId) ? rawUserId : null;
                login({ user: displayName, accessToken, refreshToken, userId, role: user?.role ?? null });
                const hydrated = await loadUser();
                if (!hydrated) {
                  throw new Error("Impossible de récupérer le profil utilisateur.");
                }
                setShowRegister(false);
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
              <Label htmlFor="register-birthdate">Date de naissance</Label>
              <Input
                id="register-birthdate"
                type="date"
                value={registerBirthdate}
                onChange={(event) => setRegisterBirthdate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Groupe</Label>
              <Select
                value={registerGroupId}
                onValueChange={setRegisterGroupId}
                disabled={groupsLoading || groups.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={groupsLoading ? "Chargement..." : "Sélectionnez un groupe"} />
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
            <div className="space-y-2">
              <Label htmlFor="register-email">Email (optionnel)</Label>
              <Input
                id="register-email"
                type="email"
                value={registerEmail}
                onChange={(event) => setRegisterEmail(event.target.value)}
                placeholder="ex: prenom.nom@email.com"
              />
            </div>
            {registerError ? (
              <p className="text-sm text-destructive">{registerError}</p>
            ) : null}
            <Button type="submit" className="w-full" disabled={isRegistering || !registerName.trim()}>
              {isRegistering ? "Création..." : "Créer le compte"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      
      <div className="absolute bottom-4 text-xs text-muted-foreground opacity-50 uppercase font-bold tracking-widest">
        EAC Performance Tracking
      </div>
    </div>
  );
}
