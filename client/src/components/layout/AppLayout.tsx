
import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import eacLogo from "@assets/logo-eac.png";
import { getNavItemsForRole } from "@/components/layout/navItems";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { role, userId, user } = useAuth();
  const [isFocusMode, setIsFocusMode] = useState(false);
  const navItems = getNavItemsForRole(role);
  const { data: notificationsResult } = useQuery({
    queryKey: ["notifications", userId, user, "threads"],
    queryFn: () =>
      api.notifications_list({
        targetUserId: userId,
        targetAthleteName: user,
        limit: 200,
        offset: 0,
        type: "message",
        order: "desc",
      }),
    enabled: Boolean(userId),
  });
  const unreadCount = notificationsResult?.notifications?.filter((notification) => !notification.read).length ?? 0;

  useEffect(() => {
    if (typeof document === "undefined") return;
    const updateFocusMode = () => {
      setIsFocusMode(document.body.dataset.focusMode === "strength");
    };
    updateFocusMode();
    const observer = new MutationObserver(updateFocusMode);
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-focus-mode"] });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pt-16">
      {/* Desktop Top Nav */}
      <header className="hidden md:flex fixed top-0 w-full h-16 border-b bg-card/95 backdrop-blur z-50 items-center px-8 justify-between shadow-sm">
        <div className="flex items-center gap-2">
            <img
              src={eacLogo}
              alt="Logo EAC"
              className="h-8 w-8 rounded-full border-2 border-black object-cover"
            />
            <div className="font-display font-bold text-2xl text-foreground italic tracking-tighter">
            SUIVI<span className="text-primary">NATATION</span>
            </div>
        </div>
        <nav className="flex gap-6">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <a className={cn(
                "flex items-center gap-2 text-sm font-bold uppercase transition-colors hover:text-primary",
                location === item.href ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
              )}>
                <item.icon className="h-4 w-4" />
                {item.label}
              </a>
            </Link>
          ))}
        </nav>
      </header>

      {/* Main Content */}
      <main className="container max-w-md mx-auto p-4 md:max-w-3xl lg:max-w-4xl animate-in fade-in duration-300">
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav
        className={cn(
          "md:hidden fixed bottom-0 left-0 w-full h-16 bg-card border-t border-border/50 z-50 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]",
          isFocusMode && "hidden",
        )}
      >
        <div className="grid grid-flow-col auto-cols-fr items-center gap-1 px-2 w-full">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <a className={cn(
                "flex flex-col items-center justify-center h-full min-h-16 gap-1 transition-colors relative",
                location === item.href ? "text-primary" : "text-muted-foreground"
              )}>
                <item.icon className={cn("h-5 w-5", location === item.href && "fill-current/20")} />
                {item.label === "Messagerie" && unreadCount > 0 && (
                    <span className="absolute top-2 right-3 h-2 w-2 rounded-full bg-primary animate-pulse" />
                )}
                <span className="sr-only">{item.label}</span>
              </a>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
