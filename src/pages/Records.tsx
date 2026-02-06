import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { shouldShowRecords } from "@/pages/Profile";
import { Check, Dumbbell, Edit2, RefreshCw, Trophy, Waves, X } from "lucide-react";

type OneRmRecord = {
  exercise_id: number;
  weight?: number | null;
  recorded_at?: string | null;
  date?: string | null;
};

type SwimMode = "training" | "comp";
type SwimEditorOpenFor = "add" | number | null;

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");

function formatDateShort(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

/** Display formatter: seconds -> mm:ss.cc or ss.cc */
function formatTimeSeconds(value?: number | null) {
  if (value === null || value === undefined) return "—";
  const ms = Math.round(Math.max(0, value * 1000));
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const centi = Math.floor((ms % 1000) / 10);

  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, "0")}.${String(centi).padStart(2, "0")}`;
  }
  return `${seconds}.${String(centi).padStart(2, "0")}`;
}

/** Parser: accepts "75.32", "1:02.34", "0:59.9" -> seconds (float) */
function parseTimeInputToSeconds(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;

  // mm:ss(.cc)
  if (s.includes(":")) {
    const [mPart, secPartRaw] = s.split(":");
    const m = Number(mPart);
    if (!Number.isFinite(m) || m < 0) return null;

    const secPart = secPartRaw.replace(",", ".");
    const sec = Number(secPart);
    if (!Number.isFinite(sec) || sec < 0) return null;

    return m * 60 + sec;
  }

  // plain seconds
  const v = Number(s.replace(",", "."));
  if (!Number.isFinite(v) || v < 0) return null;
  return v;
}

function parseFfnPointsFromNotes(notes?: string | null): number | null {
  if (!notes) return null;
  const m = notes.match(/FFN\s*\((\d+)\s*pts\)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}


function InlineEditBar({
  value,
  placeholder,
  onSave,
  onCancel,
  inputMode = "decimal",
  hint,
}: {
  value: string;
  placeholder: string;
  onSave: (draft: string) => void;
  onCancel: () => void;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  hint?: string;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <div className="w-full">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            inputMode={inputMode}
            className="h-10 rounded-xl"
            autoFocus
          />
          {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
        </div>

        <Button
          type="button"
          onClick={() => onSave(draft)}
          className="h-10 w-10 p-0 rounded-xl"
          aria-label="Valider"
        >
          <Check className="h-5 w-5" />
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="h-10 w-10 p-0 rounded-xl"
          aria-label="Annuler"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

const SkeletonRow = () => <div className="h-10 rounded-xl bg-muted animate-pulse" />;

export default function Records() {
  const { user, userId, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const emptySwimForm = {
    id: null as number | null,
    event_name: "",
    pool_length: "",
    time_seconds: "",
    record_date: "",
    notes: "",
  };

  const [mainTab, setMainTab] = useState<"swim" | "1rm">("swim");

  const [swimForm, setSwimForm] = useState(emptySwimForm);
  const [swimMode, setSwimMode] = useState<SwimMode>("training");
  const [poolLen, setPoolLen] = useState<25 | 50>(25);
  const [swimEditorOpenFor, setSwimEditorOpenFor] = useState<SwimEditorOpenFor>(null);

  const [editingExerciseId, setEditingExerciseId] = useState<number | null>(null);
  const [editingOneRmValue, setEditingOneRmValue] = useState<string>("");

  const showRecords = shouldShowRecords(role);


  /**
   * Scroll to top on initial mount only (avoid stale scroll position on navigation).
   * Does NOT re-scroll on tab switch / focus / visibility change to avoid hijacking
   * the user's scroll position during normal usage.
   */
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  // Robust pool reader: supports snake_case + camelCase payloads
  const getPoolLen = (r: any): 25 | 50 | null => {
    const raw = r?.pool_length ?? r?.poolLength ?? r?.poolLen ?? r?.pool;
    if (raw === null || raw === undefined) return null;

    if (typeof raw === "number") {
      return raw === 25 || raw === 50 ? raw : null;
    }

    const s = String(raw);
    const m = s.match(/\b(25|50)\b/);
    if (!m) return null;

    const pl = Number(m[1]);
    return pl === 25 || pl === 50 ? (pl as 25 | 50) : null;
  };

  // --- SOURCE OF TRUTH: queries / keys / endpoints unchanged ---
  const oneRmQuery = useQuery<OneRmRecord[]>({
    queryKey: ["1rm", user, userId],
    queryFn: () => api.get1RM({ athleteName: user, athleteId: userId }),
    enabled: !!user && showRecords,
  });

  const exercisesQuery = useQuery({
    queryKey: ["exercises"],
    queryFn: () => api.getExercises(),
    enabled: showRecords,
  });

  const swimRecordsQuery = useQuery({
    queryKey: ["swim-records", userId, user],
    queryFn: () => api.getSwimRecords({ athleteId: userId ?? undefined, athleteName: user ?? undefined }),
    enabled: !!user && showRecords,
  });

  const { data: oneRMs, isLoading: oneRmLoading, isError: oneRmIsError } = oneRmQuery;
  const { data: exercises, isLoading: exercisesLoading, isError: exercisesIsError } = exercisesQuery;
  const {
    data: swimRecords,
    isLoading: swimLoading,
    isFetching: swimFetching,
    isError: swimIsError,
    refetch: refetchSwimRecords,
  } = swimRecordsQuery;

  const reloadSwimRecords = () => {
    // Refetch DB. Never triggers FFN sync.
    refetchSwimRecords();
  };

  // Auto-refetch when entering competition view (DB refresh only)
  useEffect(() => {
    if (swimMode === "comp") {
      reloadSwimRecords();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swimMode]);

  // --- SOURCE OF TRUTH: mutations / invalidateQueries unchanged ---
  const update1RM = useMutation({
    mutationFn: (data: any) => api.update1RM({ ...data, athlete_id: userId, athlete_name: user }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["1rm"] });
      toast({ title: "1RM mis à jour" });
    },
  });

  const upsertSwimRecord = useMutation({
    mutationFn: (data: any) => api.upsertSwimRecord(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["swim-records"] });
      setSwimForm(emptySwimForm);
      setSwimEditorOpenFor(null);
      toast({ title: "Record mis à jour" });
    },
  });

  // Sync FFN (only when user clicks "Actualiser")
  const syncFfnSwimRecords = useMutation({
    mutationFn: (iuf: string) =>
      api.syncFfnSwimRecords({
        athleteId: userId ?? undefined,
        athleteName: user ?? undefined,
        iuf,
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["swim-records"] });
      toast({
        title: "Synchro FFN terminée",
        description: `${data?.inserted ?? 0} ajouté(s), ${data?.updated ?? 0} mis à jour, ${data?.skipped ?? 0} inchangé(s)`,
      });
    },
    onError: (e: any) => {
      toast({
        title: "Synchro FFN impossible",
        description: String(e?.message || e),
        variant: "destructive",
      });
    },
  });

  const closeSwimEditor = () => {
    setSwimForm(emptySwimForm);
    setSwimEditorOpenFor(null);
  };

  const startSwimEdit = (record: any) => {
    const pl = getPoolLen(record);
    setSwimForm({
      id: record.id,
      event_name: record.event_name ?? "",
      pool_length: pl ? String(pl) : "",
      time_seconds: record.time_seconds != null ? formatTimeSeconds(Number(record.time_seconds)) : "",
      record_date: record.record_date ? String(record.record_date).split("T")[0] : "",
      notes: record.notes ?? "",
    });
    setSwimEditorOpenFor(record.id);
  };

  const submitSwimForm = () => {
    if (!swimForm.event_name.trim()) {
      toast({ title: "Nom d'épreuve requis", variant: "destructive" });
      return;
    }
    if (!swimForm.pool_length) {
      toast({ title: "Bassin requis", variant: "destructive" });
      return;
    }

    const seconds = parseTimeInputToSeconds(swimForm.time_seconds);
    if (seconds === null) {
      toast({ title: "Temps invalide", description: "Ex: 1:02.34 ou 62.34", variant: "destructive" });
      return;
    }

    upsertSwimRecord.mutate({
      id: swimForm.id || null,
      athlete_id: userId,
      athleteName: user,
      athlete_name: user,
      event_name: swimForm.event_name,
      pool_length: parseInt(swimForm.pool_length, 10),
      time_seconds: seconds,
      record_date: swimForm.record_date || null,
      notes: swimForm.notes || null,
      record_type: swimMode,
    });
  };

  const handleSwimSubmit = (event: FormEvent) => {
    event.preventDefault();
    submitSwimForm();
  };

  // ✅ Single source for the list: strict local filter (no FFN refresh)
  const filteredSwimRecords = useMemo(() => {
    const list = (swimRecords as any)?.records ?? [];

    const filtered = list
      .filter((r: any) => {
        const pl = getPoolLen(r);
        if (!pl) return false;
        if (pl !== poolLen) return false;

        const type = String(r.record_type ?? "training");
        if (swimMode === "comp") return type === "comp";
        return type === "training";
      })
      .sort((a: any, b: any) => {
        const nameA = String(a.event_name ?? "");
        const nameB = String(b.event_name ?? "");

        const norm = (s: string) =>
          String(s ?? "")
            .toLowerCase()
            .replace(/\./g, "")
            .replace(/\s+/g, " ")
            .trim();

        const strokeKey = (s: string) => {
          const n = norm(s);
          // Order: NL > Dos > Brasse > Pap > 4N
          if (n.includes("nl") || n.includes("nage libre")) return 0;
          if (n.includes("dos")) return 1;
          if (n.includes("bra") || n.includes("brasse")) return 2;
          if (n.includes("pap") || n.includes("papillon")) return 3;
          if (n.includes("4n") || n.includes("4 n") || n.includes("4 nages")) return 4;
          return 99;
        };

        const distance = (s: string) => {
          const m = String(s ?? "").match(/^(\d+)/);
          return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
        };

        const sa = strokeKey(nameA);
        const sb = strokeKey(nameB);
        if (sa !== sb) return sa - sb;

        const da = distance(nameA);
        const db = distance(nameB);
        if (da !== db) return da - db;

        // deterministic fallback (should rarely matter)
        return norm(nameA).localeCompare(norm(nameB), "fr");
      });

    return filtered;
  }, [swimRecords, poolLen, swimMode]);

  const openAddSwim = () => {
    setSwimForm({ ...emptySwimForm, pool_length: String(poolLen) });
    setSwimEditorOpenFor("add");
  };

  const setModeSafe = (mode: SwimMode) => {
    setSwimMode(mode);
    closeSwimEditor();
  };

  const togglePoolPill = () => {
    setPoolLen((p) => (p === 25 ? 50 : 25));
    closeSwimEditor();
  };

  const openOneRmEdit = (exerciseId: number, current?: number | null) => {
    setEditingExerciseId(exerciseId);
    setEditingOneRmValue(current != null && Number(current) > 0 ? String(current) : "");
  };

  const cancelOneRmEdit = () => {
    setEditingExerciseId(null);
    setEditingOneRmValue("");
  };

  const saveOneRmEdit = (exerciseId: number, draft: string) => {
    const v = Number(String(draft ?? "").replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) {
      toast({ title: "Valeur invalide", description: "Entrez un nombre > 0", variant: "destructive" });
      return;
    }
    update1RM.mutate({ exercise_id: exerciseId, one_rm: v });
    cancelOneRmEdit();
  };

  const SwimColsTraining = "grid-cols-[minmax(0,1fr)_4.75rem_4.75rem_2.5rem]";
  const SwimColsComp = "grid-cols-[minmax(0,1fr)_4.75rem_3.75rem_4.75rem]";
  const swimCols = swimMode === "training" ? SwimColsTraining : SwimColsComp;

  if (!showRecords) {
    return (
      <div className="min-h-[100dvh]">
        <div className="mx-auto max-w-lg">
          <div className="sticky top-0 z-20 backdrop-blur bg-background/80 border-b border-border">
            <div className="px-4 pt-4 pb-3">
              <div className="text-xl font-semibold tracking-tight">Records</div>
              <div className="mt-0.5 text-sm text-muted-foreground">Natation &amp; 1RM musculation</div>
            </div>
          </div>

          <div className="px-4 pt-4 pb-10">
            <Card className="rounded-2xl">
              <CardContent className="pt-6 text-sm text-muted-foreground">
                Cette page est réservée aux nageurs.
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh]">
      <div className="mx-auto max-w-lg">
        <div className="sticky top-0 z-20 backdrop-blur bg-background/80 border-b border-border">
          <div className="px-4 pt-4 pb-3">
            <div className="text-xl font-semibold tracking-tight">Records</div>
            <div className="mt-0.5 text-sm text-muted-foreground">Natation &amp; 1RM musculation</div>
          </div>
        </div>

        <div className="px-2 sm:px-4 pt-3">
          <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "swim" | "1rm")}>
            <TabsList className="w-full rounded-3xl bg-muted/60 border border-border shadow-sm p-1.5 flex">
              <TabsTrigger
                value="swim"
                className="flex-1 rounded-2xl px-4 py-2.5 text-sm font-semibold uppercase tracking-wide gap-2
                  data-[state=active]:bg-background data-[state=active]:text-foreground
                  data-[state=inactive]:text-muted-foreground"
              >
                <Waves className="h-4 w-4" />
                Natation
              </TabsTrigger>
              <TabsTrigger
                value="1rm"
                className="flex-1 rounded-2xl px-4 py-2.5 text-sm font-semibold uppercase tracking-wide gap-2
                  data-[state=active]:bg-background data-[state=active]:text-foreground
                  data-[state=inactive]:text-muted-foreground"
              >
                <Dumbbell className="h-4 w-4" />
                Musculation
              </TabsTrigger>
            </TabsList>

            {mainTab === "swim" ? (
              <div className="mt-3">
                {/* 2e rangée (plus subtile que les tabs du haut) */}
                <div className="w-full rounded-2xl bg-muted/25 border border-border/60 p-1 flex">
                  <button
                    type="button"
                    onClick={() => setModeSafe("training")}
                    className={cx(
                      "flex-1 rounded-2xl px-3 py-2 text-sm max-[360px]:text-xs font-semibold transition inline-flex items-center justify-center gap-2 whitespace-nowrap",
                      swimMode === "training"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    aria-pressed={swimMode === "training"}
                  >
                    <Trophy className="h-4 w-4 max-[360px]:hidden" />
                    Entraînement
                  </button>

                  <button
                    type="button"
                    onClick={() => setModeSafe("comp")}
                    className={cx(
                      "flex-1 rounded-2xl px-3 py-2 text-sm max-[360px]:text-xs font-semibold transition inline-flex items-center justify-center gap-2 whitespace-nowrap",
                      swimMode === "comp"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    aria-pressed={swimMode === "comp"}
                  >
                    <Waves className="h-4 w-4 max-[360px]:hidden" />
                    Compétition
                  </button>
                </div>
              </div>
            ) : null}

            <TabsContent value="swim" className="mt-0">
              <div className="mt-5 mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-2xl bg-muted/50 border border-border flex items-center justify-center">
                    {swimMode === "training" ? (
                      <Trophy className="h-5 w-5" />
                    ) : (
                      <Waves className="h-5 w-5" />
                    )}
                  </div>
                  <div className="text-sm font-semibold">
                    {swimMode === "training" ? "Records entraînement" : "Records compétition"}{" "}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={togglePoolPill}
                    className="inline-flex items-center gap-2 whitespace-nowrap rounded-2xl bg-muted/25 border border-border/60 px-3 py-2 text-sm font-semibold active:scale-[0.99] transition"
                    aria-label="Changer le bassin"
                    title="Appuie pour basculer 25m / 50m"
                  >
                    <span className="inline-flex items-center justify-center h-6 w-6 rounded-xl bg-background/60 border border-border">
                      <Waves className="h-4 w-4" />
                    </span>
                    <span className="tabular-nums">{poolLen}m</span>
                  </button>

                  {swimMode !== "comp" ? (
                    <Button type="button" size="sm" onClick={openAddSwim} className="rounded-2xl">
                      Ajouter
                    </Button>
                  ) : null}
                </div>
              </div>

              {swimMode === "comp" ? (
                <div className="-mt-1 mb-2 text-xs text-muted-foreground">
                  Records fédération (lecture seule).
                </div>
              ) : null}

              <Card className="w-full overflow-hidden rounded-2xl">
                <CardContent className="p-0">
                  {swimLoading ? (
                    <div className="p-4 grid gap-3">
                      <SkeletonRow />
                      <SkeletonRow />
                      <SkeletonRow />
                    </div>
                  ) : swimIsError ? (
                    <div className="p-4 text-sm text-muted-foreground">
                      Impossible de charger les records natation.
                    </div>
                  ) : filteredSwimRecords.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-muted-foreground">
                      Aucun record en bassin {poolLen}m.
                    </div>
                  ) : (
                    <div className="w-full">
                      {/* Table header */}
                      <div className="px-3 sm:px-4 py-2 text-[11px] text-muted-foreground border-b border-border">
                        <div className={cx("grid items-center gap-2", swimCols)}>
                          <div className="truncate justify-self-start">Épreuve</div>
                          <div className="whitespace-nowrap justify-self-end">Temps</div>
                          {swimMode === "comp" ? (
                            <div className="whitespace-nowrap justify-self-end">Pts</div>
                          ) : (
                            <div className="whitespace-nowrap justify-self-end">Date</div>
                          )}
                          {swimMode === "comp" ? (
                            <div className="whitespace-nowrap justify-self-end">Date</div>
                          ) : (
                            <div className="sr-only">Actions</div>
                          )}
                        </div>
                      </div>

                      <div className="divide-y divide-border">
                        {filteredSwimRecords.map((record: any) => {
                          const isEditing = swimEditorOpenFor === record.id;
                          const time = formatTimeSeconds(record.time_seconds);
                          const date = formatDateShort(record.record_date);
                          const notes = (record.notes ?? "").trim();

                          const rawPts =
                            record?.ffn_points ??
                            record?.ffnPoints ??
                            record?.points ??
                            record?.pts ??
                            null;

                          const ptsNum =
                            rawPts === null || rawPts === undefined || rawPts === "" ? NaN : Number(rawPts);

                          const points = Number.isFinite(ptsNum) ? ptsNum : parseFfnPointsFromNotes(record?.notes);

                          const meet =
                            (record?.meet ?? record?.meet_name ?? record?.meetName ?? record?.competition ?? "").trim?.() ??
                            "";

                          return (
                            <div key={record.id} className="px-3 sm:px-4 py-3">
                              <div className={cx("grid items-center gap-2", swimCols)}>
                                <div className="min-w-0 justify-self-start">
                                  <div className="text-sm font-semibold truncate">{record.event_name}</div>
                                </div>

                                <div className="justify-self-end text-sm font-semibold tabular-nums whitespace-nowrap overflow-hidden font-mono">
                                  {time}
                                </div>

                                {swimMode === "comp" ? (
                                  <div className="justify-self-end text-sm tabular-nums text-muted-foreground whitespace-nowrap overflow-hidden">
                                    {points == null ? "—" : String(points)}
                                  </div>
                                ) : (
                                  <div className="justify-self-end text-sm tabular-nums text-muted-foreground whitespace-nowrap overflow-hidden">
                                    {date}
                                  </div>
                                )}

                                {swimMode === "comp" ? (
                                  <div className="justify-self-end text-sm tabular-nums text-muted-foreground whitespace-nowrap overflow-hidden">
                                    {date}
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => startSwimEdit(record)}
                                    className="justify-self-end inline-flex items-center justify-center h-9 w-9 rounded-xl bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring/20"
                                    aria-label={`Modifier ${record.event_name}`}
                                    title="Modifier"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>

                              {swimMode === "comp" && meet ? (
                                <div className="mt-1 text-xs text-muted-foreground truncate">{meet}</div>
                              ) : null}

                              {swimMode === "training" && notes ? (
                                <div className="mt-1 text-xs text-muted-foreground truncate">{notes}</div>
                              ) : null}

                              {swimMode === "training" && isEditing ? (
                                <div className="mt-3">
                                  <div className="rounded-2xl bg-muted/30 border border-border p-4 space-y-4">
                                    <div className="grid gap-4 sm:grid-cols-2">
                                      <div className="grid gap-2">
                                        <Label>Temps</Label>
                                        <Input
                                          value={swimForm.time_seconds}
                                          inputMode="decimal"
                                          placeholder="1:02.34"
                                          onChange={(e) => setSwimForm({ ...swimForm, time_seconds: e.target.value })}
                                          className="rounded-xl"
                                        />
                                        <div className="text-xs text-muted-foreground">Format: mm:ss.cc ou secondes</div>
                                      </div>

                                      <div className="grid gap-2">
                                        <Label>Date</Label>
                                        <Input
                                          type="date"
                                          value={swimForm.record_date}
                                          onChange={(e) => setSwimForm({ ...swimForm, record_date: e.target.value })}
                                          className="rounded-xl"
                                        />
                                      </div>
                                    </div>

                                    <div className="grid gap-2">
                                      <Label>Notes</Label>
                                      <Textarea
                                        value={swimForm.notes}
                                        onChange={(e) => setSwimForm({ ...swimForm, notes: e.target.value })}
                                        rows={2}
                                        className="rounded-xl"
                                      />
                                    </div>

                                    <div className="flex items-center justify-end gap-2">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={closeSwimEditor}
                                        className="rounded-2xl gap-2"
                                      >
                                        <X className="h-4 w-4" />
                                        Annuler
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={submitSwimForm}
                                        disabled={upsertSwimRecord.isPending}
                                        className="rounded-2xl gap-2"
                                      >
                                        <Check className="h-4 w-4" />
                                        Enregistrer
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {swimMode === "training" && swimEditorOpenFor === "add" ? (
                <div className="px-4 mt-4">
                  <form onSubmit={handleSwimSubmit}>
                    <div className="rounded-2xl border border-border p-4 space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                          <Label>Épreuve</Label>
                          <Input
                            value={swimForm.event_name}
                            onChange={(e) => setSwimForm({ ...swimForm, event_name: e.target.value })}
                            placeholder="Ex: 100 NL, 200 Dos"
                            className="rounded-xl"
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label>Bassin (m)</Label>
                          <Select
                            value={swimForm.pool_length}
                            onValueChange={(value) => setSwimForm({ ...swimForm, pool_length: value })}
                          >
                            <SelectTrigger className="rounded-xl">
                              <SelectValue placeholder="Choisir" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="25">25</SelectItem>
                              <SelectItem value="50">50</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid gap-2">
                          <Label>Temps</Label>
                          <Input
                            value={swimForm.time_seconds}
                            inputMode="decimal"
                            placeholder="1:02.34"
                            onChange={(e) => setSwimForm({ ...swimForm, time_seconds: e.target.value })}
                            className="rounded-xl"
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label>Date</Label>
                          <Input
                            type="date"
                            value={swimForm.record_date}
                            onChange={(e) => setSwimForm({ ...swimForm, record_date: e.target.value })}
                            className="rounded-xl"
                          />
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label>Notes</Label>
                        <Textarea
                          value={swimForm.notes}
                          onChange={(e) => setSwimForm({ ...swimForm, notes: e.target.value })}
                          rows={3}
                          className="rounded-xl"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        <Button type="button" variant="outline" onClick={closeSwimEditor} className="rounded-2xl">
                          Annuler
                        </Button>
                        <Button type="submit" disabled={upsertSwimRecord.isPending} className="rounded-2xl">
                          Ajouter
                        </Button>
                      </div>
                    </div>
                  </form>
                </div>
              ) : null}

              <div className="h-10" />
            </TabsContent>

            <TabsContent value="1rm" className="mt-0">
              <div className="mt-5 mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-2xl bg-muted/50 border border-border flex items-center justify-center">
                    <Dumbbell className="h-5 w-5" />
                  </div>
                  <div className="text-sm font-semibold">1RM musculation</div>
                </div>
              </div>

              <Card className="w-full overflow-hidden rounded-2xl">
                <CardContent className="p-0">
                  {oneRmLoading || exercisesLoading ? (
                    <div className="p-4 grid gap-3">
                      <SkeletonRow />
                      <SkeletonRow />
                      <SkeletonRow />
                    </div>
                  ) : oneRmIsError || exercisesIsError ? (
                    <div className="p-4 text-sm text-muted-foreground">
                      Impossible de charger les records musculation.
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {(exercises as any[])
                        ?.filter((e) => e.exercise_type !== "warmup")
                        .map((ex) => {
                          const record = oneRMs?.find((r) => r.exercise_id === ex.id);
                          const recordWeight = Number(record?.weight ?? 0);
                          const displayWeight = recordWeight > 0 ? `${recordWeight} kg` : "—";
                          const recordDate = record?.recorded_at ?? record?.date ?? null;

                          const isEditing = editingExerciseId === ex.id;

                          return (
                            <div key={ex.id} className="px-3 sm:px-4 py-3">
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold truncate">{ex.nom_exercice}</div>
                                  <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                                    {formatDateShort(recordDate)}
                                  </div>
                                </div>

                                <div className="text-right shrink-0">
                                  <div className="text-base font-semibold tabular-nums whitespace-nowrap font-mono">
                                    {displayWeight}
                                  </div>

                                  {!isEditing ? (
                                    <button
                                      type="button"
                                      onClick={() => openOneRmEdit(ex.id, record?.weight ?? null)}
                                      className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                                    >
                                      <Edit2 className="h-3.5 w-3.5" />
                                      Modifier
                                    </button>
                                  ) : null}
                                </div>
                              </div>

                              {isEditing ? (
                                <div className="mt-3">
                                  <InlineEditBar
                                    value={editingOneRmValue}
                                    placeholder="Ex: 100"
                                    inputMode="decimal"
                                    hint="Charge max (kg)."
                                    onCancel={cancelOneRmEdit}
                                    onSave={(draft) => saveOneRmEdit(ex.id, draft)}
                                  />
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {update1RM.isPending ? (
                    <div className="px-4 pb-4 text-xs text-muted-foreground flex items-center gap-2">
                      <RefreshCw className="h-3 w-3 animate-spin" /> Mise à jour...
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <div className="h-10" />
            </TabsContent>
          </Tabs>
        </div>

        <div className="pb-10" />
      </div>
    </div>
  );
}
