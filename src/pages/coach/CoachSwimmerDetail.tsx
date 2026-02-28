import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CalendarClock, CalendarRange, Clock, MessageSquare, Target } from "lucide-react";
import SwimmerFeedbackTab from "./SwimmerFeedbackTab";
import SwimmerObjectivesTab from "./SwimmerObjectivesTab";
import SwimmerPlanningTab from "./SwimmerPlanningTab";
import SwimmerInterviewsTab from "./SwimmerInterviewsTab";
import SwimmerSlotsTab from "@/components/coach/SwimmerSlotsTab";

type CoachSwimmerDetailProps = {
  athleteId?: number | null;
  athleteName?: string | null;
  onBack?: () => void;
};

type CoachSwimmerTab = "resume" | "suivi" | "echanges" | "planif";

export default function CoachSwimmerDetail({
  athleteId: athleteIdProp,
  athleteName: athleteNameProp,
  onBack,
}: CoachSwimmerDetailProps = {}) {
  const [, params] = useRoute("/coach/swimmer/:id");
  const [, navigate] = useLocation();
  const { selectedAthleteId, selectedAthleteName } = useAuth();
  const [activeTab, setActiveTab] = useState<CoachSwimmerTab>("resume");

  const athleteId =
    athleteIdProp ?? (params?.id ? Number(params.id) : selectedAthleteId);
  const athleteName = athleteNameProp ?? selectedAthleteName;

  const { data: profile } = useQuery({
    queryKey: ["profile", athleteId],
    queryFn: () => api.getProfile({ userId: athleteId }),
    enabled: athleteId != null,
  });

  const displayName = profile?.display_name ?? athleteName ?? "Nageur";
  const avatarUrl = profile?.avatar_url ?? null;
  const groupLabel = profile?.group_label ?? null;
  const handleBack = onBack ?? (() => navigate("/coach?section=swimmers"));

  if (!athleteId) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>Aucun nageur sélectionné.</p>
        <button type="button" onClick={handleBack} className="mt-2 text-primary underline">
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
          onClick={handleBack}
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

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as CoachSwimmerTab)}>
        <TabsList className="grid h-auto w-full grid-cols-2 gap-2 bg-transparent p-0">
          <TabsTrigger value="resume" className="rounded-xl border bg-card px-3 py-2 text-xs data-[state=active]:border-primary data-[state=active]:bg-primary/5">
            Résumé
          </TabsTrigger>
          <TabsTrigger value="suivi" className="rounded-xl border bg-card px-3 py-2 text-xs data-[state=active]:border-primary data-[state=active]:bg-primary/5">
            Suivi
          </TabsTrigger>
          <TabsTrigger value="echanges" className="rounded-xl border bg-card px-3 py-2 text-xs data-[state=active]:border-primary data-[state=active]:bg-primary/5">
            Échanges
          </TabsTrigger>
          <TabsTrigger value="planif" className="rounded-xl border bg-card px-3 py-2 text-xs data-[state=active]:border-primary data-[state=active]:bg-primary/5">
            Planif
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resume" className="mt-4 space-y-3">
          <div className="rounded-2xl border bg-card p-4">
            <p className="text-sm font-semibold">Vue rapide</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Accès direct au suivi, aux entretiens et à la planification de {displayName}.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("suivi")}
                className="rounded-xl border px-3 py-3 text-left active:bg-muted"
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Suivi
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Ressentis et objectifs</p>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("echanges")}
                className="rounded-xl border px-3 py-3 text-left active:bg-muted"
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  Échanges
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Entretiens du nageur</p>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("planif")}
                className="rounded-xl border px-3 py-3 text-left active:bg-muted"
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <CalendarRange className="h-4 w-4 text-muted-foreground" />
                  Planif
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Cycles et créneaux</p>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("suivi")}
                className="rounded-xl border px-3 py-3 text-left active:bg-muted"
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  Objectifs
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Temps cibles et cap</p>
              </button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="suivi" className="mt-4 space-y-4">
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Ressentis</h2>
            </div>
            <SwimmerFeedbackTab athleteId={athleteId} athleteName={displayName} showProgressAction={false} />
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Objectifs</h2>
            </div>
            <SwimmerObjectivesTab athleteId={athleteId} athleteName={displayName} />
          </section>
        </TabsContent>

        <TabsContent value="echanges" className="mt-4 space-y-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Entretiens</h2>
          </div>
          <SwimmerInterviewsTab athleteId={athleteId} athleteName={displayName} />
        </TabsContent>

        <TabsContent value="planif" className="mt-4 space-y-4">
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Cycle</h2>
            </div>
            <SwimmerPlanningTab athleteId={athleteId} />
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Créneaux</h2>
            </div>
            <SwimmerSlotsTab
              athleteId={athleteId}
              athleteName={displayName}
              groupId={profile?.group_id ?? 0}
            />
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
