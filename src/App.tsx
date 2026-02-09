
import React, { Suspense, lazy, useState, useEffect } from "react";
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

// Lazy load all pages for code splitting
const Login = lazy(() => import("@/pages/Login"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Progress = lazy(() => import("@/pages/Progress"));
const HallOfFame = lazy(() => import("@/pages/HallOfFame"));
const Coach = lazy(() => import("@/pages/Coach"));
const Admin = lazy(() => import("@/pages/Admin"));
const Administratif = lazy(() => import("@/pages/Administratif"));
const Comite = lazy(() => import("@/pages/Comite"));
const Strength = lazy(() => import("@/pages/Strength"));
const Profile = lazy(() => import("@/pages/Profile"));
const Records = lazy(() => import("@/pages/Records"));
const RecordsAdmin = lazy(() => import("@/pages/RecordsAdmin"));
const RecordsClub = lazy(() => import("@/pages/RecordsClub"));
const Notifications = lazy(() => import("@/pages/Notifications"));
const SwimSessionView = lazy(() => import("@/pages/SwimSessionView"));
const ComingSoon = lazy(() => import("@/pages/ComingSoon"));
const NotFound = lazy(() => import("@/pages/not-found"));

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
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/reset-password" component={ResetPassword} />
          <Route path="/" component={Login} />
          <Route path="/:rest*" component={() => <Redirect to="/" />} />
        </Switch>
      </Suspense>
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
