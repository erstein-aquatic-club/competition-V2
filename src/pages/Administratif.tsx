import * as React from "react";
import { Redirect, type RouteComponentProps } from "wouter";
import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { api, summarizeApiError, type TimesheetLocation } from "@/lib/api";
import { supabaseConfig } from "@/lib/config";
import { useToast } from "@/hooks/use-toast";
import { SafeArea } from "@/components/shared/SafeArea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimesheetShiftForm } from "@/components/timesheet/TimesheetShiftForm";
import { TimesheetShiftList, type TimesheetShiftGroup } from "@/components/timesheet/TimesheetShiftList";
import {
  formatMinutes,
  getShiftDurationMinutes,
  type TimesheetShift,
} from "@/pages/timesheetHelpers";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type TimesheetTab = "POINTAGE" | "DASHBOARD";

interface AdministratifProps extends RouteComponentProps {
  initialTab?: TimesheetTab;
}

const buildTimeLabel = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "HH:mm");
};

const buildShiftDateKey = (shift: TimesheetShift) => shift.shift_date || shift.start_time.split("T")[0];

const withinRangeYMD = (value: string, from: string, to: string) => {
  const valueTime = new Date(value).getTime();
  const fromTime = new Date(from).getTime();
  const toTime = new Date(to).getTime();
  const min = Math.min(fromTime, toTime);
  const max = Math.max(fromTime, toTime);
  return valueTime >= min && valueTime <= max;
};

const resolveDefaultLocation = (items: TimesheetLocation[]) =>
  items.find((item) => item.name === "Piscine")?.name ?? items[0]?.name ?? "Piscine";

