# Swimmer Objectives Hub — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refonte de la page Profil en hub de navigation (4 cartes) + sous-vue Objectifs nageur (lecture objectifs coach + CRUD objectifs personnels).

**Architecture:** State machine `activeSection: "home" | "objectives"` dans Profile.tsx (pattern Coach.tsx). La vue "home" affiche le hub avec 4 cartes. La vue "objectives" affiche les objectifs structurés (table `objectives`) avec distinction coach vs perso via `created_by`. Les helpers `formatTime`, `parseTime`, `eventLabel`, `FFN_EVENTS` sont extraits de `CoachObjectivesScreen.tsx` dans un module partagé.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Radix/Shadcn (Sheet, Badge, ToggleGroup, AlertDialog), React Query 5, Supabase Auth

---

### Task 1: Extract shared objective helpers

**Files:**
- Create: `src/lib/objectiveHelpers.ts`
- Modify: `src/pages/coach/CoachObjectivesScreen.tsx:41-74`

**Step 1: Create the shared helpers module**

```typescript
// src/lib/objectiveHelpers.ts

export const FFN_EVENTS = [
  "50NL", "100NL", "200NL", "400NL", "800NL", "1500NL",
  "50DOS", "100DOS", "200DOS",
  "50BR", "100BR", "200BR",
  "50PAP", "100PAP", "200PAP",
  "200QN", "400QN",
];

export function eventLabel(code: string): string {
  const match = code.match(/^(\d+)(NL|DOS|BR|PAP|QN)$/);
  if (!match) return code;
  const names: Record<string, string> = {
    NL: "Nage Libre",
    DOS: "Dos",
    BR: "Brasse",
    PAP: "Papillon",
    QN: "4 Nages",
  };
  return `${match[1]}m ${names[match[2]] || match[2]}`;
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const wholeSecs = Math.floor(secs);
  const centisecs = Math.round((secs - wholeSecs) * 100);
  return `${mins}:${String(wholeSecs).padStart(2, "0")}:${String(centisecs).padStart(2, "0")}`;
}

export function parseTime(display: string): number | null {
  const match = display.match(/^(\d+):(\d{2})[.::](\d{2})$/);
  if (!match) return null;
  return parseInt(match[1]) * 60 + parseInt(match[2]) + parseInt(match[3]) / 100;
}
```

**Step 2: Update CoachObjectivesScreen imports**

In `src/pages/coach/CoachObjectivesScreen.tsx`, replace lines 41-74 (the local `FFN_EVENTS`, `eventLabel`, `formatTime`, `parseTime` definitions) with:

```typescript
import { FFN_EVENTS, eventLabel, formatTime, parseTime } from "@/lib/objectiveHelpers";
```

**Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No new errors

**Step 4: Commit**

```bash
git add src/lib/objectiveHelpers.ts src/pages/coach/CoachObjectivesScreen.tsx
git commit -m "refactor: extract shared objective helpers (FFN_EVENTS, formatTime, parseTime, eventLabel)"
```

---

### Task 2: Refonte Profile.tsx — Hub home view

**Files:**
- Modify: `src/pages/Profile.tsx`

This task replaces the current Profile layout (hero + Card with details + FFN section + Collapsible security + logout button) with a hub layout (hero compact + 2x2 grid of navigation cards + logout + version info). The edit and password sheets remain, just triggered differently.

**Step 1: Add state machine and new imports**

At the top of `Profile.tsx`, add to imports:

```typescript
import { Lock, Pen, Target, Trophy } from "lucide-react";
import { useLocation } from "wouter";
```

Inside `Profile()`, add state:

```typescript
const [activeSection, setActiveSection] = useState<"home" | "objectives">("home");
const [, navigate] = useLocation();
const [isPasswordSheetOpen, setIsPasswordSheetOpen] = useState(false);
```

**Step 2: Replace Profile body with hub layout**

Replace the entire return block (lines 325-584) with:

- If `activeSection === "objectives"`: render `<SwimmerObjectivesView onBack={() => setActiveSection("home")} />` (built in Task 3)
- If `activeSection === "home"`: render the hub:

