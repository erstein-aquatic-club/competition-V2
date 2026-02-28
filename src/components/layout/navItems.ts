import { Waves, TrendingUp, Trophy, User, Dumbbell, Settings, FileText, Users, type LucideIcon } from "lucide-react";
import { FEATURES } from "@/lib/features";

type NavItem = {
  href: string;
  icon: LucideIcon;
  label: string;
};

export const getNavItemsForRole = (role: string | null): NavItem[] => {
  const normalizedRole = role ?? "athlete";
  if (normalizedRole === "admin") {
    return [
      { href: "/profile", icon: User, label: "Profil" },
      { href: "/admin", icon: Settings, label: "Gestion des comptes" },
    ];
  }
  if (normalizedRole === "comite") {
    return [
      { href: "/administratif", icon: FileText, label: "Administratif" },
      { href: "/profile", icon: User, label: "Profil" },
      { href: "/comite", icon: Users, label: "Comité" },
    ];
  }
  if (normalizedRole === "coach") {
    return [
      { href: "/coach", icon: Users, label: "Coach" },
      { href: "/administratif", icon: FileText, label: "Administratif" },
      { href: "/profile", icon: User, label: "Profil" },
    ];
  }
  const athleteItems: NavItem[] = [
    { href: "/", icon: Waves, label: "Accueil" },
    { href: "/progress", icon: TrendingUp, label: "Suivi" },
  ];

  if (FEATURES.strength) {
    athleteItems.push({ href: "/strength", icon: Dumbbell, label: "Muscu" });
  }

  if (FEATURES.hallOfFame) {
    athleteItems.push({ href: "/hall-of-fame", icon: Trophy, label: "Club" });
  }

  athleteItems.push({ href: "/profile", icon: User, label: "Profil" });

  return athleteItems;
};
