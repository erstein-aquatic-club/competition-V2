import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { api, type Exercise, type SwimmerPerformance } from "@/lib/api";
import type { SwimRecordWithPool } from "@/lib/types";
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
import { Check, ChevronDown, Clock, Dumbbell, Edit2, Download, RefreshCw, StickyNote, Trophy, Waves, X, AlertCircle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import { staggerChildren, listItem, successBounce, fadeIn } from "@/lib/animations";

type OneRmRecord = {
  exercise_id: number;
  weight?: number | null;
  recorded_at?: string | null;
  date?: string | null;
  notes?: string | null;
};

type SwimMode = "training" | "comp" | "history";
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

const SkeletonRow = () => <div className="h-10 rounded-xl bg-muted animate-pulse motion-reduce:animate-none" />;

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

  const [mainTab, setMainTab] = useState<"swim" | "1rm">(() => {
    const hash = window.location.hash;
    const qIdx = hash.indexOf("?");
    if (qIdx >= 0) {
      const params = new URLSearchParams(hash.substring(qIdx));
      if (params.get("tab") === "1rm") return "1rm";
    }
    return "swim";
  });

  const [swimForm, setSwimForm] = useState(emptySwimForm);
  const [swimMode, setSwimMode] = useState<SwimMode>("training");
  const [poolLen, setPoolLen] = useState<25 | 50>(25);
  const [swimEditorOpenFor, setSwimEditorOpenFor] = useState<SwimEditorOpenFor>(null);

  const [editingExerciseId, setEditingExerciseId] = useState<number | null>(null);
  const [editingOneRmValue, setEditingOneRmValue] = useState<string>("");
  const [expandedExerciseId, setExpandedExerciseId] = useState<number | null>(null);
  const [editingNoteExerciseId, setEditingNoteExerciseId] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>("");

  // History tab state
  const [histPoolLen, setHistPoolLen] = useState<25 | 50>(25);
  const [histExpandedEvent, setHistExpandedEvent] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<boolean>(false);

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
  const getPoolLen = (r: SwimRecordWithPool): 25 | 50 | null => {
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

  // Profile query (for IUF)
  const profileQuery = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => api.getProfile({ userId: userId ?? undefined }),
    enabled: !!userId && showRecords,
  });
  const userIuf = String(profileQuery.data?.ffn_iuf ?? "").trim();

  const mainError = oneRmQuery.error || exercisesQuery.error || swimRecordsQuery.error || profileQuery.error;
  const refetchAll = () => {
    oneRmQuery.refetch();
    exercisesQuery.refetch();
    swimRecordsQuery.refetch();
    profileQuery.refetch();
  };

  // Swimmer performances query (history tab)
  const performancesQuery = useQuery<SwimmerPerformance[]>({
    queryKey: ["swimmer-performances", userId, userIuf, histPoolLen],
    queryFn: () =>
      api.getSwimmerPerformances({
        userId: userId ?? undefined,
        iuf: userIuf || undefined,
        poolLength: histPoolLen,
      }),
    enabled: !!userIuf && showRecords && swimMode === "history",
  });

  const { data: performances, isLoading: perfLoading, isError: perfIsError } = performancesQuery;

  // Import performances mutation
  const importPerformances = useMutation({
    mutationFn: () => {
      if (!userIuf) throw new Error("IUF FFN manquant. Ajoutez-le dans votre profil.");
      return api.importSwimmerPerformances({ iuf: userIuf, userId: userId ?? undefined });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["swimmer-performances"] });
      toast({
        title: "Import terminé",
        description: `${data.total_found} trouvée(s), ${data.new_imported} importée(s), ${data.already_existed} déjà existante(s)`,
      });
      setImportSuccess(true);
      setTimeout(() => setImportSuccess(false), 2000);
    },
    onError: (e: Error) => {
      toast({
        title: "Import impossible",
        description: String(e?.message || e),
        variant: "destructive",
      });
    },
  });

  // Group performances by event_code, sorted by stroke+distance
  const groupedPerformances = useMemo(() => {
    if (!performances?.length) return [];
    const map = new Map<string, SwimmerPerformance[]>();
    for (const p of performances) {
      const list = map.get(p.event_code) ?? [];
      list.push(p);
      map.set(p.event_code, list);
    }

    const norm = (s: string) => s.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
    const strokeKey = (s: string) => {
      const n = norm(s);
      if (n.includes("nl") || n.includes("nage libre")) return 0;
      if (n.includes("dos")) return 1;
      if (n.includes("bra") || n.includes("brasse")) return 2;
      if (n.includes("pap") || n.includes("papillon")) return 3;
      if (n.includes("4n") || n.includes("4 n") || n.includes("4 nages")) return 4;
      return 99;
    };
    const distance = (s: string) => {
      const m = s.match(/^(\d+)/);
      return m ? Number(m[1]) : Infinity;
    };

    return [...map.entries()]
      .map(([eventCode, perfs]) => {
        const sorted = [...perfs].sort(
          (a, b) => (b.competition_date ?? "").localeCompare(a.competition_date ?? "")
        );
        const best = sorted.reduce((min, p) => (p.time_seconds < min.time_seconds ? p : min), sorted[0]);
        return { eventCode, performances: sorted, bestTime: best.time_seconds, bestId: best.id };
      })
      .sort((a, b) => {
        const sa = strokeKey(a.eventCode);
        const sb = strokeKey(b.eventCode);
        if (sa !== sb) return sa - sb;
        return distance(a.eventCode) - distance(b.eventCode);
      });
  }, [performances]);

  // Chart data for expanded event (ascending date order)
  const chartData = useMemo(() => {
    if (!histExpandedEvent) return [];
    const group = groupedPerformances.find((g) => g.eventCode === histExpandedEvent);
    if (!group) return [];
    return [...group.performances]
      .filter((p) => p.competition_date)
      .sort((a, b) => (a.competition_date ?? "").localeCompare(b.competition_date ?? ""))
      .map((p) => ({
        date: formatDateShort(p.competition_date),
        time: p.time_seconds,
        display: p.time_display ?? formatTimeSeconds(p.time_seconds),
      }));
  }, [histExpandedEvent, groupedPerformances]);

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
    mutationFn: (data: { exercise_id: number; one_rm?: number; weight?: number }) => api.update1RM({ ...data, athlete_id: userId, athlete_name: user }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["1rm"] });
      toast({ title: "1RM mis à jour" });
    },
  });

  const updateExerciseNote = useMutation({
    mutationFn: (data: { exercise_id: number; notes: string | null }) =>
      api.updateExerciseNote({ athlete_id: userId!, exercise_id: data.exercise_id, notes: data.notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["1rm"] });
      toast({ title: "Note mise à jour" });
    },
  });

  const upsertSwimRecord = useMutation({
    mutationFn: (data: Parameters<typeof api.upsertSwimRecord>[0]) => api.upsertSwimRecord(data),
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
    onSuccess: (data: { inserted: number; updated: number; skipped: number }) => {
      queryClient.invalidateQueries({ queryKey: ["swim-records"] });
      toast({
        title: "Synchro FFN terminée",
        description: `${data?.inserted ?? 0} ajouté(s), ${data?.updated ?? 0} mis à jour, ${data?.skipped ?? 0} inchangé(s)`,
      });
    },
    onError: (e: Error) => {
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

  const startSwimEdit = (record: SwimRecordWithPool) => {
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
    const list = (swimRecords as { records?: SwimRecordWithPool[] } | undefined)?.records ?? [];

    const filtered = list
      .filter((r: SwimRecordWithPool) => {
        const pl = getPoolLen(r);
        if (!pl) return false;
        if (pl !== poolLen) return false;

        const type = String(r.record_type ?? "training");
        if (swimMode === "comp") return type === "comp";
        return type === "training";
      })
      .sort((a: SwimRecordWithPool, b: SwimRecordWithPool) => {
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

  // Grid columns removed — using flex card layout instead

  if (!showRecords) {
    return (
      <div className="min-h-[100dvh]">
        <div className="mx-auto max-w-lg px-4 pt-16 pb-10 text-center">
          <Waves className="h-10 w-10 mx-auto text-muted-foreground/30" />
          <p className="mt-3 text-sm text-muted-foreground">
            Cette page est réservée aux nageurs.
          </p>
        </div>
      </div>
    );
  }

  if (mainError) {
    return (
      <div className="min-h-[100dvh]">
        <div className="mx-auto max-w-lg px-4 pt-16 pb-10 text-center">
          <AlertCircle className="h-10 w-10 mx-auto text-destructive/60" />
          <p className="mt-3 text-sm font-semibold">Impossible de charger les données</p>
          <p className="mt-1 text-xs text-muted-foreground">{(mainError as Error).message}</p>
          <Button onClick={refetchAll} size="sm" className="mt-4 rounded-2xl">
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh]">
      <div className="mx-auto max-w-lg">
        <div className="sticky top-0 z-overlay backdrop-blur bg-background/80 border-b border-border">
          <div className="px-4 py-3">
            <h1 className="text-lg font-display font-bold uppercase italic tracking-tight">Mes Records</h1>
          </div>
        </div>

        <div className="px-3 pt-3">
          <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "swim" | "1rm")}>
            <TabsList className="w-full rounded-2xl bg-muted/50 border border-border p-1 flex">
              <TabsTrigger
                value="swim"
                aria-label="Records de natation"
                className="flex-1 rounded-xl px-3 py-2 text-sm font-bold uppercase tracking-wide gap-1.5
                  data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm
                  data-[state=inactive]:text-muted-foreground"
              >
                <Waves className="h-4 w-4" />
                Natation
              </TabsTrigger>
              <TabsTrigger
                value="1rm"
                aria-label="Records de musculation"
                className="flex-1 rounded-xl px-3 py-2 text-sm font-bold uppercase tracking-wide gap-1.5
                  data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm
                  data-[state=inactive]:text-muted-foreground"
              >
                <Dumbbell className="h-4 w-4" />
                Musculation
              </TabsTrigger>
            </TabsList>

            {mainTab === "swim" ? (
              <div className="mt-2.5 space-y-2">
                {/* Mode toggle */}
                <div className="flex rounded-xl bg-muted/20 border border-border/50 p-0.5">
                  {(["training", "comp", "history"] as const).map((mode) => {
                    const label = mode === "training" ? "Entraîn." : mode === "comp" ? "Compétition" : "Historique";
                    const Icon = mode === "training" ? Trophy : mode === "comp" ? Waves : Clock;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setModeSafe(mode)}
                        className={cx(
                          "flex-1 rounded-lg px-2 py-1.5 text-xs max-[360px]:text-[10px] font-bold transition inline-flex items-center justify-center gap-1 whitespace-nowrap",
                          swimMode === mode
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        aria-pressed={swimMode === mode}
                      >
                        <Icon className="h-3.5 w-3.5 max-[360px]:hidden" />
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* Controls row: unified pool toggle + contextual action */}
                <div className="flex items-center justify-between">
                  <div className="inline-flex rounded-xl border border-border bg-muted/30 p-0.5">
                    {([25, 50] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          if (swimMode === "history") {
                            setHistPoolLen(v);
                          } else {
                            setPoolLen(v);
                            closeSwimEditor();
                          }
                        }}
                        className={cx(
                          "px-3 py-1 text-xs font-bold rounded-lg tabular-nums transition",
                          (swimMode === "history" ? histPoolLen : poolLen) === v
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {v}m
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    {swimMode === "training" && (
                      <Button type="button" size="sm" onClick={openAddSwim} className="rounded-xl text-xs h-8 gap-1">
                        Ajouter
                      </Button>
                    )}
                    {swimMode === "comp" && (
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
                        Données FFN
                      </span>
                    )}
                    {swimMode === "history" && (
                      <motion.div
                        variants={successBounce}
                        animate={importSuccess ? "visible" : "hidden"}
                      >
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => importPerformances.mutate()}
                          disabled={importPerformances.isPending || !userIuf}
                          className="rounded-xl text-xs h-8 gap-1"
                        >
                          {importPerformances.isPending ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <Download className="h-3 w-3" />
                          )}
                          {importPerformances.isPending ? "Import..." : "Importer FFN"}
                        </Button>
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            <TabsContent value="swim" className="mt-0">
              {swimMode !== "history" ? (
              <>
              <div className="mt-3">

              {/* Add form (training, above list) */}
              {swimMode === "training" && swimEditorOpenFor === "add" ? (
                <motion.div variants={fadeIn} initial="hidden" animate="visible" className="mb-3">
                  <form onSubmit={handleSwimSubmit}>
                    <Card className="rounded-2xl">
                      <CardContent className="p-3 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2">
                            <Label className="text-xs mb-1.5 block">Épreuve</Label>
                            <Input
                              value={swimForm.event_name}
                              onChange={(e) => setSwimForm({ ...swimForm, event_name: e.target.value })}
                              placeholder="Ex: 100 NL, 200 Dos"
                              className="h-9 rounded-lg"
                            />
                          </div>
                          <div>
                            <Label className="text-xs mb-1.5 block">Bassin</Label>
                            <Select
                              value={swimForm.pool_length}
                              onValueChange={(value) => setSwimForm({ ...swimForm, pool_length: value })}
                            >
                              <SelectTrigger className="h-9 rounded-lg">
                                <SelectValue placeholder="—" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="25">25m</SelectItem>
                                <SelectItem value="50">50m</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs mb-1.5 block">Temps</Label>
                            <Input
                              value={swimForm.time_seconds}
                              inputMode="decimal"
                              placeholder="1:02.34"
                              onChange={(e) => setSwimForm({ ...swimForm, time_seconds: e.target.value })}
                              className="h-9 rounded-lg"
                            />
                          </div>
                          <div>
                            <Label className="text-xs mb-1.5 block">Date</Label>
                            <Input
                              type="date"
                              value={swimForm.record_date}
                              onChange={(e) => setSwimForm({ ...swimForm, record_date: e.target.value })}
                              className="h-9 rounded-lg"
                            />
                          </div>
                          <div>
                            <Label className="text-xs mb-1.5 block">Notes</Label>
                            <Input
                              value={swimForm.notes}
                              onChange={(e) => setSwimForm({ ...swimForm, notes: e.target.value })}
                              placeholder="Optionnel"
                              className="h-9 rounded-lg"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={closeSwimEditor} className="rounded-xl h-8 text-xs gap-1">
                            <X className="h-3 w-3" />
                            Annuler
                          </Button>
                          <Button type="submit" size="sm" disabled={upsertSwimRecord.isPending} className="rounded-xl h-8 text-xs gap-1">
                            <Check className="h-3 w-3" />
                            Ajouter
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </form>
                </motion.div>
              ) : null}

              <Card className="w-full min-w-0 rounded-2xl">
                <CardContent className="p-0">
                  {swimLoading ? (
                    <div className="p-4 grid gap-3">
                      <SkeletonRow />
                      <SkeletonRow />
                      <SkeletonRow />
                    </div>
                  ) : swimIsError ? (
                    <div className="mx-4 my-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
                      Impossible de charger les records natation.
                    </div>
                  ) : filteredSwimRecords.length === 0 ? (
                    <div className="py-8 text-center">
                      <Waves className="h-8 w-8 mx-auto text-muted-foreground/30" />
                      <p className="mt-2 text-sm text-muted-foreground">
                        Aucun record en {poolLen}m
                      </p>
                      {swimMode === "training" && (
                        <Button type="button" size="sm" variant="outline" onClick={openAddSwim} className="mt-3 rounded-xl text-xs h-8">
                          Ajouter un record
                        </Button>
                      )}
                    </div>
                  ) : (
                    <motion.div
                      className="divide-y divide-border motion-reduce:animate-none"
                      variants={staggerChildren}
                      initial="hidden"
                      animate="visible"
                    >
                      {filteredSwimRecords.map((record) => {
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
                          rawPts === null || rawPts === undefined ? NaN : Number(rawPts);

                        const points = Number.isFinite(ptsNum) ? ptsNum : parseFfnPointsFromNotes(record?.notes);

                        const meet =
                          (record?.meet ?? record?.meet_name ?? record?.meetName ?? record?.competition ?? "").trim?.() ??
                          "";

                        return (
                          <motion.div key={record.id} className="px-3 py-2.5 motion-reduce:animate-none" variants={listItem}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold truncate">{record.event_name}</span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-mono text-primary font-bold tabular-nums text-sm">
                                  {time}
                                </span>
                                {swimMode === "training" && (
                                  <button
                                    type="button"
                                    onClick={() => startSwimEdit(record)}
                                    className="inline-flex items-center justify-center h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition"
                                    aria-label={`Modifier ${record.event_name}`}
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                              {swimMode === "comp" && points != null && (
                                <span className="tabular-nums">{String(points)} pts</span>
                              )}
                              <span className="tabular-nums">{date}</span>
                              {swimMode === "comp" && meet && (
                                <span className="truncate">{meet}</span>
                              )}
                              {swimMode === "training" && notes && (
                                <span className="truncate italic">{notes}</span>
                              )}
                            </div>

                              {swimMode === "training" && isEditing ? (
                                <motion.div
                                  className="mt-3"
                                  variants={fadeIn}
                                  initial="hidden"
                                  animate="visible"
                                >
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
                                </motion.div>
                              ) : null}
                            </motion.div>
                        );
                      })}
                    </motion.div>
                  )}
                </CardContent>
              </Card>

              </div>
              </>
              ) : null}

              {/* ===== HISTORY TAB CONTENT ===== */}
              {swimMode === "history" ? (
                <div className="mt-3 space-y-3">
                  {/* Alerts */}
                  {profileQuery.isError ? (
                    <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                      Impossible de charger votre profil.
                    </div>
                  ) : null}

                  {!profileQuery.isError && !userIuf && !profileQuery.isLoading ? (
                    <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3 text-xs text-yellow-700 dark:text-yellow-400">
                      <p className="font-semibold mb-0.5">IUF FFN non renseigné</p>
                      <p>
                        Renseignez votre numéro IUF dans{" "}
                        <a href="/#/profile" className="underline font-medium hover:text-foreground">votre profil</a>
                        {" "}pour importer vos performances.
                      </p>
                    </div>
                  ) : null}

                  {/* Event-grouped performance cards */}
                  {perfLoading ? (
                    <div className="grid gap-3">
                      <SkeletonRow />
                      <SkeletonRow />
                      <SkeletonRow />
                    </div>
                  ) : perfIsError ? (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
                      <p className="font-semibold">Impossible de charger les performances</p>
                      <p className="mt-1 text-xs">
                        {performancesQuery.error instanceof Error
                          ? performancesQuery.error.message
                          : "Vérifiez votre connexion internet et réessayez."}
                      </p>
                    </div>
                  ) : groupedPerformances.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-muted-foreground">
                      {userIuf
                        ? "Aucune performance trouvée. Cliquez sur \"Importer\" pour récupérer vos données FFN."
                        : "Ajoutez votre IUF FFN dans votre profil pour commencer."}
                    </div>
                  ) : (
                    <motion.div
                      className="space-y-2 motion-reduce:animate-none"
                      variants={staggerChildren}
                      initial="hidden"
                      animate="visible"
                    >
                      {groupedPerformances.map((group) => {
                        const isExpanded = histExpandedEvent === group.eventCode;
                        const toggleExpand = () =>
                          setHistExpandedEvent(isExpanded ? null : group.eventCode);

                        return (
                          <motion.div key={group.eventCode} variants={listItem}>
                            <Card className="rounded-2xl">
                              <CardContent className="p-0">
                                {/* Collapsed header */}
                                <button
                                  type="button"
                                  onClick={toggleExpand}
                                  className="w-full flex items-center justify-between gap-2 px-3 py-3 text-left cursor-pointer"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <ChevronDown
                                      className={cx(
                                        "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                                        isExpanded && "rotate-180"
                                      )}
                                    />
                                    <span className="text-sm font-semibold truncate">
                                      {group.eventCode}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="font-mono text-primary font-bold tabular-nums text-sm">
                                      {formatTimeSeconds(group.bestTime)}
                                    </span>
                                    <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
                                      {group.performances.length}
                                    </span>
                                  </div>
                                </button>

                                {/* Expanded content */}
                                {isExpanded ? (
                                  <div className="border-t border-border">
                                    {/* Chart */}
                                    {chartData.length > 1 ? (
                                      <div className="px-2 pt-3 pb-1">
                                        <div className="text-xs text-muted-foreground mb-2 px-2">
                                          Progression ({histPoolLen}m)
                                        </div>
                                        <ResponsiveContainer width="100%" height={160}>
                                          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                            <XAxis dataKey="date" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                                            <YAxis
                                              domain={["auto", "auto"]}
                                              tick={{ fontSize: 10 }}
                                              className="text-muted-foreground"
                                              reversed
                                              tickFormatter={(v: number) => {
                                                const min = Math.floor(v / 60);
                                                const sec = Math.floor(v % 60);
                                                const cs = Math.round((v % 1) * 100);
                                                return min > 0 ? `${min}:${String(sec).padStart(2, "0")}` : `${sec}.${String(cs).padStart(2, "0")}`;
                                              }}
                                            />
                                            <Tooltip
                                              formatter={(value: number) => {
                                                const min = Math.floor(value / 60);
                                                const sec = Math.floor(value % 60);
                                                const cs = Math.round((value % 1) * 100);
                                                const display = min > 0
                                                  ? `${min}:${String(sec).padStart(2, "0")}.${String(cs).padStart(2, "0")}`
                                                  : `${sec}.${String(cs).padStart(2, "0")}`;
                                                return [display, "Temps"];
                                              }}
                                              labelStyle={{ fontSize: 11 }}
                                              contentStyle={{ borderRadius: 12, fontSize: 12 }}
                                            />
                                            <Line
                                              type="monotone"
                                              dataKey="time"
                                              stroke="hsl(var(--primary))"
                                              strokeWidth={2}
                                              dot={{ r: 3 }}
                                              activeDot={{ r: 5 }}
                                            />
                                          </LineChart>
                                        </ResponsiveContainer>
                                      </div>
                                    ) : null}

                                    {/* Performance list */}
                                    <div className="divide-y divide-border">
                                      {group.performances.map((perf) => {
                                        const isBest = perf.id === group.bestId;
                                        return (
                                          <div
                                            key={perf.id}
                                            className={cx(
                                              "px-3 py-2.5",
                                              isBest && "bg-primary/5"
                                            )}
                                          >
                                            <div className="flex items-center justify-between gap-2">
                                              <div className="flex items-center gap-1.5 min-w-0">
                                                {isBest && <Trophy className="h-3.5 w-3.5 text-primary shrink-0" />}
                                                <span className="text-xs text-muted-foreground tabular-nums">
                                                  {formatDateShort(perf.competition_date)}
                                                </span>
                                              </div>
                                              <span className={cx(
                                                "font-mono tabular-nums text-sm shrink-0",
                                                isBest ? "text-primary font-bold" : "font-medium"
                                              )}>
                                                {perf.time_display ?? formatTimeSeconds(perf.time_seconds)}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                                              {perf.ffn_points != null && (
                                                <span className="tabular-nums">{String(perf.ffn_points)} pts</span>
                                              )}
                                              {perf.competition_name && (
                                                <span className="truncate">{perf.competition_name}</span>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ) : null}
                              </CardContent>
                            </Card>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  )}
                </div>
              ) : null}

              <div className="h-6" />
            </TabsContent>

            <TabsContent value="1rm" className="mt-0">
              <div className="mt-3">
              <Card className="w-full min-w-0 rounded-2xl">
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
                    <motion.div
                      className="divide-y divide-border motion-reduce:animate-none"
                      variants={staggerChildren}
                      initial="hidden"
                      animate="visible"
                    >
                      {(exercises as Exercise[])
                        ?.filter((e) => e.exercise_type !== "warmup")
                        .map((ex) => {
                          const record = oneRMs?.find((r) => r.exercise_id === ex.id);
                          const recordWeight = Number(record?.weight ?? 0);
                          const displayWeight = recordWeight > 0 ? `${recordWeight} kg` : "—";
                          const recordDate = record?.recorded_at ?? record?.date ?? null;
                          const exerciseNote = record?.notes ?? null;

                          const isEditing = editingExerciseId === ex.id;
                          const isExpanded = expandedExerciseId === ex.id;
                          const isEditingNote = editingNoteExerciseId === ex.id;

                          return (
                            <motion.div key={ex.id} className="px-3 py-2.5 motion-reduce:animate-none" variants={listItem}>
                              {/* Line 1: Exercise name + weight + edit */}
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold truncate">{ex.nom_exercice}</span>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={cx(
                                    "font-mono font-bold tabular-nums text-sm",
                                    recordWeight > 0 ? "text-primary" : "text-muted-foreground"
                                  )}>
                                    {displayWeight}
                                  </span>
                                  {!isEditing && (
                                    <button
                                      type="button"
                                      onClick={() => openOneRmEdit(ex.id, record?.weight ?? null)}
                                      className="inline-flex items-center justify-center h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition"
                                      aria-label={`Modifier ${ex.nom_exercice}`}
                                    >
                                      <Edit2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Line 2: Date + note + % toggle */}
                              <div className="flex items-center justify-between mt-0.5">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                                  <span className="tabular-nums shrink-0">{formatDateShort(recordDate)}</span>
                                  {exerciseNote && !isEditingNote ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingNoteExerciseId(ex.id);
                                        setNoteDraft(exerciseNote ?? "");
                                      }}
                                      className="truncate italic hover:text-foreground transition text-left"
                                      title="Modifier la note"
                                    >
                                      {exerciseNote}
                                    </button>
                                  ) : null}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (isEditingNote) {
                                        setEditingNoteExerciseId(null);
                                        setNoteDraft("");
                                      } else {
                                        setEditingNoteExerciseId(ex.id);
                                        setNoteDraft(exerciseNote ?? "");
                                      }
                                    }}
                                    className={cx(
                                      "inline-flex items-center justify-center h-7 w-7 rounded-lg transition",
                                      exerciseNote
                                        ? "text-primary hover:text-primary/80"
                                        : "text-muted-foreground/40 hover:text-muted-foreground",
                                    )}
                                    aria-label={exerciseNote ? "Modifier la note" : "Ajouter une note"}
                                  >
                                    <StickyNote className="h-3.5 w-3.5" />
                                  </button>
                                  {recordWeight > 0 && !isEditing ? (
                                    <button
                                      type="button"
                                      onClick={() => setExpandedExerciseId(isExpanded ? null : ex.id)}
                                      className="inline-flex items-center gap-0.5 h-7 px-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground transition"
                                      aria-label="Table des pourcentages"
                                    >
                                      <ChevronDown className={cx("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-180")} />
                                      <span className="text-[10px] font-bold">%</span>
                                    </button>
                                  ) : null}
                                </div>
                              </div>

                              {/* Inline 1RM edit */}
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

                              {/* Inline note edit */}
                              {isEditingNote ? (
                                <div className="mt-3">
                                  <div className="flex items-start gap-2">
                                    <Input
                                      value={noteDraft}
                                      onChange={(e) => setNoteDraft(e.target.value)}
                                      placeholder="Machine n°3, cran 5..."
                                      className="h-9 rounded-lg text-sm flex-1"
                                      autoFocus
                                    />
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() => {
                                        const trimmed = noteDraft.trim() || null;
                                        updateExerciseNote.mutate({ exercise_id: ex.id, notes: trimmed });
                                        setEditingNoteExerciseId(null);
                                        setNoteDraft("");
                                      }}
                                      disabled={updateExerciseNote.isPending}
                                      className="rounded-lg h-9 w-9 p-0 shrink-0"
                                      aria-label="Enregistrer"
                                    >
                                      <Check className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => { setEditingNoteExerciseId(null); setNoteDraft(""); }}
                                      className="rounded-lg h-9 w-9 p-0 shrink-0"
                                      aria-label="Annuler"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ) : null}

                              {/* Percentage table */}
                              {isExpanded && recordWeight > 0 ? (
                                <div className="mt-3 rounded-xl bg-muted/30 border border-border p-3">
                                  <div className="grid grid-cols-5 gap-2 text-center text-xs">
                                    {[50, 60, 70, 80, 90].map((pct) => (
                                      <div key={pct} className="space-y-0.5">
                                        <div className="text-[10px] text-muted-foreground font-medium">{pct}%</div>
                                        <div className="font-bold tabular-nums font-mono">{Math.round(recordWeight * pct / 10) / 10}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </motion.div>
                          );
                        })}
                    </motion.div>
                  )}

                  {update1RM.isPending ? (
                    <div className="px-4 pb-4 text-xs text-muted-foreground flex items-center gap-2">
                      <RefreshCw className="h-3 w-3 animate-spin" /> Mise à jour...
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              </div>
              <div className="h-6" />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