export default function Administratif({ initialTab = "POINTAGE" }: AdministratifProps) {
  const { useMemo, useState } = React;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const role = typeof window === "undefined" ? useAuth.getState().role : useAuth((state) => state.role);
  const userId = typeof window === "undefined" ? useAuth.getState().userId : useAuth((state) => state.userId);
  const isCoach = role === "coach" || role === "admin";

  const [activeTab, setActiveTab] = useState<TimesheetTab>(initialTab);
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("Piscine");
  const [isTravel, setIsTravel] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(true);
  const [editingShiftId, setEditingShiftId] = useState<number | null>(null);
  const [isLocationPanelOpen, setIsLocationPanelOpen] = useState(false);
  const [newLocationName, setNewLocationName] = useState("");

  const { data: shifts = [], error: shiftsError } = useQuery({
    queryKey: ["timesheet-shifts", userId],
    queryFn: () => api.listTimesheetShifts({ coachId: userId ?? undefined }),
    enabled: isCoach,
  });

  const {
    data: locations = [],
    error: locationsError,
  } = useQuery<TimesheetLocation[]>({
    queryKey: ["timesheet-locations"],
    queryFn: () => api.listTimesheetLocations(),
    enabled: isCoach,
  });

  const { data: capabilities, error: capabilitiesError } = useQuery({
    queryKey: ["capabilities", "timesheet"],
    queryFn: () => api.getCapabilities(),
    enabled: supabaseConfig.hasSupabase,
  });

  const defaultLocation = useMemo(() => resolveDefaultLocation(locations), [locations]);

  const resetForm = React.useCallback(() => {
    setDate(format(new Date(), "yyyy-MM-dd"));
    setStartTime("");
    setEndTime("");
    setLocation(defaultLocation);
    setIsTravel(false);
  }, [defaultLocation]);

  const createShift = useMutation({
    mutationFn: (payload: Omit<TimesheetShift, "id" | "coach_name">) => api.createTimesheetShift(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheet-shifts"] });
      resetForm();
      toast({ title: "Shift enregistré" });
    },
    onError: (error: unknown) => {
      const summary = summarizeApiError(error, "Impossible d'enregistrer le shift.");
      toast({ title: "Erreur", description: summary.message });
    },
  });

  const updateShift = useMutation({
    mutationFn: (payload: Partial<TimesheetShift> & { id: number }) => api.updateTimesheetShift(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheet-shifts"] });
      setIsSheetOpen(false);
      setEditingShiftId(null);
      resetForm();
      toast({ title: "Shift mis à jour" });
    },
    onError: (error: unknown) => {
      const summary = summarizeApiError(error, "Impossible de modifier le shift.");
      toast({ title: "Erreur", description: summary.message });
    },
  });

  const deleteShift = useMutation({
    mutationFn: (payload: { id: number }) => api.deleteTimesheetShift(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheet-shifts"] });
    },
    onError: (error: unknown) => {
      const summary = summarizeApiError(error, "Impossible de supprimer le shift.");
      toast({ title: "Erreur", description: summary.message });
    },
  });

  const createLocation = useMutation({
    mutationFn: (payload: { name: string }) => api.createTimesheetLocation(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheet-locations"] });
    },
    onError: (error: unknown) => {
      const summary = summarizeApiError(error, "Impossible d'ajouter le lieu.");
      toast({ title: "Erreur", description: summary.message });
    },
  });

  const deleteLocation = useMutation({
    mutationFn: (payload: { id: number }) => api.deleteTimesheetLocation(payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["timesheet-locations"] });
      const remaining = locations.filter((item) => item.id !== variables.id);
      if (location && remaining.every((item) => item.name !== location)) {
        setLocation(resolveDefaultLocation(remaining));
      }
    },
    onError: (error: unknown) => {
      const summary = summarizeApiError(error, "Impossible de supprimer le lieu.");
      toast({ title: "Erreur", description: summary.message });
    },
  });

  const todayKey = format(new Date(), "yyyy-MM-dd");
  const todayMinutes = useMemo(
    () =>
      shifts.reduce((acc, shift) => {
        const dateKey = buildShiftDateKey(shift);
        if (dateKey !== todayKey) return acc;
        const duration = getShiftDurationMinutes(shift);
        return duration ? acc + duration : acc;
      }, 0),
    [shifts, todayKey],
  );

  const grouped = useMemo<TimesheetShiftGroup[]>(() => {
    const sorted = [...shifts].sort((a, b) => (a.start_time < b.start_time ? 1 : -1));
    const map = new Map<string, TimesheetShift[]>();
    sorted.forEach((shift) => {
      const key = buildShiftDateKey(shift);
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(shift);
    });
    return Array.from(map.entries())
      .map(([groupDate, items]) => {
        const totalMinutes = items.reduce((acc, shift) => {
          const duration = getShiftDurationMinutes(shift);
          return duration ? acc + duration : acc;
        }, 0);
        return { date: groupDate, shifts: items, totalMinutes };
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [shifts]);

  const now = useMemo(() => new Date(), []);
  const [dashboardFrom, setDashboardFrom] = useState(() =>
    format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd"),
  );
  const [dashboardTo, setDashboardTo] = useState(() => format(now, "yyyy-MM-dd"));
  const dashboardTotals = useMemo(() => {
    const inRange = shifts.filter((shift) => withinRangeYMD(buildShiftDateKey(shift), dashboardFrom, dashboardTo));
    return inRange.reduce(
      (acc, shift) => {
        const duration = getShiftDurationMinutes(shift);
        const minutes = duration ?? 0;
        if (shift.is_travel) {
          acc.travel += minutes;
        } else {
          acc.work += minutes;
        }
        acc.total += minutes;
        return acc;
      },
      { count: inRange.length, work: 0, travel: 0, total: 0 },
    );
  }, [dashboardFrom, dashboardTo, shifts]);
  const dashboardHistogram = useMemo(() => {
    const inRange = shifts.filter((shift) => withinRangeYMD(buildShiftDateKey(shift), dashboardFrom, dashboardTo));
    const buckets = new Map<string, number>();
    inRange.forEach((shift) => {
      const dateKey = buildShiftDateKey(shift);
      const minutes = getShiftDurationMinutes(shift) ?? 0;
      buckets.set(dateKey, (buckets.get(dateKey) ?? 0) + minutes);
    });
    return Array.from(buckets.entries())
      .map(([dateKey, minutes]) => ({
        date: dateKey,
        label: format(new Date(dateKey), "dd/MM"),
        hours: Number((minutes / 60).toFixed(2)),
      }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [dashboardFrom, dashboardTo, shifts]);
  const formatLongDate = useMemo(
    () => new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    [],
  );

  if (!isCoach) {
    if (typeof window === "undefined") {
      return null;
    }
    return <Redirect to="/" />;
  }

  const capabilityMessage = capabilitiesError
    ? summarizeApiError(capabilitiesError, "Impossible de vérifier le module de pointage.").message
    : capabilities?.mode === "supabase" && !capabilities.timesheet.available
      ? "Pointage heures indisponible (tables manquantes côté D1)."
      : null;
  const shiftsErrorMessage = shiftsError
    ? summarizeApiError(shiftsError, "Impossible de charger les shifts.").message
    : null;
  const locationsErrorMessage = locationsError
    ? summarizeApiError(locationsError, "Impossible de charger les lieux.").message
    : null;

  const isSaving = createShift.isPending || updateShift.isPending;
  const isManagingLocations = createLocation.isPending || deleteLocation.isPending;

  const durationLabel = useMemo(() => {
    if (!startTime || !endTime) return null;
    const startIso = new Date(`${date}T${startTime}`);
    const endIso = new Date(`${date}T${endTime}`);
    if (Number.isNaN(startIso.getTime()) || Number.isNaN(endIso.getTime())) return null;
    const diffMinutes = (endIso.getTime() - startIso.getTime()) / 60000;
    if (diffMinutes <= 0) return null;
    return formatMinutes(diffMinutes);
  }, [date, startTime, endTime]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!date || !startTime) {
      toast({ title: "Champs requis", description: "Date et heure de début obligatoires." });
      return;
    }
    const startIso = `${date}T${startTime}`;
    const endIso = endTime ? `${date}T${endTime}` : null;
    if (endIso && new Date(endIso) < new Date(startIso)) {
      toast({ title: "Heures invalides", description: "La fin doit être après le début." });
      return;
    }
    if (!userId) {
      toast({ title: "Utilisateur manquant" });
      return;
    }

    if (editingShiftId) {
      updateShift.mutate({
        id: editingShiftId,
        coach_id: userId,
        shift_date: date,
        start_time: startIso,
        end_time: endIso,
        location: location.trim() || null,
        is_travel: isTravel,
      });
      return;
    }

    createShift.mutate({
      coach_id: userId,
      shift_date: date,
      start_time: startIso,
      end_time: endIso,
      location: location.trim() || null,
      is_travel: isTravel,
    });
  };

  const openNewShift = () => {
    resetForm();
    setEditingShiftId(null);
    setIsSheetOpen(true);
  };

  const openEditShift = (shift: TimesheetShift) => {
    setEditingShiftId(shift.id);
    setDate(buildShiftDateKey(shift));
    setStartTime(buildTimeLabel(shift.start_time));
    setEndTime(shift.end_time ? buildTimeLabel(shift.end_time) : "");
    setLocation(shift.location ?? "");
    setIsTravel(shift.is_travel);
    setIsSheetOpen(true);
  };

  const closeSheet = () => {
    setIsSheetOpen(false);
    setEditingShiftId(null);
  };

  React.useEffect(() => {
    if (activeTab === "DASHBOARD") {
      setIsSheetOpen(false);
      setEditingShiftId(null);
    }
  }, [activeTab]);

  React.useEffect(() => {
    if (!isSheetOpen || editingShiftId) return;
    if (!location || locations.every((item) => item.name !== location)) {
      setLocation(defaultLocation);
    }
  }, [defaultLocation, editingShiftId, isSheetOpen, location, locations]);

  const handleAddLocation = () => {
    const trimmed = newLocationName.trim();
    if (!trimmed) return;
    createLocation.mutate({ name: trimmed });
    setNewLocationName("");
  };

  return (
    <SafeArea top bottom className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pb-24 pt-4 text-foreground">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-black tracking-[0.2px]">ADMINISTRATIF</div>
          <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1 text-xs font-extrabold">
            <button
              type="button"
              className={`rounded-full px-3 py-2 ${activeTab === "POINTAGE" ? "bg-primary text-primary-foreground" : "text-foreground"}`}
              aria-current={activeTab === "POINTAGE" ? "page" : undefined}
              onClick={() => setActiveTab("POINTAGE")}
            >
              Pointage
            </button>
            <button
              type="button"
              className={`rounded-full px-3 py-2 ${activeTab === "DASHBOARD" ? "bg-primary text-primary-foreground" : "text-foreground"}`}
              aria-current={activeTab === "DASHBOARD" ? "page" : undefined}
              onClick={() => setActiveTab("DASHBOARD")}
            >
              Dashboard
            </button>
          </div>
        </div>

        {capabilityMessage ? (
          <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            {capabilityMessage}
          </div>
        ) : null}
        {shiftsErrorMessage ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {shiftsErrorMessage}
          </div>
        ) : null}
        {locationsErrorMessage ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {locationsErrorMessage}
          </div>
        ) : null}

        {activeTab === "POINTAGE" ? (
          <React.Fragment>
            <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-[0_1px_6px_rgba(0,0,0,0.04)]">
              <div className="text-xs text-muted-foreground">Heures aujourd'hui</div>
              <div className="mt-1 text-2xl font-black text-foreground">{formatMinutes(todayMinutes)}</div>
            </div>

            <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-[0_1px_6px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-black text-foreground">Lieux</div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsLocationPanelOpen((value) => !value)}
                >
                  Gérer les lieux
                </Button>
              </div>
              {isLocationPanelOpen ? (
                <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                  <div className="flex flex-wrap gap-2">
                    {locations.length ? (
                      locations.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground"
                        >
                          <span>{item.name}</span>
                          <button
                            type="button"
                            className="text-muted-foreground transition hover:text-foreground"
                            onClick={() => deleteLocation.mutate({ id: item.id })}
                            aria-label={`Supprimer ${item.name}`}
                            disabled={isManagingLocations}
                          >
                            ✕
                          </button>
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">Aucun lieu enregistré.</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      value={newLocationName}
                      onChange={(event) => setNewLocationName(event.target.value)}
                      placeholder="Nouveau lieu"
                      className="min-w-[160px] flex-1"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddLocation}
                      disabled={!newLocationName.trim() || isManagingLocations}
                    >
                      Ajouter
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>

            <TimesheetShiftList
              groups={grouped}
              onEdit={openEditShift}
              onDelete={(id) => deleteShift.mutate({ id })}
            />

            <button
              type="button"
              className="fixed bottom-4 right-4 z-fab flex h-14 w-14 items-center justify-center rounded-full bg-destructive text-2xl font-black text-white shadow-[0_8px_20px_rgba(220,38,38,0.25)]"
              onClick={openNewShift}
              aria-label="Ajouter un shift"
            >
              +
            </button>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-4 shadow-[0_1px_6px_rgba(0,0,0,0.04)]">
              <div className="text-base font-black text-foreground">Dashboard KPI</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <div className="min-w-[180px] flex-1 space-y-2">
                  <Label htmlFor="dashboard-from">Du</Label>
                  <Input
                    id="dashboard-from"
                    type="date"
                    value={dashboardFrom}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => setDashboardFrom(event.target.value)}
                  />
                </div>
                <div className="min-w-[180px] flex-1 space-y-2">
                  <Label htmlFor="dashboard-to">Au</Label>
                  <Input
                    id="dashboard-to"
                    type="date"
                    value={dashboardTo}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => setDashboardTo(event.target.value)}
                  />
                </div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                Période sélectionnée : {formatLongDate.format(new Date(dashboardFrom))} →{" "}
                {formatLongDate.format(new Date(dashboardTo))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card px-4 py-4 shadow-[0_1px_6px_rgba(0,0,0,0.04)]">
              <div className="mb-3 text-sm font-black text-foreground">Heures par jour</div>
              {dashboardHistogram.length ? (
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboardHistogram} margin={{ top: 8, right: 12, left: -10, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${value}h`} />
                      <Tooltip formatter={(value: number) => `${value} h`} labelFormatter={(label) => `Jour ${label}`} />
                      <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Aucune donnée sur la période.</div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card px-4 py-4 shadow-[0_1px_6px_rgba(0,0,0,0.04)]">
              <div className="mb-3 text-sm font-black text-foreground">Résumé période</div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: "Total", value: formatMinutes(dashboardTotals.total), hint: "Travail + trajet" },
                  { label: "Shifts", value: dashboardTotals.count.toString(), hint: "Nombre sur la période" },
                  { label: "Travail", value: formatMinutes(dashboardTotals.work), hint: "Heures de travail" },
                  { label: "Trajet", value: formatMinutes(dashboardTotals.travel), hint: "Heures de trajet" },
                ].map((card) => (
                  <div
                    key={card.label}
                    className="rounded-2xl border border-dashed border-border bg-card p-3 shadow-[0_1px_6px_rgba(0,0,0,0.04)]"
                  >
                    <div className="text-xs text-muted-foreground">{card.label}</div>
                    <div className="text-lg font-black text-foreground">{card.value}</div>
                    <div className="text-xs text-muted-foreground">{card.hint}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card px-4 py-4 shadow-[0_1px_6px_rgba(0,0,0,0.04)]">
              <div className="mb-2 text-sm font-black text-foreground">Graphiques (à venir)</div>
              <div className="text-sm text-muted-foreground">
                • Bar chart : heures par jour (période)
                <br />• Donut : % trajet vs travail
                <br />• Top lieux : heures cumulées
                <br />• Variations : période vs période-1
              </div>
            </div>
          </React.Fragment>
        )}
      </div>

      {activeTab === "POINTAGE" ? (
        <TimesheetShiftForm
          isOpen={isSheetOpen}
          isEditing={Boolean(editingShiftId)}
          isSaving={isSaving}
          date={date}
          startTime={startTime}
          endTime={endTime}
          location={location}
          isTravel={isTravel}
          durationLabel={durationLabel}
          locations={locations}
          onClose={closeSheet}
          onSubmit={handleSubmit}
          onDateChange={setDate}
          onStartTimeChange={setStartTime}
          onEndTimeChange={setEndTime}
          onLocationChange={setLocation}
          onTravelChange={setIsTravel}
          onCreateLocation={(name) => createLocation.mutate({ name })}
          onDeleteLocation={(id) => deleteLocation.mutate({ id })}
        />
      ) : null}
    </SafeArea>
  );
}
