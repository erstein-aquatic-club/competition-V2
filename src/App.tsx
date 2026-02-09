
import React, { Suspense, lazy, useState, useEffect, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { Switch, Route, Redirect, Router } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth, handlePasswordReset } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { AppLayout } from "@/components/layout/AppLayout";
import { FEATURES } from "@/lib/features";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Retry wrapper for lazy imports — handles stale chunk filenames after deployments
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyWithRetry(factory: () => Promise<{ default: React.ComponentType<any> }>) {
  return lazy(() =>
    factory().catch((err: unknown) => {
      // If chunk loading fails (e.g. stale cache pointing to old filename),
      // try a full page reload once to get fresh index.html
      const hasReloaded = sessionStorage.getItem('chunk_reload');
      if (!hasReloaded) {
        sessionStorage.setItem('chunk_reload', '1');
        window.location.reload();
        // Return a never-resolving promise to prevent rendering while reloading
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return new Promise<{ default: React.ComponentType<any> }>(() => {});
      }
      sessionStorage.removeItem('chunk_reload');
      throw err;
    })
  );
}

// Clear the reload flag on successful app load
sessionStorage.removeItem('chunk_reload');

// Error Boundary — catches runtime errors and chunk loading failures
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  isChunkError: boolean;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null, isChunkError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const isChunkError = /loading.*(chunk|module)|failed to fetch/i.test(error.message);
    return { hasError: true, error, isChunkError };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[EAC] Error Boundary caught:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="text-4xl">{this.state.isChunkError ? '\u26A0\uFE0F' : '\u274C'}</div>
          <h2 className="text-lg font-semibold">
            {this.state.isChunkError
              ? 'Mise à jour disponible'
              : 'Une erreur est survenue'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {this.state.isChunkError
              ? "L'application a été mise à jour. Rechargez la page pour continuer."
              : (this.state.error?.message || 'Erreur inconnue')}
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
            >
              Recharger
            </button>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null, isChunkError: false });
                window.location.hash = '#/';
              }}
              className="px-4 py-2 rounded-lg bg-muted text-muted-foreground text-sm font-medium"
            >
              Retour accueil
            </button>
          </div>
        </div>
      </div>
    );
  }
}

// Lazy load all pages for code splitting (with retry for stale chunks)
const Login = lazyWithRetry(() => import("@/pages/Login"));
const Dashboard = lazyWithRetry(() => import("@/pages/Dashboard"));
const Progress = lazyWithRetry(() => import("@/pages/Progress"));
const HallOfFame = lazyWithRetry(() => import("@/pages/HallOfFame"));
const Coach = lazyWithRetry(() => import("@/pages/Coach"));
const Admin = lazyWithRetry(() => import("@/pages/Admin"));
const Administratif = lazyWithRetry(() => import("@/pages/Administratif"));
const Comite = lazyWithRetry(() => import("@/pages/Comite"));
const Strength = lazyWithRetry(() => import("@/pages/Strength"));
const Profile = lazyWithRetry(() => import("@/pages/Profile"));
const Records = lazyWithRetry(() => import("@/pages/Records"));
const RecordsAdmin = lazyWithRetry(() => import("@/pages/RecordsAdmin"));
const RecordsClub = lazyWithRetry(() => import("@/pages/RecordsClub"));
const Notifications = lazyWithRetry(() => import("@/pages/Notifications"));
const SwimSessionView = lazyWithRetry(() => import("@/pages/SwimSessionView"));
const ComingSoon = lazyWithRetry(() => import("@/pages/ComingSoon"));
const NotFound = lazyWithRetry(() => import("@/pages/not-found"));

// Loading fallback for lazy components
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}

const useHashLocation = (): [string, (to: string, options?: { replace?: boolean }) => void] => {
  const getHashPath = () => {
    const hash = window.location.hash || "#/";
    return hash.replace(/^#/, "") || "/";
  };

  const [path, setPath] = React.useState(getHashPath);

  React.useEffect(() => {
    const onHashChange = () => setPath(getHashPath());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navigate = React.useCallback((to: string, options?: { replace?: boolean }) => {
    const target = to.startsWith("/") ? `#${to}` : `#/${to}`;
    if (options?.replace) {
      window.location.replace(target);
    } else {
      window.location.hash = target;
    }
  }, []);

  return [path, navigate];
};

function ResetPassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    setError(null);
    const result = await handlePasswordReset(newPassword);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
      setTimeout(() => {
        window.location.hash = "#/";
      }, 2000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-sm shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Nouveau mot de passe</CardTitle>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <span className="text-3xl text-primary">&#10003;</span>
              </div>
              <p className="text-sm font-medium">Mot de passe modifié avec succès</p>
              <p className="text-xs text-muted-foreground">Redirection en cours...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nouveau mot de passe</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nouveau mot de passe"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirmer le mot de passe"
                  required
                />
              </div>
              {error ? (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive text-center">
                  {error}
                </div>
              ) : null}
              <Button
                type="submit"
                className="w-full"
                disabled={!newPassword || !confirmPassword || loading}
              >
                {loading ? "Modification..." : "Modifier le mot de passe"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AppRouter() {
  const { user } = useAuth();
  const isApproved = useAuth((s) => s.isApproved);

  if (!user) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Switch>
            <Route path="/reset-password" component={ResetPassword} />
            <Route path="/" component={Login} />
            <Route path="/:rest*" component={() => <Redirect to="/" />} />
          </Switch>
        </Suspense>
      </ErrorBoundary>
    );
  }

  if (user && isApproved === false) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="text-4xl">&#9203;</div>
            <h2 className="text-xl font-semibold">En attente de validation</h2>
            <p className="text-sm text-muted-foreground">
              Votre compte a été créé mais doit être validé par un coach ou un administrateur.
            </p>
            <Button variant="outline" onClick={() => useAuth.getState().logout()}>
              Se déconnecter
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AppLayout>
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Switch>
            <Route path="/reset-password" component={ResetPassword} />
            <Route path="/" component={Dashboard} />
            <Route path="/progress" component={Progress} />
            <Route path="/hall-of-fame" component={FEATURES.hallOfFame ? HallOfFame : ComingSoon} />
            <Route path="/coach" component={Coach} />
            <Route path="/admin" component={Admin} />
            <Route path="/administratif" component={Administratif} />
            <Route path="/comite" component={Comite} />
            <Route path="/strength" component={FEATURES.strength ? Strength : ComingSoon} />
            <Route path="/records" component={Records} />
            <Route path="/records-admin" component={RecordsAdmin} />
            <Route path="/records-club" component={RecordsClub} />
            <Route path="/swim-session" component={SwimSessionView} />
            <Route path="/profile" component={Profile} />
            <Route path="/notifications" component={Notifications} />
            <Route path="/coming-soon" component={ComingSoon} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </ErrorBoundary>
    </AppLayout>
  );
}

function App() {
  const { loadUser } = useAuth();

  React.useEffect(() => {
    void loadUser();
  }, [loadUser]);

  // Detect Supabase recovery tokens in the URL hash
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      // Supabase puts tokens as: #access_token=...&refresh_token=...&type=recovery
      // Remove leading '#' for URLSearchParams parsing
      const rawParams = hash.substring(1);
      const params = new URLSearchParams(rawParams);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const type = params.get('type');

      if (type === 'recovery' && accessToken && refreshToken) {
        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        }).then(({ error }) => {
          if (!error) {
            window.location.hash = '#/reset-password';
          }
        });
      }
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router hook={useHashLocation}>
          <AppRouter />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
