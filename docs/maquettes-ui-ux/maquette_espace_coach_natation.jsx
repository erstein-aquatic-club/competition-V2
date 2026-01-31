import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Dumbbell,
  MessageSquare,
  Plus,
  Users,
  Waves,
} from "lucide-react";

/**
 * Maquette mobile-first (strict) pour l'Espace Coach.
 *
 * Contrainte:
 * - Sur mobile, la page "Coach" est déjà un onglet de l'app principale =>
 *   on NE recrée PAS un dock/bottom-nav interne.
 *
 * Navigation (option 1 choisie):
 * - Home Coach = root
 * - Toute section = drill-down depuis Home
 * - Retour ramène toujours au Home
 *
 * Priorités métier:
 * 1) Créer des séances de natation (puis les assigner)
 * 2) Suivre les KPIs des nageurs
 * 3) Créer des séances de musculation (puis les assigner)
 *
 * Contraintes UX demandées:
 * - Carte noire (en haut) = uniquement:
 *   - "Fatigue nageurs excessive" (liste réduite des nageurs à 5/5)
 *   - "Nageur le plus chargé" (1 seul nageur, charge max)
 * - "Par où commencer" = 3 cartes cliquables (sans numéros, sans boutons)
 * - Aucune logique / wording de "relance"
 */

type SessionType = "Natation" | "Muscu";

type Swimmer = {
  id: string;
  name: string;
  group: string;
  level: string;
};

type Session = {
  id: string;
  title: string;
  type: SessionType;
  focus: string;
};

type Assignment = {
  id: string;
  when: string;
  swimmer: string;
  session: string;
  status: "À faire" | "Fait";
};

type ScreenKey =
  | "home"
  | "library_natation"
  | "library_muscu"
  | "assign_natation"
  | "assign_muscu"
  | "swimmers"
  | "messages";

type ScreenState = { key: ScreenKey };

const MOCK_SWIMMERS: Swimmer[] = [
  { id: "cam", name: "Camille", group: "Avenir", level: "Débutant" },
  { id: "leo", name: "Léo", group: "Perf", level: "Intermédiaire" },
  { id: "ines", name: "Inès", group: "Perf", level: "Avancé" },
  { id: "nina", name: "Nina", group: "Avenir", level: "Intermédiaire" },
];

// Données mock "ressenti" (formulaire côté nageur)
// fatigue: 1 (faible) -> 5 (max)
// load: charge cumulée (ex: score hebdo)
const MOCK_WELLNESS: Record<string, { fatigue: 1 | 2 | 3 | 4 | 5; load: number }> = {
  cam: { fatigue: 5, load: 62 },
  leo: { fatigue: 3, load: 88 },
  ines: { fatigue: 5, load: 71 },
  nina: { fatigue: 2, load: 54 },
};

const MOCK_SESSIONS: Session[] = [
  { id: "s1", title: "Endurance — 2.2km", type: "Natation", focus: "Aérobie" },
  { id: "s2", title: "Vitesse — 1.6km", type: "Natation", focus: "Sprint" },
  { id: "s3", title: "Technique — Crawl", type: "Natation", focus: "Technique" },
  { id: "m1", title: "Gainage — 30min", type: "Muscu", focus: "Core" },
];

