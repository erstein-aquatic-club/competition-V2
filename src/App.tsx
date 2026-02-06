
import React, { Suspense, lazy } from "react";
import { Switch, Route, Redirect, Router } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/layout/AppLayout";
import { FEATURES } from "@/lib/features";

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

function AppRouter() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/" component={Login} />
          <Route path="/:rest*" component={() => <Redirect to="/" />} />
        </Switch>
      </Suspense>
    );
  }

  return (
    <AppLayout>
      <Suspense fallback={<PageLoader />}>
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
