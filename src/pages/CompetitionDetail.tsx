import { useState, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Trophy,
  MapPin,
  CalendarDays,
  ListChecks,
  Timer,
  Clock,
  Repeat,
} from "lucide-react";

/* ── Helpers ──────────────────────────────────────────────── */

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function formatDateRange(start: string, end?: string | null): string {
  if (!end || end === start) return formatDate(start);
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()} – ${e.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`;
  }
  return `${formatDate(start)} – ${formatDate(end)}`;
}

function daysUntil(iso: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(iso + "T00:00:00");
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function countdownBadge(days: number): { label: string; variant: "default" | "secondary" | "outline" } {
  if (days < 0) return { label: "Terminée", variant: "outline" };
  if (days === 0) return { label: "Aujourd'hui", variant: "default" };
  return { label: `J-${days}`, variant: "secondary" };
}

/* ── Placeholder cards ────────────────────────────────────── */

function PlaceholderSection({
  icon,
  title,
  description,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  items: string[];
}) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card/60 p-5">
      <div className="flex items-center gap-2.5 text-muted-foreground">
        {icon}
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{description}</p>
      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <div
            key={item}
            className="flex items-center gap-2.5 rounded-2xl border border-border/60 bg-muted/30 px-3 py-2.5"
          >
            <div className="h-2 w-2 rounded-full bg-muted-foreground/20 shrink-0" />
            <span className="text-xs text-muted-foreground">{item}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-xl bg-primary/5 border border-primary/10 px-3 py-2.5 text-center">
        <span className="text-[11px] font-medium text-primary">Bientôt disponible</span>
      </div>
    </div>
  );
}

/* ── Tab types ────────────────────────────────────────────── */

type CompetitionTab = "courses" | "routines" | "timeline" | "checklist";

/* ── Main component ───────────────────────────────────────── */

export default function CompetitionDetail() {
  const [, params] = useRoute("/competition/:id");
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<CompetitionTab>("courses");

  const competitionId = params?.id ?? null;

  const { data: competitions = [] } = useQuery({
    queryKey: ["competitions"],
    queryFn: () => api.getCompetitions(),
  });

  const competition = useMemo(
    () => competitions.find((c) => c.id === competitionId) ?? null,
    [competitions, competitionId],
  );

  const days = competition ? daysUntil(competition.date) : null;
  const badge = days != null ? countdownBadge(days) : null;

  if (!competition) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-4">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="h-9 w-9 rounded-xl border border-border bg-card flex items-center justify-center hover:bg-muted transition"
          aria-label="Retour"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="mt-8 text-center">
          <Trophy className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium">Compétition introuvable</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Elle a peut-être été supprimée.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 space-y-4">
      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="mt-0.5 h-9 w-9 rounded-xl border border-border bg-card flex items-center justify-center hover:bg-muted transition shrink-0"
          aria-label="Retour"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold truncate">{competition.name}</h1>
            {badge && (
              <Badge variant={badge.variant} className="text-[10px] px-2 py-0.5 shrink-0">
                {badge.label}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {formatDateRange(competition.date, competition.end_date)}
            </span>
            {competition.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {competition.location}
              </span>
            )}
          </div>

          {competition.description && (
            <p className="text-xs text-muted-foreground/80 line-clamp-2">
              {competition.description}
            </p>
          )}
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CompetitionTab)}>
        <TabsList className="grid h-auto w-full grid-cols-4 gap-1.5 bg-transparent p-0">
          <TabsTrigger
            value="courses"
            className="rounded-xl border bg-card px-2 py-2 text-[11px] data-[state=active]:border-amber-500 data-[state=active]:bg-amber-500/5 data-[state=active]:text-amber-700 dark:data-[state=active]:text-amber-300"
          >
            <Trophy className="mr-1 h-3 w-3" />
            Courses
          </TabsTrigger>
          <TabsTrigger
            value="routines"
            className="rounded-xl border bg-card px-2 py-2 text-[11px] data-[state=active]:border-blue-500 data-[state=active]:bg-blue-500/5 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-300"
          >
            <Repeat className="mr-1 h-3 w-3" />
            Routines
          </TabsTrigger>
          <TabsTrigger
            value="timeline"
            className="rounded-xl border bg-card px-2 py-2 text-[11px] data-[state=active]:border-emerald-500 data-[state=active]:bg-emerald-500/5 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-300"
          >
            <Timer className="mr-1 h-3 w-3" />
            Jour J
          </TabsTrigger>
          <TabsTrigger
            value="checklist"
            className="rounded-xl border bg-card px-2 py-2 text-[11px] data-[state=active]:border-violet-500 data-[state=active]:bg-violet-500/5 data-[state=active]:text-violet-700 dark:data-[state=active]:text-violet-300"
          >
            <ListChecks className="mr-1 h-3 w-3" />
            Check
          </TabsTrigger>
        </TabsList>

        {/* ── Courses tab ─────────────────────────────────── */}
        <TabsContent value="courses" className="mt-4">
          <PlaceholderSection
            icon={<Trophy className="h-4 w-4 text-amber-500" />}
            title="Mes courses"
            description="Configure tes épreuves pour cette compétition : nage, distance et heure de passage."
            items={[
              "Ajouter une course (ex : 100m NL à 14h30)",
              "Modifier ou supprimer une course",
              "Vue récap de toutes tes épreuves",
            ]}
          />
        </TabsContent>

        {/* ── Routines tab ────────────────────────────────── */}
        <TabsContent value="routines" className="mt-4">
          <PlaceholderSection
            icon={<Repeat className="h-4 w-4 text-blue-500" />}
            title="Routines pré-course"
            description="Définis ta routine avant chaque course : échauffement, combinaison, concentration..."
            items={[
              "Étapes relatives à l'heure de course (ex : -60min, -20min)",
              "Sauvegarder en template réutilisable",
              "Appliquer un template à une autre course",
            ]}
          />
        </TabsContent>

        {/* ── Timeline tab ────────────────────────────────── */}
        <TabsContent value="timeline" className="mt-4">
          <PlaceholderSection
            icon={<Clock className="h-4 w-4 text-emerald-500" />}
            title="Timeline du jour"
            description="Vue chronologique de ta journée : toutes tes courses et étapes de routine fusionnées par heure."
            items={[
              "Sélection du jour (multi-jours)",
              "Heures absolues calculées automatiquement",
              "Rappels visuels pour chaque étape",
            ]}
          />
        </TabsContent>

        {/* ── Checklist tab ───────────────────────────────── */}
        <TabsContent value="checklist" className="mt-4">
          <PlaceholderSection
            icon={<ListChecks className="h-4 w-4 text-violet-500" />}
            title="Checklist"
            description="Prépare ta compétition avec une liste de vérification personnalisée."
            items={[
              "Créer et cocher des items",
              "Sauvegarder en template réutilisable",
              "Barre de progression",
            ]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