const MOCK_ASSIGNMENTS: Assignment[] = [
  {
    id: "a1",
    when: "Aujourd'hui",
    swimmer: "Camille",
    session: "Technique — Crawl",
    status: "À faire",
  },
  {
    id: "a2",
    when: "Demain",
    swimmer: "Inès",
    session: "Vitesse — 1.6km",
    status: "À faire",
  },
  {
    id: "a3",
    when: "Hier",
    swimmer: "Léo",
    session: "Endurance — 2.2km",
    status: "Fait",
  },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getSessionsByType(type: SessionType) {
  return MOCK_SESSIONS.filter((s) => s.type === type);
}

function assert(condition: unknown, message?: string) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function pushStack(stack: ScreenState[], next: ScreenState) {
  return [...stack, next];
}

function popStack(stack: ScreenState[]) {
  if (stack.length <= 1) return stack;
  return stack.slice(0, -1);
}

/**
 * Navigation "option 1": stack max 2
 *   [home] ou [home, section]
 */
function openScreen(_stack: ScreenState[], key: ScreenKey): ScreenState[] {
  if (key === "home") return [{ key: "home" }];
  return [{ key: "home" }, { key }];
}

function getFatiguedSwimmers(swimmers: Swimmer[]) {
  return swimmers.filter((s) => MOCK_WELLNESS[s.id]?.fatigue === 5);
}

function getMostLoadedSwimmer(swimmers: Swimmer[]) {
  const withLoad = swimmers.map((s) => ({ s, load: MOCK_WELLNESS[s.id]?.load ?? 0 }));
  withLoad.sort((a, b) => b.load - a.load);
  return withLoad[0];
}

// -----------------
// Self-tests (light)
// -----------------
(function runSelfTestsOnce() {
  if (typeof globalThis === "undefined") return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = globalThis;
  if (g.__COACH_MOCKUP_TESTED__) return;
  g.__COACH_MOCKUP_TESTED__ = true;

  // cx
  assert(cx("a", false, null, "b") === "a b", "cx should join truthy classes");

  // sessions filter
  const nat = getSessionsByType("Natation");
  const mus = getSessionsByType("Muscu");
  assert(nat.length > 0 && nat.every((s) => s.type === "Natation"), "Natation filter failed");
  assert(mus.length > 0 && mus.every((s) => s.type === "Muscu"), "Muscu filter failed");

  // wellness helpers
  const fatigued = getFatiguedSwimmers(MOCK_SWIMMERS);
  assert(fatigued.some((s) => s.id === "cam"), "fatigue helper should include cam");
  assert(fatigued.some((s) => s.id === "ines"), "fatigue helper should include ines");
  assert(fatigued.every((s) => MOCK_WELLNESS[s.id].fatigue === 5), "fatigued must be only 5/5");

  const mostLoaded = getMostLoadedSwimmer(MOCK_SWIMMERS);
  assert(!!mostLoaded && mostLoaded.s.id === "leo", "most loaded should be leo in mock");
  assert(
    mostLoaded.load === Math.max(...MOCK_SWIMMERS.map((s) => MOCK_WELLNESS[s.id].load)),
    "mostLoaded should match max load"
  );

  // data sanity
  assert(MOCK_SWIMMERS.length >= 2, "Need at least 2 swimmers in mock");
  assert(MOCK_ASSIGNMENTS.length >= 1, "Need at least 1 assignment in mock");

  // navigation stack helpers
  const st1: ScreenState[] = [{ key: "home" }];
  const st2 = pushStack(st1, { key: "assign_natation" });
  assert(st2.length === 2 && st2[1].key === "assign_natation", "pushStack failed");
  const st3 = popStack(st2);
  assert(st3.length === 1 && st3[0].key === "home", "popStack failed");
  const st4 = popStack(st1);
  assert(st4.length === 1, "popStack should not pop root");

  // openScreen helper
  const st5 = openScreen(st2, "messages");
  assert(
    st5.length === 2 && st5[0].key === "home" && st5[1].key === "messages",
    "openScreen should reset to [home, target]"
  );
})();

/**
 * Pour simuler le fait que l'app principale a déjà son propre tab bar,
 * on ajoute un padding-bottom "variable".
 * L'intégration peut définir:
 *   :root { --app-bottom-inset: 72px; }
 */
const PB_APP = "pb-[calc(24px+var(--app-bottom-inset,72px))]";

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-neutral-100 flex items-center justify-center p-4">
      <div className="w-[390px] max-w-full rounded-[2.25rem] bg-white shadow-xl ring-1 ring-neutral-200 overflow-hidden">
        {/* Status bar */}
        <div className="h-10 px-5 flex items-center justify-between text-xs text-neutral-600 bg-white">
          <span className="font-medium">10:09</span>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500/80" />
            <span className="font-medium">100%</span>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function TopBar({
  title,
  subtitle,
  onBack,
  onOpenQuickActions,
  onOpenMessages,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onOpenQuickActions: () => void;
  onOpenMessages: () => void;
}) {
  return (
    <div className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-neutral-200">
      <div className="px-4 py-3 flex items-start gap-3">
        <div className="flex items-start gap-2 flex-1">
          {onBack ? (
            <Button
              variant="outline"
              size="icon"
              className="rounded-xl shrink-0"
              onClick={onBack}
              aria-label="Retour"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : null}
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight text-neutral-900 truncate">
              {title}
            </div>
            {subtitle ? (
              <div className="text-xs text-neutral-500 mt-0.5 truncate">{subtitle}</div>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="rounded-xl"
            onClick={onOpenMessages}
            aria-label="Messagerie"
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="rounded-xl"
            onClick={onOpenQuickActions}
            aria-label="Actions rapides"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  right,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="px-4 mt-4 mb-2 flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
        {Icon ? <Icon className="h-4 w-4 text-neutral-700" /> : null}
        <span>{title}</span>
      </div>
      {right}
    </div>
  );
}

function PrimaryActionCard({
  title,
  subtitle,
  icon: Icon,
  onOpen,
}: {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left"
      aria-label={`Ouvrir ${title}`}
    >
      <Card className="rounded-3xl shadow-sm transition active:scale-[0.99]">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-neutral-900 truncate">{title}</div>
              <div className="text-xs text-neutral-500 mt-1">{subtitle}</div>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-neutral-100 flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-neutral-700" />
            </div>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

function AssignmentRow({ a }: { a: Assignment }) {
  const done = a.status === "Fait";
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-neutral-900 truncate">{a.session}</div>
          <Badge variant={done ? "secondary" : "default"} className="rounded-xl">
            {a.status}
          </Badge>
        </div>
        <div className="text-xs text-neutral-500 mt-1 truncate">
          {a.when} · {a.swimmer}
        </div>
      </div>
      <Button variant="outline" size="sm" className="rounded-xl">
        Ouvrir
      </Button>
    </div>
  );
}

function HomeCoachScreen({
  onGoSwim,
  onGoStrength,
  onGoSwimmers,
}: {
  onGoSwim: () => void;
  onGoStrength: () => void;
  onGoSwimmers: () => void;
}) {
  const fatigued = useMemo(() => getFatiguedSwimmers(MOCK_SWIMMERS), []);
  const mostLoaded = useMemo(() => getMostLoadedSwimmer(MOCK_SWIMMERS), []);

  return (
    <div className={cx("pt-1", PB_APP)}>
      {/* Carte noire — UNIQUEMENT signaux */}
      <div className="px-4">
        <div className="mt-3 rounded-3xl bg-neutral-900 text-white p-5">
          <div className="text-xs text-white/70">Aujourd'hui</div>

          <div className="mt-3">
            <div className="text-sm font-semibold">Fatigue nageurs excessive</div>

            <div className="mt-2 space-y-1">
              {fatigued.length === 0 ? (
                <div className="text-xs text-white/70">Aucun nageur à 5/5.</div>
              ) : (
                fatigued.slice(0, 3).map((s) => (
                  <div key={s.id} className="flex items-center justify-between">
                    <div className="text-sm font-medium truncate">{s.name}</div>
                    <Badge className="rounded-xl bg-white/10 text-white border border-white/15">
                      5/5
                    </Badge>
                  </div>
                ))
              )}
              {fatigued.length > 3 ? (
                <div className="text-[11px] text-white/70">+ {fatigued.length - 3} autres</div>
              ) : null}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="text-sm font-semibold">Nageur le plus chargé</div>
            <div className="mt-2 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{mostLoaded?.s.name ?? "—"}</div>
                <div className="text-xs text-white/70 mt-1">Charge cumulée</div>
              </div>
              <Badge className="rounded-xl bg-white text-neutral-900">
                {mostLoaded?.load ?? 0}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Par où commencer */}
      <SectionTitle title="Par où commencer ?" />
      <div className="px-4 space-y-3">
        <PrimaryActionCard
          title="Natation"
          subtitle="Créer une séance puis l'assigner"
          icon={Waves}
          onOpen={onGoSwim}
        />

        <PrimaryActionCard
          title="Musculation"
          subtitle="Créer une séance puis l'assigner"
          icon={Dumbbell}
          onOpen={onGoStrength}
        />

        <PrimaryActionCard
          title="Mes nageurs"
          subtitle="KPIs et détails par nageur"
          icon={Users}
          onOpen={onGoSwimmers}
        />
      </div>

      {/* Dernières assignations */}
      <SectionTitle icon={ClipboardList} title="Dernières assignations" />
      <div className="px-4">
        <Card className="rounded-3xl shadow-sm">
          <CardContent className="p-4">
            {MOCK_ASSIGNMENTS.map((a, idx) => (
              <React.Fragment key={a.id}>
                <AssignmentRow a={a} />
                {idx !== MOCK_ASSIGNMENTS.length - 1 ? <div className="h-px bg-neutral-100" /> : null}
              </React.Fragment>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AssignScreen({ initialType }: { initialType: SessionType }) {
  const [type, setType] = useState<SessionType>(initialType);
  const [target, setTarget] = useState<"Nageur" | "Groupe">("Nageur");
  const [swimmer, setSwimmer] = useState("cam");
  const [sessionId, setSessionId] = useState(initialType === "Natation" ? "s3" : "m1");
  const [date, setDate] = useState("2026-01-01");
  const [notify, setNotify] = useState(true);

  const filteredSessions = useMemo(() => getSessionsByType(type), [type]);
  const selectedSession = useMemo(() => MOCK_SESSIONS.find((s) => s.id === sessionId), [sessionId]);

  return (
    <div className={cx("pt-1", PB_APP)}>
      <div className="px-4 pt-2">
        <Tabs defaultValue="simple" className="w-full">
          <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-neutral-100 p-1">
            <TabsTrigger value="simple" className="rounded-2xl">
              Rapide
            </TabsTrigger>
            <TabsTrigger value="batch" className="rounded-2xl">
              Groupe
            </TabsTrigger>
          </TabsList>

          <TabsContent value="simple" className="mt-3">
            <Card className="rounded-3xl shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Assigner une séance</CardTitle>
                <div className="text-xs text-neutral-500">Choisissez la séance, la cible et la date.</div>
              </CardHeader>
              <CardContent className="p-4 pt-2 space-y-4">
                {/* Type + Cible */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Type</Label>
                    <Select
                      value={type}
                      onValueChange={(v) => {
                        const next = v as SessionType;
                        setType(next);
                        setSessionId(next === "Natation" ? "s3" : "m1");
                      }}
                    >
                      <SelectTrigger className="rounded-2xl">
                        <SelectValue placeholder="Choisir" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Natation">Natation</SelectItem>
                        <SelectItem value="Muscu">Muscu</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cible</Label>
                    <Select value={target} onValueChange={(v) => setTarget(v as "Nageur" | "Groupe")}>
                      <SelectTrigger className="rounded-2xl">
                        <SelectValue placeholder="Choisir" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Nageur">Nageur</SelectItem>
                        <SelectItem value="Groupe">Groupe</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Séance */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Séance</Label>
                  <Select value={sessionId} onValueChange={setSessionId}>
                    <SelectTrigger className="rounded-2xl">
                      <SelectValue placeholder="Choisir une séance" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredSessions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedSession ? (
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant="secondary" className="rounded-xl">
                        {selectedSession.focus}
                      </Badge>
                      <div className="text-xs text-neutral-500">Astuce: créez d'abord dans Bibliothèque.</div>
                    </div>
                  ) : null}
                </div>

                {/* Nageur / Groupe */}
                {target === "Nageur" ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nageur</Label>
                    <Select value={swimmer} onValueChange={setSwimmer}>
                      <SelectTrigger className="rounded-2xl">
                        <SelectValue placeholder="Choisir un nageur" />
                      </SelectTrigger>
                      <SelectContent>
                        {MOCK_SWIMMERS.map((n) => (
                          <SelectItem key={n.id} value={n.id}>
                            {n.name} · {n.group}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Groupe</Label>
                    <Select defaultValue="Perf">
                      <SelectTrigger className="rounded-2xl">
                        <SelectValue placeholder="Choisir un groupe" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Avenir">Avenir</SelectItem>
                        <SelectItem value="Perf">Perf</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="text-xs text-neutral-500">12 nageurs recevront la séance.</div>
                  </div>
                )}

                {/* Date + Notif */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Date</Label>
                    <div className="relative">
                      <CalendarDays className="h-4 w-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input value={date} onChange={(e) => setDate(e.target.value)} className="rounded-2xl pl-9" type="date" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Notifier</Label>
                    <button
                      type="button"
                      onClick={() => setNotify((v) => !v)}
                      className={cx(
                        "w-full h-10 rounded-2xl border flex items-center justify-between px-3",
                        notify ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-900"
                      )}
                    >
                      <span className="text-sm font-medium">{notify ? "Oui" : "Non"}</span>
                      <CheckCircle2 className={cx("h-4 w-4", notify ? "opacity-100" : "opacity-30")} />
                    </button>
                    <div className="text-[11px] text-neutral-500">Push + email (selon réglages).</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sticky CTA */}
            <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(var(--app-bottom-inset,72px)+12px)] w-[390px] max-w-[calc(100vw-2rem)] px-4">
              <div className="rounded-3xl bg-white/80 backdrop-blur border border-neutral-200 shadow-lg p-2">
                <Button className="w-full rounded-2xl">Assigner & notifier</Button>
                <div className="text-[11px] text-neutral-500 text-center mt-1">Retour = Home Coach</div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="batch" className="mt-3">
            <Card className="rounded-3xl shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Assignation par groupe</CardTitle>
                <div className="text-xs text-neutral-500">Configurez puis sélectionnez les nageurs.</div>
              </CardHeader>
              <CardContent className="p-4 pt-2 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Groupe</Label>
                  <Select defaultValue="Perf">
                    <SelectTrigger className="rounded-2xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Avenir">Avenir</SelectItem>
                      <SelectItem value="Perf">Perf</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Séance</Label>
                  <Select defaultValue={type === "Natation" ? "s1" : "m1"}>
                    <SelectTrigger className="rounded-2xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredSessions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Nageurs inclus</Label>
                    <Badge variant="secondary" className="rounded-xl">
                      8 sélectionnés
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {MOCK_SWIMMERS.map((n) => (
                      <button
                        type="button"
                        key={n.id}
                        className="rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-left"
                      >
                        <div className="text-sm font-semibold truncate">{n.name}</div>
                        <div className="text-[11px] text-neutral-500 truncate">
                          {n.group} · {n.level}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <Button className="w-full rounded-2xl">Assigner au groupe</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function SessionsLibraryScreen({ type }: { type: SessionType }) {
  const list = useMemo(() => getSessionsByType(type), [type]);

  return (
    <div className={cx("pt-1", PB_APP)}>
      {/* CTA clair en haut: création */}
      <div className="px-4 pt-3">
        <Card className="rounded-3xl shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">Créer une séance</div>
                <div className="text-xs text-neutral-500 mt-1">
                  {type === "Natation" ? "Natation" : "Musculation"} · puis vous pourrez l'assigner.
                </div>
              </div>
              <Button className="rounded-2xl">Créer</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <SectionTitle title={type === "Natation" ? "Bibliothèque Natation" : "Bibliothèque Musculation"} />
      <div className="px-4 space-y-3">
        {list.map((s) => (
          <Card key={s.id} className="rounded-3xl shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{s.title}</div>
                  <div className="text-xs text-neutral-500 mt-1">Focus: {s.focus}</div>
                </div>
                <Badge variant="secondary" className="rounded-xl">
                  Modèle
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button variant="outline" className="rounded-2xl">
                  Éditer
                </Button>
                <Button className="rounded-2xl">Assigner</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SwimmersScreen() {
  const fatigueCount = useMemo(() => getFatiguedSwimmers(MOCK_SWIMMERS).length, []);
  const maxLoad = useMemo(() => getMostLoadedSwimmer(MOCK_SWIMMERS)?.load ?? 0, []);

  return (
    <div className={cx("pt-1", PB_APP)}>
      <div className="px-4 pt-3">
        <Card className="rounded-3xl shadow-sm">
          <CardContent className="p-4">
            <div className="text-sm font-semibold">KPIs (semaine)</div>
            <div className="text-xs text-neutral-500 mt-1">Charge et ressenti (fatigue).</div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-neutral-100 px-3 py-2">
                <div className="text-[11px] text-neutral-500">Fatigue 5/5</div>
                <div className="text-sm font-semibold text-neutral-900 mt-0.5">{fatigueCount}</div>
              </div>
              <div className="rounded-2xl bg-neutral-100 px-3 py-2">
                <div className="text-[11px] text-neutral-500">Max charge</div>
                <div className="text-sm font-semibold text-neutral-900 mt-0.5">{maxLoad}</div>
              </div>
              <div className="rounded-2xl bg-neutral-100 px-3 py-2">
                <div className="text-[11px] text-neutral-500">Nageurs</div>
                <div className="text-sm font-semibold text-neutral-900 mt-0.5">{MOCK_SWIMMERS.length}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <SectionTitle icon={Users} title="Nageurs" />
      <div className="px-4 space-y-3">
        {MOCK_SWIMMERS.map((n) => {
          const w = MOCK_WELLNESS[n.id];
          const isFatigued = w?.fatigue === 5;
          return (
            <Card key={n.id} className="rounded-3xl shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{n.name}</div>
                    <div className="text-xs text-neutral-500 mt-1">
                      {n.group} · {n.level}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="secondary" className="rounded-xl">
                        Charge: {w?.load ?? 0}
                      </Badge>
                      <Badge variant={isFatigued ? "default" : "secondary"} className="rounded-xl">
                        Fatigue: {w?.fatigue ?? 0}/5
                      </Badge>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="rounded-xl">
                    Ouvrir
                  </Button>
                </div>
                <div className="mt-3">
                  <Button className="w-full rounded-2xl">Message</Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function MessagesScreen() {
  return (
    <div className={cx("pt-1", PB_APP)}>
      <div className="px-4 pt-3">
        <Card className="rounded-3xl shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Messagerie</div>
                <div className="text-xs text-neutral-500 mt-1">Conversations avec vos nageurs.</div>
              </div>
              <Badge className="rounded-xl">2</Badge>
            </div>
            <div className="mt-3">
              <Button className="w-full rounded-2xl">Nouveau message</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <SectionTitle icon={MessageSquare} title="Conversations" />
      <div className="px-4 space-y-3">
        {[
          { name: "Camille", last: "Ok pour demain 👍", when: "09:12" },
          { name: "Parent Inès", last: "On arrive 10min en retard", when: "Hier" },
          { name: "Groupe Perf", last: "Séance publiée", when: "Lun." },
        ].map((c) => (
          <Card key={c.name} className="rounded-3xl shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{c.name}</div>
                  <div className="text-xs text-neutral-500 mt-1 truncate">{c.last}</div>
                </div>
                <div className="text-xs text-neutral-500">{c.when}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function getScreenMeta(key: ScreenKey) {
  switch (key) {
    case "home":
      return { title: "Coach", subtitle: "Priorités du jour" };
    case "library_natation":
      return { title: "Natation", subtitle: "Créer puis assigner" };
    case "assign_natation":
      return { title: "Assigner", subtitle: "Natation" };
    case "library_muscu":
      return { title: "Musculation", subtitle: "Créer puis assigner" };
    case "assign_muscu":
      return { title: "Assigner", subtitle: "Musculation" };
    case "swimmers":
      return { title: "Nageurs", subtitle: "KPIs" };
    case "messages":
      return { title: "Messages", subtitle: "Conversations" };
    default:
      return { title: "Coach", subtitle: "" };
  }
}

export default function CoachMobileMockup(): JSX.Element {
  const [stack, setStack] = useState<ScreenState[]>([{ key: "home" }]);
  const [sheetOpen, setSheetOpen] = useState(false);

  const current = stack[stack.length - 1];
  const meta = getScreenMeta(current.key);
  const canGoBack = stack.length > 1;

  const go = (key: ScreenKey) => setStack((s) => openScreen(s, key));
  const back = () => setStack((s) => popStack(s));

  return (
    <PhoneFrame>
      <div className="relative">
        <TopBar
          title={meta.title}
          subtitle={meta.subtitle}
          onBack={canGoBack ? back : undefined}
          onOpenMessages={() => go("messages")}
          onOpenQuickActions={() => setSheetOpen(true)}
        />

        {/* Content */}
        <div className="min-h-[680px] bg-neutral-50">
          {current.key === "home" ? (
            <HomeCoachScreen
              onGoSwim={() => go("library_natation")}
              onGoStrength={() => go("library_muscu")}
              onGoSwimmers={() => go("swimmers")}
            />
          ) : current.key === "library_natation" ? (
            <SessionsLibraryScreen type="Natation" />
          ) : current.key === "library_muscu" ? (
            <SessionsLibraryScreen type="Muscu" />
          ) : current.key === "assign_natation" ? (
            <AssignScreen initialType="Natation" />
          ) : current.key === "assign_muscu" ? (
            <AssignScreen initialType="Muscu" />
          ) : current.key === "swimmers" ? (
            <SwimmersScreen />
          ) : (
            <MessagesScreen />
          )}
        </div>

        {/* Quick actions sheet */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="bottom" className="rounded-t-3xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Actions rapides</div>
                <div className="text-xs text-neutral-500 mt-1">Accès direct aux priorités coach.</div>
              </div>
              <Badge variant="secondary" className="rounded-xl">
                Coach
              </Badge>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Button
                className="rounded-2xl"
                onClick={() => {
                  go("library_natation");
                  setSheetOpen(false);
                }}
              >
                <Waves className="h-4 w-4 mr-2" />
                Créer Natation
              </Button>
              <Button
                variant="outline"
                className="rounded-2xl"
                onClick={() => {
                  go("assign_natation");
                  setSheetOpen(false);
                }}
              >
                <ClipboardList className="h-4 w-4 mr-2" />
                Assigner
              </Button>
              <Button
                variant="outline"
                className="rounded-2xl"
                onClick={() => {
                  go("swimmers");
                  setSheetOpen(false);
                }}
              >
                <Users className="h-4 w-4 mr-2" />
                KPIs Nageurs
              </Button>
              <Button
                variant="outline"
                className="rounded-2xl"
                onClick={() => {
                  go("library_muscu");
                  setSheetOpen(false);
                }}
              >
                <Dumbbell className="h-4 w-4 mr-2" />
                Créer Muscu
              </Button>
            </div>

            <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
              <div className="text-xs font-semibold text-neutral-900">Raccourcis</div>
              <ul className="mt-2 text-xs text-neutral-600 space-y-1 list-disc pl-4">
                <li>Créer Natation / Créer Muscu</li>
                <li>Assigner une séance</li>
                <li>KPIs Nageurs</li>
              </ul>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </PhoneFrame>
  );
}
