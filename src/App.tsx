
import React, { Suspense } from "react";
import { Switch, Route, Redirect, Router } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/layout/AppLayout";

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import ComingSoon from "@/pages/ComingSoon";
import NotFound from "@/pages/not-found";
import { FEATURES } from "@/lib/features";

const Progress = React.lazy(() => import("@/pages/Progress"));
const HallOfFame = React.lazy(() => import("@/pages/HallOfFame"));
const Coach = React.lazy(() => import("@/pages/Coach"));
const Admin = React.lazy(() => import("@/pages/Admin"));
const Administratif = React.lazy(() => import("@/pages/Administratif"));
const Comite = React.lazy(() => import("@/pages/Comite"));
const Strength = React.lazy(() => import("@/pages/Strength"));
const Profile = React.lazy(() => import("@/pages/Profile"));
const Records = React.lazy(() => import("@/pages/Records"));
const RecordsAdmin = React.lazy(() => import("@/pages/RecordsAdmin"));
const RecordsClub = React.lazy(() => import("@/pages/RecordsClub"));
const Notifications = React.lazy(() => import("@/pages/Notifications"));
const SwimSessionView = React.lazy(() => import("@/pages/SwimSessionView"));

function LazyFallback() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
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

function AppRouter() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Switch>
        <Route path="/" component={Login} />
        <Route path="/:rest*" component={() => <Redirect to="/" />} />
      </Switch>
    );
  }

  return (
    <AppLayout>
      <Suspense fallback={<LazyFallback />}>
        <Switch>
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