```tsx
<motion.div className="space-y-6" variants={fadeIn} initial="hidden" animate="visible">
  {/* Hero compact */}
  <div className="rounded-xl bg-accent text-accent-foreground p-5">
    <div className="flex items-center gap-4">
      <Avatar className="h-20 w-20 ring-2 ring-primary ring-offset-2 ring-offset-accent">
        <AvatarImage src={avatarSrc} alt={user || "Profil"} />
        <AvatarFallback className="text-lg">{(user || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-display font-bold uppercase italic text-accent-foreground truncate">{user}</h1>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <Badge variant="secondary" className="text-xs">{roleLabel}</Badge>
          <span className="text-sm opacity-80">{groupLabel}</span>
        </div>
        {profile?.bio && (
          <p className="text-xs opacity-70 mt-1.5 line-clamp-2">{profile.bio}</p>
        )}
      </div>
    </div>
  </div>

  {/* Navigation Grid 2x2 */}
  <div className="grid grid-cols-2 gap-3">
    <button type="button" onClick={startEdit}
      className="rounded-xl border bg-card p-4 text-left shadow-sm active:bg-muted/50 transition-colors">
      <Pen className="h-5 w-5 text-primary mb-2" />
      <p className="text-sm font-bold">Mon profil</p>
      <p className="text-xs text-muted-foreground">Modifier mes infos</p>
    </button>
    <button type="button" onClick={() => setIsPasswordSheetOpen(true)}
      className="rounded-xl border bg-card p-4 text-left shadow-sm active:bg-muted/50 transition-colors">
      <Lock className="h-5 w-5 text-primary mb-2" />
      <p className="text-sm font-bold">Sécurité</p>
      <p className="text-xs text-muted-foreground">Mot de passe</p>
    </button>
    {showRecords && (
      <button type="button" onClick={() => navigate("/records")}
        className="rounded-xl border bg-card p-4 text-left shadow-sm active:bg-muted/50 transition-colors">
        <Trophy className="h-5 w-5 text-primary mb-2" />
        <p className="text-sm font-bold">Records</p>
        <p className="text-xs text-muted-foreground">Mes perfs personnelles</p>
      </button>
    )}
    <button type="button" onClick={() => setActiveSection("objectives")}
      className="rounded-xl border bg-card p-4 text-left shadow-sm active:bg-muted/50 transition-colors">
      <Target className="h-5 w-5 text-primary mb-2" />
      <p className="text-sm font-bold">Objectifs</p>
      <p className="text-xs text-muted-foreground">Mon plan</p>
    </button>
  </div>

  {/* Logout */}
  <Button variant="destructive" onClick={logout} className="w-full gap-2">
    <LogOut className="h-4 w-4" />
    Se déconnecter
  </Button>

  {/* Version info */}
  <div className="space-y-1 pt-2">
    <button type="button" onClick={handleCheckUpdate} disabled={isCheckingUpdate}
      className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-2">
      <Download className={["h-3 w-3", isCheckingUpdate ? "animate-bounce" : ""].join(" ")} />
      {isCheckingUpdate ? "Recherche en cours..." : "Rechercher des mises à jour"}
    </button>
    <p className="text-[10px] text-center text-muted-foreground/60">
      Version du {new Date(__BUILD_TIMESTAMP__).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
    </p>
  </div>

  {/* Edit profile bottom sheet (existing) */}
  <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
    {/* ... keep existing SheetContent for profile edit ... */}
  </Sheet>

  {/* Password change bottom sheet (extracted from Collapsible) */}
  <Sheet open={isPasswordSheetOpen} onOpenChange={setIsPasswordSheetOpen}>
    <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
      <SheetHeader>
        <SheetTitle>Changer le mot de passe</SheetTitle>
        <SheetDescription>Votre mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre.</SheetDescription>
      </SheetHeader>
      <form onSubmit={handleUpdatePassword} className="space-y-3 mt-4">
        {/* ... keep existing password fields from the Collapsible section ... */}
      </form>
    </SheetContent>
  </Sheet>
</motion.div>
```

**Step 3: Remove old sections**

Remove:
- The `<Card>` with profile details (lines 361-392) — info is now in the hero
- The FFN & Records `<Card>` (lines 489-519) — replaced by Records hub card
- The `<Collapsible>` security section (lines 521-563) — replaced by password sheet
- The `objectives` field from the profile edit form (lines 438-444) — replaced by structured objectives
- Remove `objectives` from the `profileEditSchema` (line 52) and `ProfileEditForm` defaults (line 132)

**Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: No new errors

**Step 5: Commit**

```bash
git add src/pages/Profile.tsx
git commit -m "feat: refonte Profile en hub avec grille 2x2 (profil, sécurité, records, objectifs)"
```

---

### Task 3: Swimmer Objectives View

**Files:**
- Create: `src/components/profile/SwimmerObjectivesView.tsx`

This is the main new component. It displays objectives from the `objectives` table, split into "Coach" (read-only) and "Personnels" (CRUD) sections. The swimmer creates objectives via a bottom sheet form (same fields as coach minus competition link).

**Step 1: Create SwimmerObjectivesView component**

```tsx
// src/components/profile/SwimmerObjectivesView.tsx

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Objective, ObjectiveInput } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Plus, Target, Trash2 } from "lucide-react";
import { FFN_EVENTS, eventLabel, formatTime, parseTime } from "@/lib/objectiveHelpers";

type Props = { onBack: () => void };
type ObjectiveType = "chrono" | "texte" | "both";

export default function SwimmerObjectivesView({ onBack }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editingObj, setEditingObj] = useState<Objective | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Objective | null>(null);

  // Get current auth user UUID
  const { data: authUser } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
  });
  const authUid = authUser?.id ?? null;

  // Get objectives for current athlete
  const { data: objectives = [], isLoading } = useQuery({
    queryKey: ["athlete-objectives"],
    queryFn: () => api.getAthleteObjectives(),
    enabled: !!authUid,
  });

  // Split into coach vs personal
  const coachObjectives = useMemo(
    () => objectives.filter((o) => o.created_by !== authUid),
    [objectives, authUid],
  );
  const personalObjectives = useMemo(
    () => objectives.filter((o) => o.created_by === authUid),
    [objectives, authUid],
  );

  // ── Form state ──
  const [objType, setObjType] = useState<ObjectiveType>("chrono");
  const [eventCode, setEventCode] = useState("");
  const [poolLength, setPoolLength] = useState("25");
  const [targetTime, setTargetTime] = useState("");
  const [text, setText] = useState("");

  const resetForm = () => {
    setObjType("chrono");
    setEventCode("");
    setPoolLength("25");
    setTargetTime("");
    setText("");
  };

  const openCreate = () => {
    setEditingObj(null);
    resetForm();
    setShowForm(true);
  };

  const openEdit = (obj: Objective) => {
    setEditingObj(obj);
    const hasChrono = !!obj.event_code;
    const hasText = !!obj.text;
    setObjType(hasChrono && hasText ? "both" : hasText ? "texte" : "chrono");
    setEventCode(obj.event_code ?? "");
    setPoolLength(String(obj.pool_length ?? 25));
    setTargetTime(obj.target_time_seconds != null ? formatTime(obj.target_time_seconds) : "");
    setText(obj.text ?? "");
    setShowForm(true);
  };

  // ── Mutations ──
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["athlete-objectives"] });

  const createMut = useMutation({
    mutationFn: (input: ObjectiveInput) => api.createObjective(input),
    onSuccess: () => { toast({ title: "Objectif créé" }); invalidate(); setShowForm(false); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: (input: Partial<ObjectiveInput>) => api.updateObjective(editingObj!.id, input),
    onSuccess: () => { toast({ title: "Objectif mis à jour" }); invalidate(); setShowForm(false); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteObjective(id),
    onSuccess: () => { toast({ title: "Objectif supprimé" }); invalidate(); setDeleteTarget(null); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const showChrono = objType === "chrono" || objType === "both";
  const showText = objType === "texte" || objType === "both";
  const isPending = createMut.isPending || updateMut.isPending;

  const handleSubmit = () => {
    if (showChrono && !eventCode) {
      toast({ title: "Épreuve requise", variant: "destructive" }); return;
    }
    if (showChrono && targetTime && parseTime(targetTime) === null) {
      toast({ title: "Format invalide", description: "Format : m:ss:cc (ex: 1:05:30)", variant: "destructive" }); return;
    }
    if (showText && !text.trim()) {
      toast({ title: "Texte requis", variant: "destructive" }); return;
    }
    if (!authUid) return;

    const input: ObjectiveInput = {
      athlete_id: authUid,
      event_code: showChrono ? eventCode : null,
      pool_length: showChrono ? Number(poolLength) : null,
      target_time_seconds: showChrono && targetTime ? parseTime(targetTime) : null,
      text: showText ? text.trim() : null,
    };

    if (editingObj) {
      updateMut.mutate(input);
    } else {
      createMut.mutate(input);
    }
  };

  // ── Render ──
  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="space-y-1">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Retour
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-display font-semibold uppercase italic text-primary">Mon plan</h2>
            <p className="text-sm text-muted-foreground">Mes objectifs d'entraînement</p>
          </div>
          <Button variant="outline" size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Ajouter
          </Button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border p-3 animate-pulse motion-reduce:animate-none">
              <div className="h-4 w-40 rounded bg-muted" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && objectives.length === 0 && (
        <div className="text-center py-12 space-y-3">
          <Target className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Aucun objectif pour le moment.</p>
          <Button variant="outline" size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Ajouter un objectif
          </Button>
        </div>
      )}

      {/* Coach objectives */}
      {coachObjectives.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Objectifs du coach
          </h3>
          {coachObjectives.map((obj) => (
            <ObjectiveCardReadOnly key={obj.id} objective={obj} />
          ))}
        </div>
      )}

      {/* Personal objectives */}
      {personalObjectives.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Mes objectifs personnels
          </h3>
          {personalObjectives.map((obj) => (
            <ObjectiveCardEditable
              key={obj.id}
              objective={obj}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* Bottom sheet form */}
      <Sheet open={showForm} onOpenChange={setShowForm}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingObj ? "Modifier l'objectif" : "Nouvel objectif"}</SheetTitle>
            <SheetDescription>
              {editingObj ? "Modifiez votre objectif personnel." : "Ajoutez un objectif personnel."}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            {/* Type toggle */}
            <div className="space-y-2">
              <Label>Type d'objectif</Label>
              <ToggleGroup type="single" variant="outline" value={objType}
                onValueChange={(v) => { if (v) setObjType(v as ObjectiveType); }} className="justify-start">
                <ToggleGroupItem value="chrono" className="text-xs">Chrono</ToggleGroupItem>
                <ToggleGroupItem value="texte" className="text-xs">Texte</ToggleGroupItem>
                <ToggleGroupItem value="both" className="text-xs">Les deux</ToggleGroupItem>
              </ToggleGroup>
            </div>

            {showChrono && (
              <>
                <div className="space-y-2">
                  <Label>Épreuve *</Label>
                  <Select value={eventCode} onValueChange={setEventCode}>
                    <SelectTrigger><SelectValue placeholder="Choisir une épreuve" /></SelectTrigger>
                    <SelectContent>
                      {FFN_EVENTS.map((code) => (
                        <SelectItem key={code} value={code}>{eventLabel(code)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Bassin</Label>
                  <Select value={poolLength} onValueChange={setPoolLength}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25m</SelectItem>
                      <SelectItem value="50">50m</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Temps cible (min:sec:centièmes)</Label>
                  <Input placeholder="Ex : 1:05:30" value={targetTime} onChange={(e) => setTargetTime(e.target.value)} />
                </div>
              </>
            )}

            {showText && (
              <div className="space-y-2">
                <Label>Objectif texte *</Label>
                <Textarea placeholder="Ex : Améliorer la coulée de dos" value={text}
                  onChange={(e) => setText(e.target.value)} rows={3} />
              </div>
            )}

            <Button className="w-full" onClick={handleSubmit} disabled={isPending}>
              {isPending ? "Enregistrement..." : editingObj ? "Enregistrer" : "Créer"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'objectif</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. L'objectif sera supprimé définitivement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteTarget) deleteMut.mutate(deleteTarget.id); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Card: Read-only (coach objectives) ──

function ObjectiveCardReadOnly({ objective }: { objective: Objective }) {
  const hasChrono = !!objective.event_code;
  const hasText = !!objective.text;
  return (
    <div className="rounded-xl border bg-card p-3 space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Coach</Badge>
        {hasChrono && (
          <>
            <span className="text-sm font-semibold">{eventLabel(objective.event_code!)}</span>
            {objective.pool_length && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{objective.pool_length}m</Badge>
            )}
            {objective.target_time_seconds != null && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                {formatTime(objective.target_time_seconds)}
              </Badge>
            )}
          </>
        )}
      </div>
      {hasText && <p className="text-sm text-muted-foreground">{objective.text}</p>}
      {objective.competition_name && (
        <Badge variant="outline" className="border-orange-300 text-orange-600 dark:text-orange-400 text-[10px] px-1.5 py-0">
          {objective.competition_name}
        </Badge>
      )}
    </div>
  );
}

// ── Card: Editable (personal objectives) ──

function ObjectiveCardEditable({
  objective,
  onEdit,
  onDelete,
}: {
  objective: Objective;
  onEdit: (obj: Objective) => void;
  onDelete: (obj: Objective) => void;
}) {
  const hasChrono = !!objective.event_code;
  const hasText = !!objective.text;
  return (
    <div className="rounded-xl border bg-card p-3 space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        {hasChrono && (
          <>
            <span className="text-sm font-semibold">{eventLabel(objective.event_code!)}</span>
            {objective.pool_length && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{objective.pool_length}m</Badge>
            )}
            {objective.target_time_seconds != null && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                {formatTime(objective.target_time_seconds)}
              </Badge>
            )}
          </>
        )}
        <div className="ml-auto flex gap-1">
          <button type="button" onClick={() => onEdit(objective)}
            className="text-xs text-primary hover:underline">Modifier</button>
          <button type="button" onClick={() => onDelete(objective)}
            className="text-muted-foreground hover:text-destructive p-0.5">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {hasText && <p className="text-sm text-muted-foreground">{objective.text}</p>}
    </div>
  );
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No new errors

**Step 3: Commit**

```bash
git add src/components/profile/SwimmerObjectivesView.tsx
git commit -m "feat: add SwimmerObjectivesView with coach read-only + personal CRUD"
```

---

### Task 4: Wire SwimmerObjectivesView into Profile.tsx

**Files:**
- Modify: `src/pages/Profile.tsx`

**Step 1: Import and render**

At the top of Profile.tsx, add:

```typescript
import SwimmerObjectivesView from "@/components/profile/SwimmerObjectivesView";
```

In the return block, wrap with section switching:

```tsx
if (activeSection === "objectives") {
  return <SwimmerObjectivesView onBack={() => setActiveSection("home")} />;
}
// ... hub home JSX
```

**Step 2: Verify build and manual test**

Run: `npx tsc --noEmit`
Run: `npm run dev` — navigate to `/#/profile`, click Objectifs card, verify sub-view renders with back button.

