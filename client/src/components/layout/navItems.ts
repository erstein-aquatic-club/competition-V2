import { Waves, TrendingUp, Trophy, User, Dumbbell, MessageSquare, Settings, FileText, Users, type LucideIcon } from "lucide-react";
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
      { href: "/notifications", icon: MessageSquare, label: "Messagerie" },
      { href: "/administratif", icon: FileText, label: "Administratif" },
      { href: "/profile", icon: User, label: "Profil" },
      { href: "/comite", icon: Users, label: "Comité" },
    ];
  }
  if (normalizedRole === "coach") {
    return [
      { href: "/coach", icon: Users, label: "Coach" },
      { href: "/notifications", icon: MessageSquare, label: "Messagerie" },
      { href: "/administratif", icon: FileText, label: "Administratif" },
      { href: "/profile", icon: User, label: "Profil" },
    ];
  }
  return [
    { href: "/", icon: Waves, label: "Séance" },
    { href: "/progress", icon: TrendingUp, label: "Progression" },
    { href: FEATURES.strength ? "/strength" : "/coming-soon", icon: Dumbbell, label: "Muscu" },
    { href: "/notifications", icon: MessageSquare, label: "Messagerie" },
    { href: FEATURES.hallOfFame ? "/hall-of-fame" : "/coming-soon", icon: Trophy, label: "H.O.F" },
    { href: "/profile", icon: User, label: "Profil" },
  ];
};
