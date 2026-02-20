
import { useLocation } from "wouter";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import eacLogo from "@assets/logo-eac.png";
import { getNavItemsForRole } from "@/components/layout/navItems";
import { OfflineDetector } from "@/components/shared/OfflineDetector";
import { InstallPrompt } from "@/components/shared/InstallPrompt";

/** Fired when user taps the nav icon for the page they're already on. */
export const NAV_RESET_EVENT = "nav:reset";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const { role } = useAuth();
  const [isFocusMode, setIsFocusMode] = useState(false);
  const navItems = getNavItemsForRole(role);

  const handleNavClick = useCallback((href: string) => {
    if (location === href) {
      // Already on this page — reset to home state
      window.dispatchEvent(new CustomEvent(NAV_RESET_EVENT));
      window.scrollTo(0, 0);
    } else {
      navigate(href);
    }
  }, [location, navigate]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

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
      <OfflineDetector />
      <InstallPrompt />
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
            <button
              key={item.href}
              type="button"
              onClick={() => handleNavClick(item.href)}
              className={cn(
                "flex items-center gap-2 text-sm font-bold uppercase transition-colors hover:text-primary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-sm",
                location === item.href ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
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
              <button
                key={item.href}
                type="button"
                onClick={() => handleNavClick(item.href)}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2 flex-1 min-w-0 max-w-[72px] transition-colors relative active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground active:text-foreground"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center h-7 w-7 rounded-xl transition-colors",
                  isActive && "bg-primary/10"
                )}>
                  <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
                </div>
                <span className={cn(
                  "text-[10px] font-semibold tracking-tight truncate w-full text-center px-0.5",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
