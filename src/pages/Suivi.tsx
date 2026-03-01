import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import AthletePerformanceHub from "@/components/profile/AthletePerformanceHub";

function readTabFromHash(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const hash = window.location.hash;
  const match = hash.match(/[?&]tab=([^&]+)/);
  return match?.[1] || undefined;
}

export default function Suivi() {
  const user = useAuth((s) => s.user);
  const userId = useAuth((s) => s.userId);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user, userId],
    queryFn: () => api.getProfile({ displayName: user, userId }),
    enabled: !!user,
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["profile-groups"],
    queryFn: () => api.getGroups(),
    enabled: !!user,
  });

  const groupLabel =
    groups.find((g) => g.id === profile?.group_id)?.name ||
    profile?.group_label ||
    null;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-4">
        <Skeleton className="h-28 rounded-3xl" />
        <Skeleton className="h-12 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <AthletePerformanceHub
      athleteId={userId ?? 0}
      athleteName={profile?.display_name || user || "Nageur"}
      groupLabel={groupLabel}
      standalone
      defaultTab={readTabFromHash()}
    />
  );
}
