import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, Target, CalendarRange, MessageSquare } from "lucide-react";
import SwimmerFeedbackTab from "./SwimmerFeedbackTab";
import SwimmerObjectivesTab from "./SwimmerObjectivesTab";
import SwimmerPlanningTab from "./SwimmerPlanningTab";

export default function CoachSwimmerDetail() {
  const [, params] = useRoute("/coach/swimmer/:id");
  const [, navigate] = useLocation();
  const { selectedAthleteId, selectedAthleteName } = useAuth();

  const athleteId = params?.id ? Number(params.id) : selectedAthleteId;
  const athleteName = selectedAthleteName;

  const { data: profile } = useQuery({
    queryKey: ["profile", athleteId],
    queryFn: () => api.getProfile({ userId: athleteId }),
    enabled: athleteId != null,
  });

  const displayName = profile?.display_name ?? athleteName ?? "Nageur";
  const avatarUrl = profile?.avatar_url ?? null;
  const groupLabel = profile?.group_label ?? null;

  if (!athleteId) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>Aucun nageur sélectionné.</p>
        <button type="button" onClick={() => navigate("/coach?section=swimmers")} className="mt-2 text-primary underline">
          Retour au dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/coach?section=swimmers")}
          className="h-9 w-9 rounded-xl border border-border bg-card flex items-center justify-center hover:bg-muted transition"
          aria-label="Retour"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover border border-border" />
        ) : (
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold truncate">{displayName}</h1>
          {groupLabel && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {groupLabel}
            </Badge>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="ressentis">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="ressentis" className="text-xs gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Ressentis</span>
          </TabsTrigger>
          <TabsTrigger value="objectifs" className="text-xs gap-1">
            <Target className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Objectifs</span>
          </TabsTrigger>
          <TabsTrigger value="planification" className="text-xs gap-1">
            <CalendarRange className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Planif.</span>
          </TabsTrigger>
          <TabsTrigger value="entretiens" className="text-xs gap-1">
            <MessageSquare className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Entretiens</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ressentis" className="mt-4">
          <SwimmerFeedbackTab athleteId={athleteId} athleteName={displayName} />
        </TabsContent>

        <TabsContent value="objectifs" className="mt-4">
          <SwimmerObjectivesTab athleteId={athleteId} athleteName={displayName} />
        </TabsContent>

        <TabsContent value="planification" className="mt-4">
          <SwimmerPlanningTab athleteId={athleteId} />
        </TabsContent>

        <TabsContent value="entretiens" className="mt-4">
          <div className="rounded-2xl border border-dashed border-border p-6 text-center">
            <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">Bientôt disponible</p>
            <p className="text-xs text-muted-foreground mt-1">Comptes-rendus structurés d'entretiens individuels avec liens vers objectifs et planification.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