**Step 3: Commit**

```bash
git add src/pages/Profile.tsx
git commit -m "feat: wire SwimmerObjectivesView into Profile hub"
```

---

### Task 5: Update documentation

**Files:**
- Modify: `docs/implementation-log.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/FEATURES_STATUS.md`
- Modify: `CLAUDE.md`

**Step 1: Add implementation log entry**

Add a new section `§61 — Interface objectifs nageur + refonte Profil hub` to `docs/implementation-log.md`:
- Context: coach objectives existed, no swimmer view
- Changes: extracted shared helpers, refactored Profile into hub, created SwimmerObjectivesView
- Files: `src/lib/objectiveHelpers.ts`, `src/pages/Profile.tsx`, `src/components/profile/SwimmerObjectivesView.tsx`, `src/pages/coach/CoachObjectivesScreen.tsx`
- Decisions: state machine pattern (like Coach.tsx), bottom sheets for forms, `created_by` comparison for coach vs personal

**Step 2: Update ROADMAP.md**

Add chantier #29: "Interface objectifs nageur + refonte Profil hub" — Statut: Fait (§61)

**Step 3: Update FEATURES_STATUS.md**

Mark objectives swimmer view as ✅

**Step 4: Update CLAUDE.md**

Add `src/components/profile/SwimmerObjectivesView.tsx` and `src/lib/objectiveHelpers.ts` to the files table. Add chantier #29 to the roadmap table.

**Step 5: Commit**

```bash
git add docs/implementation-log.md docs/ROADMAP.md docs/FEATURES_STATUS.md CLAUDE.md
git commit -m "docs: add §61 swimmer objectives hub implementation log"
```
