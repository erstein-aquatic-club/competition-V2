
import React from "react";
import { Switch, Route, Redirect, Router } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/layout/AppLayout";

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Progress from "@/pages/Progress";
import HallOfFame from "@/pages/HallOfFame";
import Coach from "@/pages/Coach";
import Admin from "@/pages/Admin";
import Administratif from "@/pages/Administratif";
import Comite from "@/pages/Comite";
import Strength from "@/pages/Strength";
import Profile from "@/pages/Profile";
import Records from "@/pages/Records";
import RecordsAdmin from "@/pages/RecordsAdmin";
import RecordsClub from "@/pages/RecordsClub";
import Notifications from "@/pages/Notifications";
import SwimSessionView from "@/pages/SwimSessionView";
import ComingSoon from "@/pages/ComingSoon";
import NotFound from "@/pages/not-found";
import { FEATURES } from "@/lib/features";

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
