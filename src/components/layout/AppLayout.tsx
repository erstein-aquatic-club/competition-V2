
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
    <div className="min-h-screen bg-background pb-20 supports-[padding:env(safe-area-inset-bottom)]:pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0 md:pt-16">
      {/* Desktop Top Nav */}
      <header className="hidden md:flex fixed top-0 w-full h-16 border-b bg-card/95 backdrop-blur z-nav items-center px-8 justify-between shadow-sm">
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
                "flex items-center gap-2 text-sm font-bold uppercase transition-colors hover:text-primary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-sm",
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
      <main className="container max-w-lg mx-auto p-4 md:max-w-3xl lg:max-w-4xl">
        {children}
      </main>

      {/* Mobile Bottom Nav - Enhanced for accessibility */}
      <nav
        aria-label="Navigation principale"
        className={cn(
          "md:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border/50 z-mobilenav shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.1)]",
          "supports-[padding:env(safe-area-inset-bottom)]:pb-[env(safe-area-inset-bottom)]",
          isFocusMode && "hidden",
        )}
      >
        <div className="flex items-stretch justify-evenly h-16 overflow-x-auto scrollbar-hide">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <a className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2 flex-1 min-w-0 max-w-[72px] transition-colors relative active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg",
                  isActive 
                    ? "text-primary" 
                    : "text-muted-foreground active:text-foreground"
                )}>
                  <div className={cn(
                    "flex items-center justify-center h-7 w-7 rounded-xl transition-colors",
                    isActive && "bg-primary/10"
                  )}>
                    <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
                  </div>
                  {item.label === "Messagerie" && unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1/2 translate-x-4 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-card animate-pulse motion-reduce:animate-none" aria-label={`${unreadCount} messages non lus`} />
                  )}
                  <span className={cn(
                    "text-[10px] font-semibold tracking-tight truncate w-full text-center px-0.5",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}>
                    {item.label}
                  </span>
                </a>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
