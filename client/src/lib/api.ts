
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { syncConfig } from "./config";
import { getStoredAccessToken, refreshStoredAccessToken } from "./auth";

// --- Types ---

const isNetworkAvailable = () => {
  if (typeof navigator === "undefined") {
    return true;
  }
  return navigator.onLine;
};

const canUseRemoteSync = () => syncConfig.hasCloudflareSync && isNetworkAvailable();

export interface Session {
  id: number;
  athlete_id?: number;
  athlete_name: string;
  date: string;
  slot: string;
  effort: number;
  feeling: number;
  rpe?: number | null;
  performance?: number | null;
  engagement?: number | null;
  fatigue?: number | null;
  distance: number;
  duration: number;
  comments: string;
  created_at: string;
}

export interface Exercise {
  id: number;
  name?: string;
  numero_exercice?: number | null;
  nom_exercice: string;
  description?: string | null;
  illustration_gif?: string | null;
  exercise_type: "strength" | "warmup";
  warmup_reps?: number | null;
  warmup_duration?: number | null;
  Nb_series_endurance?: number | null;
  Nb_reps_endurance?: number | null;
  pct_1rm_endurance?: number | null;
  recup_endurance?: number | null;
  recup_exercices_endurance?: number | null;
  Nb_series_hypertrophie?: number | null;
  Nb_reps_hypertrophie?: number | null;
  pct_1rm_hypertrophie?: number | null;
  recup_hypertrophie?: number | null;
  recup_exercices_hypertrophie?: number | null;
  Nb_series_force?: number | null;
  Nb_reps_force?: number | null;
  pct_1rm_force?: number | null;
  recup_force?: number | null;
  recup_exercices_force?: number | null;
}

export type StrengthCycleType = "endurance" | "hypertrophie" | "force";

export interface StrengthSessionTemplate {
  id: number;
  title: string;
  name?: string;
  description: string;
  cycle: StrengthCycleType;
  cycle_type?: StrengthCycleType | null;
  items?: StrengthSessionItem[];
}

export interface StrengthSessionItem {
  exercise_id: number;
  order_index: number;
  sets: number;
  reps: number;
  rest_seconds: number;
  percent_1rm: number;
  cycle_type?: StrengthCycleType | null;
  notes?: string;
  // Join fields
  exercise_name?: string;
  category?: string;
}

export interface SwimSessionTemplate {
    id: number;
    name: string;
    description?: string | null;
    created_by?: number | null;
    created_at?: string | null;
    updated_at?: string | null;
    items?: SwimSessionItem[];
}

export interface SwimSessionItem {
    id?: number;
    catalog_id?: number;
    ordre?: number;
    label?: string | null;
    distance?: number | null;
    duration?: number | null;
    intensity?: string | null;
    notes?: string | null;
    raw_payload?: Record<string, any> | null;
}

export interface Assignment {
    id: number;
    session_id: number;
    session_type: "swim" | "strength";
    title: string;
    description: string;
    assigned_date: string;
    status: string;
    // Strength fields
    items?: StrengthSessionItem[] | SwimSessionItem[];
    cycle?: string;
}

export interface Notification {
  id: number;
  target_id?: number;
  target_user_id?: number | null;
  target_group_id?: number | null;
  target_group_name?: string | null;
  sender_id?: number | null;
  sender_email?: string | null;
  sender_name?: string | null;
  sender_role?: string | null;
  counterparty_id?: number | null;
  counterparty_name?: string | null;
  counterparty_role?: string | null;
  sender: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  date: string;
  related_id?: number;
}

export interface UserProfile {
  id?: number | null;
  display_name?: string;
  email?: string | null;
  birthdate?: string | null;
  group_id?: number | null;
  group_label?: string | null;
  objectives?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  ffn_iuf?: string | null;
}

export interface AthleteSummary {
  id: number | null;
  display_name: string;
  group_label?: string | null;
}

export interface GroupSummary {
  id: number;
  name: string;
  member_count?: number | null;
}

export interface UpcomingBirthday {
  id: number;
  display_name: string;
  birthdate: string;
  next_birthday: string;
  days_until: number;
}

export interface UserSummary {
  id: number;
  display_name: string;
  role: string;
  email?: string | null;
  is_active?: number | boolean;
  group_label?: string | null;
}

export interface SwimRecord {
  id: number;
  athlete_id: number;
  athlete_name?: string | null;
  event_name: string;
  pool_length?: number | null;
  time_seconds?: number | null;
  record_date?: string | null;
  notes?: string | null;
  record_type?: string | null;
  /** Points FFN (normalisés en base dans swim_records.ffn_points) */
  ffn_points?: number | null;
  /** Compat legacy: certains payloads peuvent encore exposer "points" */
  points?: number | null;
}

export interface ClubRecord {
  id: number;
  performance_id: number;
  athlete_name: string;
  sex: string;
  pool_m: number;
  event_code: string;
  event_label?: string | null;
  age: number;
  time_ms: number;
  record_date?: string | null;
}

export interface ClubRecordSwimmer {
  id: number | null;
  source_type: "user" | "manual";
  user_id?: number | null;
  display_name: string;
  iuf?: string | null;
  sex?: "M" | "F" | null;
  birthdate?: string | null;
  is_active: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface TimesheetShift {
  id: number;
  coach_id: number;
  coach_name?: string | null;
  shift_date: string;
  start_time: string;
  end_time?: string | null;
  location?: string | null;
  is_travel: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface TimesheetLocation {
  id: number;
  name: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export type FeatureCapability = {
  available: boolean;
  missingTables?: string[];
};

export type ApiCapabilities = {
  version?: string | null;
  timesheet: FeatureCapability;
  messaging: FeatureCapability;
  mode: "cloudflare" | "local";
};

export type ApiErrorInfo = {
  message: string;
  code?: string;
  status?: number;
};

// client/src/lib/api.ts



// STORAGE MOCK (Since we don't have a real DB in this mode, we use local storage to simulate backend persistence for development)
// In a real app, this would be replacing fetch calls to the worker.
const STORAGE_KEYS = {
  SESSIONS: "suivi_natation_sessions",
  EXERCISES: "suivi_natation_exercises",
  STRENGTH_SESSIONS: "suivi_natation_strength_sessions",
  SWIM_SESSIONS: "suivi_natation_swim_sessions",
  ASSIGNMENTS: "suivi_natation_assignments",
  STRENGTH_RUNS: "suivi_natation_strength_runs",
  NOTIFICATIONS: "suivi_natation_notifications",
  ONE_RM: "suivi_natation_1rm",
  SWIM_RECORDS: "suivi_natation_swim_records",
  TIMESHEET_SHIFTS: "suivi_natation_timesheet_shifts",
  TIMESHEET_LOCATIONS: "suivi_natation_timesheet_locations",
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const defaultTimesheetLocations = ["Piscine", "Compétition"];

// --- API Service ---

const withSharedToken = (payload: Record<string, unknown>) => {
  if (!syncConfig.token) return payload;
  return { ...payload, token: syncConfig.token };
};

const appendSharedToken = (url: URL) => {
  if (syncConfig.token) {
    url.searchParams.set("token", syncConfig.token);
  }
};

const parseRawPayload = (raw: unknown) => {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }
  if (typeof raw === "object") return raw as Record<string, unknown>;
  return null;
};

const fetchUserGroupIds = async (userId?: number | null): Promise<number[]> => {
  if (!syncConfig.endpoint || !userId || !canUseRemoteSync()) return [];
  const url = new URL(syncConfig.endpoint);
  url.searchParams.set("action", "groups_get");
  appendSharedToken(url);
  const payload = await fetchJson(url.toString(), {
    method: "GET",
    redirect: "follow",
    headers: {},
  }).then(unwrapOk);
  const groups = Array.isArray(payload?.groups) ? payload.groups : [];
  if (!groups.length) return [];
  const memberships = await Promise.all(
    groups.map(async (group: any) => {
      const groupUrl = new URL(syncConfig.endpoint as string);
      groupUrl.searchParams.set("action", "groups_get");
      groupUrl.searchParams.set("group_id", String(group.id));
      appendSharedToken(groupUrl);
      const groupPayload = await fetchJson(groupUrl.toString(), {
        method: "GET",
        redirect: "follow",
        headers: {},
      }).then(unwrapOk);
      const members = Array.isArray(groupPayload?.members) ? groupPayload.members : [];
      const isMember = members.some(
        (member: any) => safeOptionalInt(member.user_id ?? member.userId ?? member.id) === userId,
      );
      return isMember ? safeInt(group.id, 0) : null;
    }),
  );
  return memberships.filter((id): id is number => typeof id === "number" && id > 0);
};

const fetchJson = async (url: string, options: RequestInit) => {
  const buildHeaders = (token?: string | null) => {
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return headers;
  };

  const doFetch = (token?: string | null) =>
    fetch(url, {
      ...options,
      headers: buildHeaders(token),
    });

  let res = await doFetch(getStoredAccessToken());
  if (res.status === 401) {
    const refreshed = await refreshStoredAccessToken();
    if (refreshed) {
      res = await doFetch(refreshed);
    }
  }
  const text = await res.text();
  let payload: any = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }
  if (!res.ok) {
    const errorMessage = payload?.error ? String(payload.error) : `HTTP ${res.status}`;
    const error = new Error(errorMessage);
    (error as ApiErrorInfo).status = res.status;
    (error as ApiErrorInfo).code = payload?.code;
    throw error;
  }
  if (payload !== null) {
    return payload;
  }
  return text ? JSON.parse(text) : {};
};

const unwrapOk = (payload: any) => {
  if (!payload || payload.ok !== true) {
    throw new Error(payload?.error || "Format inattendu");
  }
  return payload.data || {};
};

const safeInt = (value: unknown, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? Math.round(num) : fallback;
};

const safeOptionalInt = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? Math.round(num) : null;
};

const loggedErrors = new Set<string>();

export const parseApiError = (error: unknown): ApiErrorInfo => {
  if (error instanceof Error) {
    const info = error as ApiErrorInfo;
    return {
      message: info.message || "Erreur inconnue",
      code: info.code,
      status: info.status,
    };
  }
  return { message: String(error || "Erreur inconnue") };
};

export const summarizeApiError = (error: unknown, fallbackMessage: string): ApiErrorInfo => {
  const info = parseApiError(error);
  const status = info.status;
  const code = info.code;
  let message = info.message || fallbackMessage;
  if (code === "unknown_action") {
    message = "Action inconnue côté Worker. Déploiement incomplet ?";
  } else if (code === "table_missing") {
    message = "Base D1 non initialisée (table manquante).";
  } else if (status === 401) {
    message = "Authentification expirée ou manquante.";
  } else if (status === 403) {
    message = "Accès refusé pour ce rôle.";
  }
  const logKey = `${code ?? "none"}:${status ?? "none"}:${message}`;
  if (!loggedErrors.has(logKey)) {
    console.error("[api] error:", info);
    loggedErrors.add(logKey);
  }
  return { ...info, message };
};

const normalizeScaleToFive = (value: number | null | undefined) => {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (num <= 5) return Math.max(1, Math.round(num));
  return Math.min(5, Math.max(1, Math.round(num / 2)));
};

const expandScaleToTen = (value: number | null | undefined) => {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (num <= 5) return Math.round(num * 2);
  return Math.round(num);
};

const safeOptionalNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const estimateOneRm = (weight?: number | null, reps?: number | null) => {
  if (!Number.isFinite(weight) || !Number.isFinite(reps)) return null;
  if ((weight ?? 0) <= 0 || (reps ?? 0) <= 0) return null;
  if (reps === 1) return Math.round(weight as number);
  return Math.round((weight as number) * (1 + (reps as number) / 30));
};

const normalizeCycleType = (value: unknown) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "hypertrophie" || normalized === "force" || normalized === "endurance") {
    return normalized;
  }
  return "endurance";
};

const normalizeStrengthItem = (
  item: any,
  index: number,
  sessionCycle: string,
): StrengthSessionItem => ({
  exercise_id: safeInt(item.exercise_id),
  order_index: safeOptionalInt(item.ordre ?? item.order_index) ?? index,
  sets: safeOptionalInt(item.sets) ?? 0,
  reps: safeOptionalInt(item.reps) ?? 0,
  rest_seconds: safeOptionalInt(item.rest_series_s ?? item.rest_seconds) ?? 0,
  percent_1rm: safeOptionalInt(item.pct_1rm ?? item.percent_1rm) ?? 0,
  cycle_type: normalizeCycleType(item.cycle_type ?? sessionCycle),
  notes: item.notes ?? "",
  exercise_name: item.exercise_name ?? item.nom_exercice ?? undefined,
  category: item.category ?? item.exercise_type ?? undefined,
});

const validateStrengthItems = (items: StrengthSessionItem[]) => {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!Number.isFinite(item.sets) || item.sets < 0) {
      throw new Error(`Séries invalides pour l'exercice #${index + 1}`);
    }
    if (!Number.isFinite(item.reps) || item.reps < 0) {
      throw new Error(`Reps invalides pour l'exercice #${index + 1}`);
    }
    if (!Number.isFinite(item.rest_seconds) || item.rest_seconds < 0) {
      throw new Error(`Repos invalide pour l'exercice #${index + 1}`);
    }
  }
};

const isExerciseType = (value: unknown): value is Exercise["exercise_type"] =>
  value === "strength" || value === "warmup";

const normalizeExerciseType = (value: unknown): Exercise["exercise_type"] =>
  isExerciseType(value) ? value : "strength";

const assertExerciseType = (value: unknown): Exercise["exercise_type"] => {
  if (isExerciseType(value)) {
    return value;
  }
  throw new Error("exercise_type must be 'strength' or 'warmup'");
};

const normalizeExercise = (exercise: any): Exercise => ({
  id: safeInt(exercise.id),
  numero_exercice: safeOptionalInt(exercise.numero_exercice ?? exercise.numero),
  nom_exercice: exercise.nom_exercice ?? exercise.name ?? "",
  description: exercise.description ?? null,
  illustration_gif: exercise.illustration_gif ?? null,
  exercise_type: normalizeExerciseType(
    exercise.exercise_type ?? exercise.type ?? (exercise.is_warmup ? "warmup" : "strength"),
  ),
  warmup_reps: safeOptionalInt(exercise.warmup_reps),
  warmup_duration: safeOptionalInt(exercise.warmup_duration),
  Nb_series_endurance: safeOptionalInt(exercise.Nb_series_endurance),
  Nb_reps_endurance: safeOptionalInt(exercise.Nb_reps_endurance),
  pct_1rm_endurance: safeOptionalNumber(exercise.pct_1rm_endurance),
  recup_endurance: safeOptionalInt(exercise.recup_endurance),
  recup_exercices_endurance: safeOptionalInt(exercise.recup_exercices_endurance),
  Nb_series_hypertrophie: safeOptionalInt(exercise.Nb_series_hypertrophie),
  Nb_reps_hypertrophie: safeOptionalInt(exercise.Nb_reps_hypertrophie),
  pct_1rm_hypertrophie: safeOptionalNumber(exercise.pct_1rm_hypertrophie),
  recup_hypertrophie: safeOptionalInt(exercise.recup_hypertrophie),
  recup_exercices_hypertrophie: safeOptionalInt(exercise.recup_exercices_hypertrophie),
  Nb_series_force: safeOptionalInt(exercise.Nb_series_force),
  Nb_reps_force: safeOptionalInt(exercise.Nb_reps_force),
  pct_1rm_force: safeOptionalNumber(exercise.pct_1rm_force),
  recup_force: safeOptionalInt(exercise.recup_force),
  recup_exercices_force: safeOptionalInt(exercise.recup_exercices_force),
});

interface Pagination {
  limit: number;
  offset: number;
  total: number;
}

interface NotificationListResult {
  notifications: Notification[];
  pagination: Pagination;
}

interface StrengthHistoryResult {
  runs: any[];
  pagination: Pagination;
  exercise_summary: StrengthExerciseSummary[];
}

interface StrengthExerciseSummary {
  exercise_id: number;
  exercise_name: string;
  total_sets: number;
  total_reps: number;
  total_volume: number;
  max_weight: number | null;
  last_performed_at: string | null;
}

interface StrengthHistoryAggregateEntry {
  period: string;
  tonnage: number;
  volume: number;
}

interface StrengthHistoryAggregateResult {
  periods: StrengthHistoryAggregateEntry[];
  pagination: Pagination;
}

type SyncSessionInput = Omit<Session, "id" | "created_at"> & { athlete_id?: number | string | null };

const mapToBackendSession = (session: SyncSessionInput) => {
  // UI is on a 1–5 scale; backend dashboards historically expect 1–10.
  const payload: Record<string, unknown> = {
    athleteName: session.athlete_name,
    sessionDate: session.date,
    timeSlot: session.slot,
    distance: session.distance,
    duration: session.duration,
    rpe: expandScaleToTen(session.effort),
    performance: expandScaleToTen(session.performance ?? session.feeling),
    engagement: expandScaleToTen(session.engagement ?? session.feeling),
    fatigue: expandScaleToTen(session.feeling),
    comments: session.comments,
  };
  if (session.athlete_id !== null && session.athlete_id !== undefined && String(session.athlete_id) !== "") {
    payload.athlete_id = session.athlete_id;
  }
  return payload;
};

const mapFromBackendSession = (raw: any): Session | null => {
  if (!raw) return null;
  const athleteName = String(raw.athleteName || raw.athlete_name || "").trim();
  const date = String(raw.sessionDate || raw.date || "").trim();
  if (!athleteName || !date) return null;
  const rpe = normalizeScaleToFive(safeOptionalInt(raw.rpe ?? raw.effort));
  const performance = normalizeScaleToFive(safeOptionalInt(raw.performance ?? raw.feeling));
  const engagement = normalizeScaleToFive(safeOptionalInt(raw.engagement ?? raw.feeling));
  const fatigue = normalizeScaleToFive(safeOptionalInt(raw.fatigue ?? raw.feeling));
  const effort = rpe ?? 3;
  const feeling = normalizeScaleToFive(
    safeOptionalInt(raw.performance ?? raw.engagement ?? raw.fatigue ?? raw.feeling),
  ) ?? 3;
    return {
      id: safeInt(raw.id, Date.now()),
      athlete_id: raw.athlete_id ? safeInt(raw.athlete_id) : undefined,
      athlete_name: athleteName,
      date,
      slot: String(raw.timeSlot || raw.slot || ""),
    effort,
    feeling,
    rpe,
    performance,
    engagement,
    fatigue,
    distance: safeInt(raw.distance, 0),
    duration: safeInt(raw.duration, 0),
    comments: raw.comments || "",
    created_at: raw.created_at || raw.updated_at || new Date().toISOString(),
  };
};

export const api = {
  async getCapabilities(): Promise<ApiCapabilities> {
    if (!syncConfig.endpoint) {
      return {
        mode: "local",
        version: null,
        timesheet: { available: true },
        messaging: { available: true },
      };
    }
    const url = new URL(syncConfig.endpoint);
    url.searchParams.set("action", "capabilities");
    appendSharedToken(url);
    const payload = await fetchJson(url.toString(), {
      method: "GET",
      redirect: "follow",
      headers: {},
    }).then(unwrapOk);
    return {
      mode: "cloudflare",
      version: payload?.version ?? null,
      timesheet: payload?.capabilities?.timesheet ?? { available: false },
      messaging: payload?.capabilities?.messaging ?? { available: false },
    };
  },

  // ✅ AJOUTE ÇA ICI (dans le même objet)
  async syncFfnSwimRecords(params: { athleteId?: number; athleteName?: string; iuf: string }) {
    if (!syncConfig.endpoint) {
      throw new Error("Sync endpoint not configured");
    }

    const url = new URL(syncConfig.endpoint);
    url.pathname = "/api/swim/ffn/sync";
    url.search = "";
    appendSharedToken(url);

    const payload = await fetchJson(url.toString(), {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        athlete_id: params.athleteId ?? null,
        athlete_name: params.athleteName ?? null,
        iuf: params.iuf,
      }),
    }).then(unwrapOk);

    return payload as { inserted: number; updated: number; skipped: number };
  },
  

  // --- SWIM SESSIONS ---
  async syncSession(session: SyncSessionInput): Promise<{ status: string }> {
    await delay(300);
    const sessions = this._get(STORAGE_KEYS.SESSIONS) || [];
    const newSession = { ...session, id: Date.now(), created_at: new Date().toISOString() };
    this._save(STORAGE_KEYS.SESSIONS, [...sessions, newSession]);

    if (syncConfig.hasCloudflareSync) {
      const payload = withSharedToken(mapToBackendSession(session));
      await fetchJson(syncConfig.endpoint, {
        method: "POST",
        redirect: "follow",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      }).then(unwrapOk);
    }

    return { status: "ok" };
  },

  async getSessions(athleteName: string, athleteId?: number | string | null): Promise<Session[]> {
    await delay(200);
    const hasAthleteId = athleteId !== null && athleteId !== undefined && String(athleteId) !== "";
    if (syncConfig.hasCloudflareSync) {
      const url = new URL(syncConfig.endpoint);
      url.searchParams.set("action", "get");
      if (hasAthleteId) {
        url.searchParams.set("athlete_id", String(athleteId));
      } else {
        url.searchParams.set("athleteName", athleteName);
      }
      appendSharedToken(url);
      const payload = await fetchJson(url.toString(), {
        method: "GET",
        redirect: "follow",
        headers: {},
      }).then(unwrapOk);
      const mapped: Session[] = Array.isArray(payload.sessions)
        ? (payload.sessions as unknown[])
            .map(mapFromBackendSession)
            .filter((session): session is Session => Boolean(session))
        : [];
      return mapped.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    const sessions = this._get(STORAGE_KEYS.SESSIONS) || [];
    return sessions
      .filter((s: Session) => {
        if (hasAthleteId) {
          return s.athlete_id ? String(s.athlete_id) === String(athleteId) : s.athlete_name.toLowerCase() === athleteName.toLowerCase();
        }
        return s.athlete_name.toLowerCase() === athleteName.toLowerCase();
      })
      .map((session: Session) => ({
        ...session,
        effort: normalizeScaleToFive(session.effort) ?? session.effort,
        feeling: normalizeScaleToFive(session.feeling) ?? session.feeling,
        rpe: normalizeScaleToFive(session.rpe ?? null),
        performance: normalizeScaleToFive(session.performance ?? null),
        engagement: normalizeScaleToFive(session.engagement ?? null),
        fatigue: normalizeScaleToFive(session.fatigue ?? null),
      }))
      .sort((a: Session, b: Session) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  async updateSession(session: Session): Promise<{ status: string }> {
    await delay(200);
    const sessions = this._get(STORAGE_KEYS.SESSIONS) || [];
    const index = sessions.findIndex((entry: Session) => entry.id === session.id);
    if (index === -1) {
      return { status: "missing" };
    }
    const updatedSessions = [...sessions];
    updatedSessions[index] = { ...updatedSessions[index], ...session };
    this._save(STORAGE_KEYS.SESSIONS, updatedSessions);
    return { status: "updated" };
  },

  async deleteSession(sessionId: number): Promise<{ status: string }> {
    await delay(200);
    const sessions = this._get(STORAGE_KEYS.SESSIONS) || [];
    const updatedSessions = sessions.filter((session: Session) => session.id !== sessionId);
    this._save(STORAGE_KEYS.SESSIONS, updatedSessions);
    return { status: "deleted" };
  },

  async getHallOfFame() {
    if (syncConfig.hasCloudflareSync) {
      const url = new URL(syncConfig.endpoint);
      url.searchParams.set("action", "hall");
      appendSharedToken(url);
      const strengthUrl = new URL(syncConfig.endpoint);
      strengthUrl.searchParams.set("action", "strength_hall");
      appendSharedToken(strengthUrl);
      const [swimPayload, strengthPayload] = await Promise.all([
        fetchJson(url.toString(), {
          method: "GET",
          redirect: "follow",
          headers: {},
        }).then(unwrapOk),
        fetchJson(strengthUrl.toString(), {
          method: "GET",
          redirect: "follow",
          headers: {},
        }).then(unwrapOk),
      ]);
      const hallOfFame = Array.isArray(swimPayload?.hall_of_fame) ? swimPayload.hall_of_fame : [];
      const swimDistance = [...hallOfFame]
        .map((item: any) => ({
          athlete_name: item.athlete_name,
          total_distance: Number(item.total_distance ?? 0),
        }))
        .sort((a, b) => b.total_distance - a.total_distance)
        .slice(0, 5);
      const swimPerformance = [...hallOfFame]
        .map((item: any) => ({
          athlete_name: item.athlete_name,
          avg_effort: Number(item.avg_performance ?? item.avg_engagement ?? 0),
        }))
        .sort((a, b) => b.avg_effort - a.avg_effort)
        .slice(0, 5);
      const swimEngagement = [...hallOfFame]
        .map((item: any) => ({
          athlete_name: item.athlete_name,
          avg_engagement: Number(item.avg_engagement ?? 0),
        }))
        .sort((a, b) => b.avg_engagement - a.avg_engagement)
        .slice(0, 5);
      const strength = Array.isArray(strengthPayload?.strength) ? strengthPayload.strength : [];
      return {
        distance: swimDistance,
        performance: swimPerformance,
        engagement: swimEngagement,
        strength,
      };
    }

    await delay(300);
    const sessions = this._get(STORAGE_KEYS.SESSIONS) || [];
    const runs = this._get(STORAGE_KEYS.STRENGTH_RUNS) || [];

    // Swim Stats
    const map = new Map();
    sessions.forEach((s: Session) => {
      if (!map.has(s.athlete_name)) {
        map.set(s.athlete_name, { distance: 0, effortSum: 0, count: 0, engagementSum: 0, engagementCount: 0 });
      }
      const entry = map.get(s.athlete_name);
      entry.distance += s.distance;
      entry.effortSum += s.effort;
      entry.count += 1;
      if (s.engagement !== null && s.engagement !== undefined && Number.isFinite(s.engagement)) {
        entry.engagementSum += s.engagement;
        entry.engagementCount += 1;
      }
    });

    const swimRes = Array.from(map.entries()).map(([name, stats]) => ({
      athlete_name: name,
      total_distance: stats.distance,
      avg_effort: stats.effortSum / stats.count,
      avg_engagement: stats.engagementCount ? stats.engagementSum / stats.engagementCount : 0,
    }));

    // Strength Stats
    const sMap = new Map();
    runs.forEach((r: any) => {
      if (!sMap.has(r.athlete_name)) {
        sMap.set(r.athlete_name, { volume: 0, reps: 0, sets: 0, maxWeight: 0 });
      }
      const entry = sMap.get(r.athlete_name);
      // Calculate rough volume if logs present, else just count
      if (r.logs) {
        r.logs.forEach((l: any) => {
          const reps = Number(l.reps ?? 0);
          const weight = Number(l.weight ?? 0);
          entry.volume += reps * weight;
          entry.reps += reps;
          entry.sets += 1;
          if (weight > entry.maxWeight) {
            entry.maxWeight = weight;
          }
        });
      }
    });

    const strengthRes = Array.from(sMap.entries()).map(([name, stats]) => ({
      athlete_name: name,
      total_volume: stats.volume,
      total_reps: stats.reps,
      total_sets: stats.sets,
      max_weight: stats.maxWeight,
    }));

    return {
      distance: [...swimRes].sort((a, b) => b.total_distance - a.total_distance).slice(0, 5),
      performance: [...swimRes].sort((a, b) => b.avg_effort - a.avg_effort).slice(0, 5),
      engagement: [...swimRes].sort((a, b) => b.avg_engagement - a.avg_engagement).slice(0, 5),
      strength: [...strengthRes].sort((a, b) => b.total_volume - a.total_volume).slice(0, 5),
    };
  },

  async getClubRecords(filters: {
    pool_m?: number | null;
    sex?: string | null;
    age?: number | null;
    event_code?: string | null;
  }): Promise<ClubRecord[]> {
    if (!syncConfig.hasCloudflareSync) {
      return [];
    }
    const url = new URL(syncConfig.endpoint);
    url.pathname = "/api/records/club";
    url.search = "";
    if (filters.pool_m) {
      url.searchParams.set("bassin", String(filters.pool_m));
    }
    if (filters.sex) {
      url.searchParams.set("sexe", String(filters.sex));
    }
    if (filters.age) {
      url.searchParams.set("age", String(filters.age));
    }
    if (filters.event_code) {
      url.searchParams.set("event_code", filters.event_code);
    }
    appendSharedToken(url);
    const payload = await fetchJson(url.toString(), {
      method: "GET",
      redirect: "follow",
      headers: {},
    }).then(unwrapOk);
    return Array.isArray(payload?.records) ? payload.records : [];
  },

  async getClubRecordSwimmers(): Promise<ClubRecordSwimmer[]> {
    if (!syncConfig.hasCloudflareSync) {
      return [];
    }
    const url = new URL(syncConfig.endpoint);
    url.pathname = "/api/records/swimmers";
    appendSharedToken(url);
    const payload = await fetchJson(url.toString(), {
      method: "GET",
      redirect: "follow",
      headers: {},
    });
    const data = payload?.ok === true ? payload.data : payload;
    const swimmers = Array.isArray(data?.swimmers)
      ? data.swimmers
      : Array.isArray(data?.items)
        ? data.items
        : data;
    return Array.isArray(swimmers) ? swimmers : [];
  },

  async createClubRecordSwimmer(payload: {
    display_name: string;
    iuf?: string | null;
    sex?: "M" | "F" | null;
    birthdate?: string | null;
    is_active?: boolean;
  }): Promise<ClubRecordSwimmer | null> {
    if (!syncConfig.hasCloudflareSync) {
      return null;
    }
    const url = new URL(syncConfig.endpoint);
    url.pathname = "/api/records/swimmers";
    appendSharedToken(url);
    const response = await fetchJson(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(unwrapOk);
    return response?.swimmer ?? null;
  },

  async updateClubRecordSwimmer(
    id: number,
    payload: { iuf?: string | null; is_active?: boolean; sex?: "M" | "F" | null; birthdate?: string | null },
  ): Promise<ClubRecordSwimmer | null> {
    if (!syncConfig.hasCloudflareSync) {
      return null;
    }
    const url = new URL(syncConfig.endpoint);
    url.pathname = `/api/records/swimmers/${id}`;
    appendSharedToken(url);
    const response = await fetchJson(url.toString(), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(unwrapOk);
    return response?.swimmer ?? null;
  },

  async updateClubRecordSwimmerForUser(
    userId: number,
    payload: { iuf?: string | null; is_active?: boolean; sex?: "M" | "F" | null; birthdate?: string | null },
  ): Promise<ClubRecordSwimmer | null> {
    if (!syncConfig.hasCloudflareSync) {
      return null;
    }
    const url = new URL(syncConfig.endpoint);
    url.pathname = `/api/records/swimmers/user/${userId}`;
    appendSharedToken(url);
    const response = await fetchJson(url.toString(), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(unwrapOk);
    return response?.swimmer ?? null;
  },

  async importClubRecords(): Promise<any> {
    if (!canUseRemoteSync()) {
      return null;
    }
    const url = new URL(syncConfig.endpoint);
    url.pathname = "/api/records/import";
    appendSharedToken(url);
    const response = await fetchJson(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }).then(unwrapOk);
    return response?.summary ?? response;
  },

  // --- STRENGTH ---
  async getExercises(): Promise<Exercise[]> {
      if (canUseRemoteSync()) {
        const url = new URL(syncConfig.endpoint);
        url.searchParams.set("action", "exercises");
        appendSharedToken(url);
        const payload = await fetchJson(url.toString(), {
          method: "GET",
          redirect: "follow",
          headers: {},
        }).then(unwrapOk);
        const rawExercises = payload.exercises ?? payload;
        const list = Array.isArray(rawExercises) ? rawExercises : [];
        return list.map((exercise: any) => normalizeExercise(exercise));
      }
      const exercises = this._get(STORAGE_KEYS.EXERCISES) || [];
      const list = Array.isArray(exercises) ? exercises : [];
      return list.map((exercise: any) => normalizeExercise(exercise));
  },
  
  async createExercise(exercise: Omit<Exercise, "id">) {
      const exercise_type = assertExerciseType(exercise.exercise_type);

      if (canUseRemoteSync()) {
        const url = new URL(syncConfig.endpoint);
        url.searchParams.set("action", "exercises_add");
        appendSharedToken(url);
        await fetchJson(url.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...exercise,
            exercise_type,
          }),
        }).then(unwrapOk);
        return { status: "created" };
      }

      const ex = this._get(STORAGE_KEYS.EXERCISES) || [];
      const nextExercise = normalizeExercise({
        ...exercise,
        exercise_type,
        id: Date.now(),
      });
      this._save(STORAGE_KEYS.EXERCISES, [...ex, nextExercise]);
      return { status: "created" };
  },

  async updateExercise(exercise: Exercise) {
      const exercise_type = assertExerciseType(exercise.exercise_type);

      if (canUseRemoteSync()) {
        const url = new URL(syncConfig.endpoint);
        url.searchParams.set("action", "exercises_update");
        appendSharedToken(url);
        await fetchJson(url.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...exercise,
            exercise_type,
          }),
        }).then(unwrapOk);
        return { status: "updated" };
      }

      const exercises = this._get(STORAGE_KEYS.EXERCISES) || [];
      const index = exercises.findIndex((item: Exercise) => item.id === exercise.id);
      if (index === -1) {
        throw new Error("Exercice introuvable");
      }
      const updatedExercise = normalizeExercise({
        ...exercises[index],
        ...exercise,
        exercise_type,
      });
      const updatedList = [...exercises];
      updatedList[index] = updatedExercise;
      this._save(STORAGE_KEYS.EXERCISES, updatedList);
      return { status: "updated" };
  },

  async deleteExercise(exerciseId: number) {
      if (canUseRemoteSync()) {
        const url = new URL(syncConfig.endpoint);
        url.searchParams.set("action", "exercises_delete");
        appendSharedToken(url);
        await fetchJson(url.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: exerciseId }),
        }).then(unwrapOk);
        return { status: "deleted" };
      }

      const exercises = this._get(STORAGE_KEYS.EXERCISES) || [];
      const updatedExercises = exercises.filter((exercise: Exercise) => exercise.id !== exerciseId);
      this._save(STORAGE_KEYS.EXERCISES, updatedExercises);
      const sessions = this._get(STORAGE_KEYS.STRENGTH_SESSIONS) || [];
      const updatedSessions = sessions.map((session: StrengthSessionTemplate) => ({
        ...session,
        items: Array.isArray(session.items)
          ? session.items.filter((item: StrengthSessionItem) => item.exercise_id !== exerciseId)
          : session.items,
      }));
      this._save(STORAGE_KEYS.STRENGTH_SESSIONS, updatedSessions);
      return { status: "deleted" };
  },

  async getStrengthSessions(): Promise<StrengthSessionTemplate[]> {
      if (canUseRemoteSync()) {
        const url = new URL(syncConfig.endpoint);
        url.searchParams.set("action", "strength_catalog_list");
        appendSharedToken(url);
        const payload = await fetchJson(url.toString(), {
          method: "GET",
          redirect: "follow",
          headers: {},
        }).then(unwrapOk);
        const sessions = Array.isArray(payload.sessions) ? payload.sessions : [];
        return sessions.map((session: any) => {
          const rawItems = Array.isArray(session.items) ? session.items : [];
          const cycle = normalizeCycleType(
            session.cycle ?? session.cycle_type ?? rawItems[0]?.cycle_type,
          );
          return {
            id: safeInt(session.id, Date.now()),
            title: String(session.name || session.title || ""),
            description: session.description ?? "",
            cycle,
            items: rawItems.map((item: any, index: number) =>
              normalizeStrengthItem(item, index, cycle),
            ),
          };
        });
      }
      return this._get(STORAGE_KEYS.STRENGTH_SESSIONS) || [];
  },

  async createStrengthSession(session: any) {
       const cycle = normalizeCycleType(session?.cycle ?? session?.cycle_type);
       const rawItems: unknown[] = Array.isArray(session?.items) ? session.items : [];
       const normalizedItems: StrengthSessionItem[] = rawItems.map((item, index) =>
         normalizeStrengthItem(item, index, cycle),
       );
       validateStrengthItems(normalizedItems);
       const itemsPayload = normalizedItems
         .sort((a, b) => a.order_index - b.order_index)
         .map((item) => ({
           ordre: item.order_index,
           exercise_id: item.exercise_id,
           cycle_type: item.cycle_type,
           sets: item.sets,
           reps: item.reps,
           pct_1rm: item.percent_1rm,
           rest_series_s: item.rest_seconds,
           notes: item.notes,
         }));

       if (syncConfig.hasCloudflareSync) {
         const url = new URL(syncConfig.endpoint);
         url.searchParams.set("action", "strength_catalog_create");
         appendSharedToken(url);
         await fetchJson(url.toString(), {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({
             session: {
               id: session?.id ?? null,
               name: session?.title ?? session?.name ?? "",
               description: session?.description ?? "",
               cycle_type: cycle,
             },
             items: itemsPayload,
           }),
         }).then(unwrapOk);
         return { status: "created" };
       }

       const s = this._get(STORAGE_KEYS.STRENGTH_SESSIONS) || [];
       const id = Date.now();
       // Enrich items with exercise details for easier display
       const enrichedItems = normalizedItems.map((item: StrengthSessionItem) => {
         const ex = (this._get(STORAGE_KEYS.EXERCISES) || []).find((e: any) => e.id === item.exercise_id);
         return { ...item, exercise_name: ex?.nom_exercice, category: ex?.exercise_type };
       });
       this._save(STORAGE_KEYS.STRENGTH_SESSIONS, [
         ...s,
         {
           ...session,
           title: session?.title ?? session?.name ?? "",
           cycle,
           items: enrichedItems,
           id,
         },
       ]);
       return { status: "created", id };
  },

  async updateStrengthSession(session: any) {
       if (!session?.id) {
         throw new Error("Session id manquant");
       }
       const cycle = normalizeCycleType(session?.cycle ?? session?.cycle_type);
       const rawItems: unknown[] = Array.isArray(session?.items) ? session.items : [];
       const normalizedItems: StrengthSessionItem[] = rawItems.map((item, index) =>
         normalizeStrengthItem(item, index, cycle),
       );
       validateStrengthItems(normalizedItems);
       const itemsPayload = normalizedItems
         .sort((a, b) => a.order_index - b.order_index)
         .map((item) => ({
           ordre: item.order_index,
           exercise_id: item.exercise_id,
           cycle_type: item.cycle_type,
           sets: item.sets,
           reps: item.reps,
           pct_1rm: item.percent_1rm,
           rest_series_s: item.rest_seconds,
           notes: item.notes,
         }));

       if (syncConfig.hasCloudflareSync) {
         const url = new URL(syncConfig.endpoint);
         url.searchParams.set("action", "strength_catalog_upsert");
         appendSharedToken(url);
         await fetchJson(url.toString(), {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({
             session: {
               id: session?.id ?? null,
               name: session?.title ?? session?.name ?? "",
               description: session?.description ?? "",
               cycle_type: cycle,
             },
             items: itemsPayload,
           }),
         }).then(unwrapOk);
         return { status: "updated" };
       }

       const sessions = this._get(STORAGE_KEYS.STRENGTH_SESSIONS) || [];
       const index = sessions.findIndex((item: StrengthSessionTemplate) => item.id === session.id);
       if (index === -1) {
         throw new Error("Séance introuvable");
       }
       const enrichedItems = normalizedItems.map((item: StrengthSessionItem) => {
         const ex = (this._get(STORAGE_KEYS.EXERCISES) || []).find((e: any) => e.id === item.exercise_id);
         return { ...item, exercise_name: ex?.nom_exercice, category: ex?.exercise_type };
       });
       const updatedSession = {
         ...sessions[index],
         ...session,
         title: session?.title ?? session?.name ?? "",
         cycle,
         items: enrichedItems,
       };
       const updatedSessions = [...sessions];
       updatedSessions[index] = updatedSession;
      this._save(STORAGE_KEYS.STRENGTH_SESSIONS, updatedSessions);
      return { status: "updated" };
  },

  async persistStrengthSessionOrder(session: StrengthSessionTemplate) {
       if (!session?.id) {
         throw new Error("Session id manquant");
       }
       const cycle = normalizeCycleType(session?.cycle ?? session?.cycle_type);
       const rawItems: unknown[] = Array.isArray(session?.items) ? session.items : [];
       const normalizedItems: StrengthSessionItem[] = rawItems.map((item, index) =>
         normalizeStrengthItem(item, index, cycle),
       );
       validateStrengthItems(normalizedItems);
       const itemsPayload = normalizedItems
         .sort((a, b) => a.order_index - b.order_index)
         .map((item) => ({
           ordre: item.order_index,
           exercise_id: item.exercise_id,
           cycle_type: item.cycle_type,
           sets: item.sets,
           reps: item.reps,
           pct_1rm: item.percent_1rm,
           rest_series_s: item.rest_seconds,
           notes: item.notes,
         }));

       if (syncConfig.hasCloudflareSync) {
         const url = new URL(syncConfig.endpoint);
         url.searchParams.set("action", "strength_catalog_upsert");
         appendSharedToken(url);
         await fetchJson(url.toString(), {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({
             session: {
               id: session?.id ?? null,
               name: session?.title ?? session?.name ?? "",
               description: session?.description ?? "",
               cycle_type: cycle,
             },
             items: itemsPayload,
           }),
         }).then(unwrapOk);
         return { status: "updated" };
       }

       const sessions = this._get(STORAGE_KEYS.STRENGTH_SESSIONS) || [];
       const index = sessions.findIndex((item: StrengthSessionTemplate) => item.id === session.id);
       if (index === -1) {
         throw new Error("Séance introuvable");
       }
       const enrichedItems = normalizedItems.map((item: StrengthSessionItem) => {
         const ex = (this._get(STORAGE_KEYS.EXERCISES) || []).find((e: any) => e.id === item.exercise_id);
         return { ...item, exercise_name: ex?.nom_exercice, category: ex?.exercise_type };
       });
       const updatedSessions = [...sessions];
       updatedSessions[index] = {
         ...sessions[index],
         ...session,
         title: session?.title ?? session?.name ?? "",
         cycle,
         items: enrichedItems,
       };
       this._save(STORAGE_KEYS.STRENGTH_SESSIONS, updatedSessions);
       return { status: "updated" };
  },

  async deleteStrengthSession(sessionId: number) {
      if (canUseRemoteSync()) {
        const url = new URL(syncConfig.endpoint);
        url.searchParams.set("action", "strength_catalog_delete");
        appendSharedToken(url);
        await fetchJson(url.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        }).then(unwrapOk);
        return { status: "deleted" };
      }

      const sessions = this._get(STORAGE_KEYS.STRENGTH_SESSIONS) || [];
      const updatedSessions = sessions.filter((session: StrengthSessionTemplate) => session.id !== sessionId);
      this._save(STORAGE_KEYS.STRENGTH_SESSIONS, updatedSessions);
      return { status: "deleted" };
  },

  async startStrengthRun(data: {
    assignment_id?: number | null;
    athlete_id?: number | null;
    athleteName?: string;
    session_id?: number;
    cycle_type?: string;
    progress_pct?: number;
  }) {
      if (canUseRemoteSync()) {
        const url = new URL(syncConfig.endpoint);
        url.searchParams.set("action", "strength_run_start");
        appendSharedToken(url);
        const payload = await fetchJson(url.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }).then(unwrapOk);
        return payload;
      }
      const runs = this._get(STORAGE_KEYS.STRENGTH_RUNS) || [];
      const run_id = Date.now();
      const newRun = {
        id: run_id,
        assignment_id: data.assignment_id,
        athlete_id: data.athlete_id ?? null,
        athlete_name: data.athleteName ?? null,
        session_id: data.session_id ?? null,
        cycle_type: data.cycle_type ?? null,
        status: "in_progress",
        progress_pct: data.progress_pct ?? 0,
        started_at: new Date().toISOString(),
        logs: [],
      };
      this._save(STORAGE_KEYS.STRENGTH_RUNS, [...runs, newRun]);
      if (data.assignment_id) {
        const assignments = this._get(STORAGE_KEYS.ASSIGNMENTS) || [];
        const updated = assignments.map((assignment: any) =>
          assignment.id === data.assignment_id ? { ...assignment, status: "in_progress" } : assignment,
        );
        this._save(STORAGE_KEYS.ASSIGNMENTS, updated);
      }
      return { run_id };
  },

  async logStrengthSet(payload: {
    run_id: number;
    exercise_id: number;
    set_index?: number | null;
    reps?: number | null;
    weight?: number | null;
    rpe?: number | null;
    notes?: string | null;
    pct_1rm_suggested?: number | null;
    rest_seconds?: number | null;
    athlete_id?: number | string | null;
    athleteId?: number | string | null;
    athlete_name?: string | null;
    athleteName?: string | null;
  }) {
      const maybeUpdateOneRm = async (context?: { athleteId?: number | string | null; athleteName?: string | null }) => {
        const estimate = estimateOneRm(Number(payload.weight), Number(payload.reps));
        if (!estimate) return null;
        const athleteId = context?.athleteId ?? null;
        const athleteName = context?.athleteName ?? null;
        if (athleteId === null && !athleteName) return null;
        const existing = await this.get1RM({ athleteName, athleteId });
        const existingByExercise = new Map<number, number>(
          (existing || []).map((record: any) => [record.exercise_id, Number(record.weight ?? 0)]),
        );
        const current = existingByExercise.get(payload.exercise_id) ?? 0;
        if (estimate <= current) return null;
        if (canUseRemoteSync() && (athleteId === null || athleteId === undefined || athleteId === "")) {
          return null;
        }
        await this.update1RM({
          athlete_id: athleteId ?? undefined,
          athlete_name: athleteName ?? undefined,
          exercise_id: payload.exercise_id,
          one_rm: estimate,
        });
        return estimate;
      };

      const resolveAthleteContext = (runs?: any[]) => {
        const athleteId = payload.athlete_id ?? payload.athleteId ?? null;
        const athleteName = payload.athlete_name ?? payload.athleteName ?? null;
        if (athleteId !== null || athleteName) {
          return { athleteId, athleteName };
        }
        if (!runs) return { athleteId: null, athleteName: null };
        const run = runs.find((entry: any) => entry.id === payload.run_id);
        return {
          athleteId: run?.athlete_id ?? null,
          athleteName: run?.athlete_name ?? null,
        };
      };

      if (canUseRemoteSync()) {
        const logUrl = new URL(syncConfig.endpoint);
        logUrl.searchParams.set("action", "strength_set_log");
        appendSharedToken(logUrl);
        await fetchJson(logUrl.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).then(unwrapOk);
        const context = resolveAthleteContext();
        const updated = await maybeUpdateOneRm(context);
        return { status: "ok", one_rm_updated: Boolean(updated), one_rm: updated ?? undefined };
      }

      const runs = this._get(STORAGE_KEYS.STRENGTH_RUNS) || [];
      const runIndex = runs.findIndex((entry: any) => entry.id === payload.run_id);
      const baseRun = runIndex >= 0 ? runs[runIndex] : { id: payload.run_id, logs: [] };
      const updatedLogs = [...(baseRun.logs || []), { ...payload, completed_at: new Date().toISOString() }];
      const updatedRun = { ...baseRun, logs: updatedLogs };
      const nextRuns =
        runIndex >= 0
          ? [...runs.slice(0, runIndex), updatedRun, ...runs.slice(runIndex + 1)]
          : [...runs, updatedRun];
      this._save(STORAGE_KEYS.STRENGTH_RUNS, nextRuns);
      const context = resolveAthleteContext(nextRuns);
      const updated = await maybeUpdateOneRm(context);
      return { status: "ok", one_rm_updated: Boolean(updated), one_rm: updated ?? undefined };
  },

  async updateStrengthRun(update: {
    run_id: number;
    progress_pct?: number;
    status?: "in_progress" | "completed" | "abandoned";
    [key: string]: any;
  }) {
      if (canUseRemoteSync()) {
        const updateUrl = new URL(syncConfig.endpoint);
        updateUrl.searchParams.set("action", "strength_run_update");
        appendSharedToken(updateUrl);
        await fetchJson(updateUrl.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            run_id: update.run_id,
            progress_pct: update.progress_pct,
            status: update.status,
            fatigue: update.fatigue,
            comments: update.comments,
          }),
        }).then(unwrapOk);
        return { status: "ok" };
      }

      const runs = this._get(STORAGE_KEYS.STRENGTH_RUNS) || [];
      const runIndex = runs.findIndex((entry: any) => entry.id === update.run_id);
      const now = new Date().toISOString();
      const baseRun = runIndex >= 0 ? runs[runIndex] : { id: update.run_id, started_at: now };
      const updatedRun = {
        ...baseRun,
        ...update,
        id: update.run_id,
        updated_at: now,
      };
      if (update.status === "completed" && !updatedRun.completed_at) {
        updatedRun.completed_at = now;
      }
      if (update.status === "completed") {
        const assignmentId = update.assignment_id ?? baseRun.assignment_id;
        if (assignmentId) {
          const assignments = this._get(STORAGE_KEYS.ASSIGNMENTS) || [];
          const updatedAssignments = assignments.map((assignment: any) =>
            assignment.id === assignmentId ? { ...assignment, status: "completed" } : assignment,
          );
          this._save(STORAGE_KEYS.ASSIGNMENTS, updatedAssignments);
        }
      }
      const nextRuns =
        runIndex >= 0
          ? [...runs.slice(0, runIndex), updatedRun, ...runs.slice(runIndex + 1)]
          : [...runs, updatedRun];
      this._save(STORAGE_KEYS.STRENGTH_RUNS, nextRuns);
      return { status: "ok" };
  },

  async deleteStrengthRun(runId: number) {
      const supportsRemoteDelete = canUseRemoteSync();
      if (supportsRemoteDelete) {
        try {
          const url = new URL(syncConfig.endpoint);
          url.searchParams.set("action", "strength_run_delete");
          appendSharedToken(url);
          await fetchJson(url.toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ run_id: runId }),
          }).then(unwrapOk);
          return { status: "deleted", source: "remote" as const };
        } catch {
          // Fallback localStorage si l'endpoint n'est pas disponible.
        }
      }

      const runs = this._get(STORAGE_KEYS.STRENGTH_RUNS) || [];
      const target = runs.find((entry: any) => entry.id === runId);
      const updatedRuns = runs.filter((entry: any) => entry.id !== runId);
      this._save(STORAGE_KEYS.STRENGTH_RUNS, updatedRuns);
      if (target?.assignment_id) {
        const assignments = this._get(STORAGE_KEYS.ASSIGNMENTS) || [];
        const nextAssignments = assignments.map((assignment: any) =>
          assignment.id === target.assignment_id ? { ...assignment, status: "assigned" } : assignment,
        );
        this._save(STORAGE_KEYS.ASSIGNMENTS, nextAssignments);
      }
      return {
        status: "deleted",
        source: supportsRemoteDelete ? "local_fallback" as const : "local" as const,
      };
  },

  async saveStrengthRun(run: any) {
      if (canUseRemoteSync()) {
        let runId = run.run_id;
        if (!runId) {
          const startUrl = new URL(syncConfig.endpoint);
          startUrl.searchParams.set("action", "strength_run_start");
          appendSharedToken(startUrl);
          const startData = await fetchJson(startUrl.toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              assignment_id: run.assignment_id,
              athlete_id: run.athlete_id ?? null,
              athleteName: run.athlete_name ?? null,
              progress_pct: run.progress_pct ?? 0,
            }),
          }).then(unwrapOk);
          runId = startData.run_id;
        }

        if (runId && Array.isArray(run.logs) && run.logs.length > 0) {
          const logUrl = new URL(syncConfig.endpoint);
          logUrl.searchParams.set("action", "strength_set_log");
          appendSharedToken(logUrl);
          await Promise.all(
            run.logs.map((log: any, index: number) =>
              fetchJson(logUrl.toString(), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  run_id: runId,
                  exercise_id: log.exercise_id,
                  set_index: log.set_index ?? log.set_number ?? index,
                  reps: log.reps ?? null,
                  weight: log.weight ?? null,
                  rpe: log.rpe ?? null,
                  notes: log.notes ?? null,
                }),
              }).then(unwrapOk),
            ),
          );
        }

        const estimatedRecords = new Map<number, number>();
        const logs = Array.isArray(run.logs) ? run.logs : [];
        logs.forEach((log: any) => {
          const estimate = estimateOneRm(Number(log.weight), Number(log.reps));
          if (!estimate) return;
          const exerciseId = Number(log.exercise_id);
          if (!Number.isFinite(exerciseId)) return;
          const current = estimatedRecords.get(exerciseId) ?? 0;
          if (estimate > current) {
            estimatedRecords.set(exerciseId, estimate);
          }
        });
        if (estimatedRecords.size > 0) {
          const athleteId = run.athlete_id ?? null;
          const athleteName = run.athlete_name ?? null;
          if (!(canUseRemoteSync() && (athleteId === null || athleteId === undefined || athleteId === ""))) {
            const existing = await this.get1RM({ athleteName, athleteId });
            const existingByExercise = new Map<number, number>(
              (existing || []).map((record: any) => [record.exercise_id, Number(record.weight ?? 0)]),
            );
            await Promise.all(
              Array.from(estimatedRecords.entries())
                .filter(([exerciseId, estimate]) => estimate > (existingByExercise.get(exerciseId) ?? 0))
                .map(([exerciseId, estimate]) =>
                  this.update1RM({
                    athlete_id: athleteId ?? undefined,
                    athlete_name: athleteName ?? undefined,
                    exercise_id: exerciseId,
                    one_rm: estimate,
                  }),
                ),
            );
          }
        }

        if (runId) {
          const updateUrl = new URL(syncConfig.endpoint);
          updateUrl.searchParams.set("action", "strength_run_update");
          appendSharedToken(updateUrl);
          await fetchJson(updateUrl.toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              run_id: runId,
              progress_pct: run.progress_pct ?? 100,
              status: "completed",
            }),
          }).then(unwrapOk);
        }
        return { status: "ok", run_id: runId ?? null };
      }

      const runs = this._get(STORAGE_KEYS.STRENGTH_RUNS) || [];
      const runId = run.run_id ?? Date.now();
      const existing = runs.find((entry: any) => entry.id === runId) || {};
      const completedRun = {
        ...existing,
        ...run,
        id: runId,
        status: "completed",
        started_at: existing.started_at ?? run.started_at ?? run.date ?? new Date().toISOString(),
        completed_at: new Date().toISOString(),
      };
      this._save(
        STORAGE_KEYS.STRENGTH_RUNS,
        [...runs.filter((entry: any) => entry.id !== runId), completedRun],
      );
      if (run.assignment_id) {
        const assignments = this._get(STORAGE_KEYS.ASSIGNMENTS) || [];
        const updated = assignments.map((assignment: any) =>
          assignment.id === run.assignment_id ? { ...assignment, status: "completed" } : assignment,
        );
        this._save(STORAGE_KEYS.ASSIGNMENTS, updated);
      }
      const estimatedRecords = new Map<number, number>();
      const logs = Array.isArray(run.logs) ? run.logs : [];
      logs.forEach((log: any) => {
        const estimate = estimateOneRm(Number(log.weight), Number(log.reps));
        if (!estimate) return;
        const exerciseId = Number(log.exercise_id);
        if (!Number.isFinite(exerciseId)) return;
        const current = estimatedRecords.get(exerciseId) ?? 0;
        if (estimate > current) {
          estimatedRecords.set(exerciseId, estimate);
        }
      });
      if (estimatedRecords.size > 0) {
        const athleteId = run.athlete_id ?? null;
        const athleteName = run.athlete_name ?? null;
        const existing = await this.get1RM({ athleteName, athleteId });
        const existingByExercise = new Map<number, number>(
          (existing || []).map((record: any) => [record.exercise_id, Number(record.weight ?? 0)]),
        );
        await Promise.all(
          Array.from(estimatedRecords.entries())
            .filter(([exerciseId, estimate]) => estimate > (existingByExercise.get(exerciseId) ?? 0))
            .map(([exerciseId, estimate]) =>
              this.update1RM({
                athlete_id: athleteId ?? undefined,
                athlete_name: athleteName ?? undefined,
                exercise_id: exerciseId,
                one_rm: estimate,
              }),
            ),
        );
      }
      return { status: "ok", run_id: runId };
  },

  async strengthRunStart(data: {
      assignmentId: number;
      athleteId?: number | string | null;
      athleteName?: string | null;
      progressPct?: number;
  }) {
      if (canUseRemoteSync()) {
        const url = new URL(syncConfig.endpoint);
        url.searchParams.set("action", "strength_run_start");
        appendSharedToken(url);
        const payload = await fetchJson(url.toString(), {
          method: "POST",
          redirect: "follow",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignment_id: data.assignmentId,
            athlete_id: data.athleteId,
            athleteName: data.athleteName,
            progress_pct: data.progressPct ?? 0,
          }),
        });
        if (!payload || payload.ok !== true) {
          throw new Error(payload?.error || "Format inattendu");
        }
        return payload.data || payload;
      }

      const runId = Date.now();
      const runs = this._get(STORAGE_KEYS.STRENGTH_RUNS) || [];
      this._save(STORAGE_KEYS.STRENGTH_RUNS, [
        ...runs,
        {
          id: runId,
          assignment_id: data.assignmentId,
          athlete_id: data.athleteId ?? null,
          athlete_name: data.athleteName ?? null,
          status: "in_progress",
          progress_pct: data.progressPct ?? 0,
          started_at: new Date().toISOString(),
        },
      ]);

      const assignments = this._get(STORAGE_KEYS.ASSIGNMENTS) || [];
      const updatedAssignments = assignments.map((assignment: any) =>
        assignment.id === data.assignmentId
          ? { ...assignment, status: "in_progress", updated_at: new Date().toISOString() }
          : assignment,
      );
      this._save(STORAGE_KEYS.ASSIGNMENTS, updatedAssignments);
      return { run_id: runId };
  },
  
  async getStrengthHistory(
    athleteName: string,
    options?: {
      athleteId?: number | string | null;
      limit?: number;
      offset?: number;
      order?: "asc" | "desc";
      status?: string;
      from?: string;
      to?: string;
    },
  ): Promise<StrengthHistoryResult> {
    const limitRaw = options?.limit ?? 50;
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Number(limitRaw), 1), 200) : 50;
    const offsetRaw = options?.offset ?? 0;
    const offset = Number.isFinite(offsetRaw) ? Math.max(Number(offsetRaw), 0) : 0;
    const order = options?.order === "asc" ? "asc" : "desc";
    const athleteId = options?.athleteId;
    const hasAthleteId = athleteId !== null && athleteId !== undefined && athleteId !== "";

    if (canUseRemoteSync()) {
      const url = new URL(syncConfig.endpoint);
      url.searchParams.set("action", "strength_history");
      if (hasAthleteId) {
        url.searchParams.set("athlete_id", String(athleteId));
      } else if (athleteName) {
        url.searchParams.set("athleteName", athleteName);
      }
      url.searchParams.set("limit", String(limit));
      url.searchParams.set("offset", String(offset));
      url.searchParams.set("order", order);
      if (options?.status) {
        url.searchParams.set("status", options.status);
      }
      if (options?.from) {
        url.searchParams.set("from", options.from);
      }
      if (options?.to) {
        url.searchParams.set("to", options.to);
      }
      appendSharedToken(url);
      const payload = await fetchJson(url.toString(), {
        method: "GET",
        redirect: "follow",
        headers: {},
      });
      if (!payload || payload.ok !== true) {
        throw new Error(payload?.error || "Format inattendu");
      }
      const runs = Array.isArray(payload?.data?.runs) ? payload.data.runs : [];
      const exercise_summary = Array.isArray(payload?.data?.exercise_summary) ? payload.data.exercise_summary : [];
      const pagination = payload?.meta?.pagination || { limit, offset, total: runs.length };
      return { runs, pagination, exercise_summary };
    }

    const runs = this._get(STORAGE_KEYS.STRENGTH_RUNS) || [];
    const filtered = runs.filter((r: any) => {
      if (hasAthleteId && String(r.athlete_id) !== String(athleteId)) {
        return false;
      }
      if (!hasAthleteId && athleteName && r.athlete_name !== athleteName) {
        return false;
      }
      if (options?.status && r.status !== options.status) {
        return false;
      }
      if (options?.from || options?.to) {
        const dateValue = new Date(r.date || r.started_at || r.created_at || 0).getTime();
        if (options?.from) {
          const fromTime = new Date(options.from).getTime();
          if (Number.isFinite(fromTime) && dateValue < fromTime) {
            return false;
          }
        }
        if (options?.to) {
          const toDate = new Date(options.to);
          toDate.setHours(23, 59, 59, 999);
          const toTime = toDate.getTime();
          if (Number.isFinite(toTime) && dateValue > toTime) {
            return false;
          }
        }
      }
      return true;
    });
    const sorted = filtered.sort((a: any, b: any) => {
      const aDate = new Date(a.date || a.started_at || a.created_at || 0).getTime();
      const bDate = new Date(b.date || b.started_at || b.created_at || 0).getTime();
      return order === "asc" ? aDate - bDate : bDate - aDate;
    });
    const exercises = this._get(STORAGE_KEYS.EXERCISES) || [];
    const exerciseMap = new Map(
      (Array.isArray(exercises) ? exercises : []).map((exercise: any) => [
        safeInt(exercise.id),
        exercise.nom_exercice || exercise.name || `Exercice ${exercise.id}`,
      ]),
    );
    const exerciseSummaryMap = new Map<number, StrengthExerciseSummary>();
    sorted.forEach((run: any) => {
      (run.logs || []).forEach((log: any) => {
        const exerciseId = safeInt(log.exercise_id);
        if (!exerciseId) return;
        const current = exerciseSummaryMap.get(exerciseId) || {
          exercise_id: exerciseId,
          exercise_name: exerciseMap.get(exerciseId) || `Exercice ${exerciseId}`,
          total_sets: 0,
          total_reps: 0,
          total_volume: 0,
          max_weight: null,
          last_performed_at: null,
        };
        const reps = Number(log.reps ?? 0) || 0;
        const weight = Number(log.weight ?? 0) || 0;
        current.total_sets += 1;
        current.total_reps += reps;
        current.total_volume += reps * weight;
        current.max_weight = Math.max(current.max_weight ?? 0, weight) || current.max_weight;
        const completedAt = log.completed_at || run.completed_at || run.started_at || null;
        if (completedAt) {
          const completedAtTime = new Date(completedAt).getTime();
          const currentTime = current.last_performed_at ? new Date(current.last_performed_at).getTime() : 0;
          if (!current.last_performed_at || completedAtTime > currentTime) {
            current.last_performed_at = completedAt;
          }
        }
        exerciseSummaryMap.set(exerciseId, current);
      });
    });
    const total = sorted.length;
    const page = sorted.slice(offset, offset + limit);
    const exercise_summary = Array.from(exerciseSummaryMap.values()).sort(
      (a, b) => b.total_volume - a.total_volume,
    );
    return { runs: page, pagination: { limit, offset, total }, exercise_summary };
  },

  async getStrengthHistoryAggregate(
    athleteName: string,
    options?: {
      athleteId?: number | string | null;
      period?: "day" | "week" | "month";
      limit?: number;
      offset?: number;
      order?: "asc" | "desc";
      status?: string;
      from?: string;
      to?: string;
    },
  ): Promise<StrengthHistoryAggregateResult> {
    const limitRaw = options?.limit ?? 200;
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Number(limitRaw), 1), 200) : 200;
    const offsetRaw = options?.offset ?? 0;
    const offset = Number.isFinite(offsetRaw) ? Math.max(Number(offsetRaw), 0) : 0;
    const order = options?.order === "asc" ? "asc" : "desc";
    const athleteId = options?.athleteId;
    const hasAthleteId = athleteId !== null && athleteId !== undefined && athleteId !== "";
    const period = options?.period ?? "day";

    if (syncConfig.hasCloudflareSync) {
      const url = new URL(syncConfig.endpoint);
      url.searchParams.set("action", "strength_history_aggregate");
      if (hasAthleteId) {
        url.searchParams.set("athlete_id", String(athleteId));
      } else if (athleteName) {
        url.searchParams.set("athleteName", athleteName);
      }
      url.searchParams.set("limit", String(limit));
      url.searchParams.set("offset", String(offset));
      url.searchParams.set("order", order);
      url.searchParams.set("period", period);
      if (options?.status) {
        url.searchParams.set("status", options.status);
      }
      if (options?.from) {
        url.searchParams.set("from", options.from);
      }
      if (options?.to) {
        url.searchParams.set("to", options.to);
      }
      appendSharedToken(url);
      const payload = await fetchJson(url.toString(), {
        method: "GET",
        redirect: "follow",
        headers: {},
      });
      if (!payload || payload.ok !== true) {
        throw new Error(payload?.error || "Format inattendu");
      }
      const periods = Array.isArray(payload?.data?.periods) ? payload.data.periods : [];
      const pagination = payload?.meta?.pagination || { limit, offset, total: periods.length };
      return { periods, pagination };
    }

    const runs = this._get(STORAGE_KEYS.STRENGTH_RUNS) || [];
    const filtered = runs.filter((r: any) => {
      if (hasAthleteId) {
        return r.athlete_id ? String(r.athlete_id) === String(athleteId) : false;
      }
      return r.athlete_name === athleteName;
    });
    const fromDate = options?.from ? new Date(options.from) : null;
    const toDate = options?.to ? new Date(options.to) : null;
    const periodEntries = new Map<string, StrengthHistoryAggregateEntry>();
    const getPeriodKey = (date: Date) => {
      if (period === "month") {
        return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
      }
      if (period === "week") {
        const temp = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
        const day = temp.getUTCDay() || 7;
        temp.setUTCDate(temp.getUTCDate() + 4 - day);
        const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((temp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        return `${temp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
      }
      return date.toISOString().split("T")[0];
    };
    filtered.forEach((run: any) => {
      const logs = Array.isArray(run.logs) ? run.logs : [];
      logs.forEach((log: any) => {
        const dateValue = log.completed_at || run.started_at || run.date || run.created_at;
        if (!dateValue) return;
        const date = new Date(dateValue);
        if (Number.isNaN(date.getTime())) return;
        if (fromDate && date < fromDate) return;
        if (toDate && date > toDate) return;
        const key = getPeriodKey(date);
        const entry = periodEntries.get(key) || { period: key, tonnage: 0, volume: 0 };
        const reps = Number(log.reps) || 0;
        const weight = Number(log.weight) || 0;
        entry.volume += reps;
        entry.tonnage += reps * weight;
        periodEntries.set(key, entry);
      });
    });
    const sorted = Array.from(periodEntries.values()).sort((a, b) => {
      if (order === "asc") {
        return a.period.localeCompare(b.period);
      }
      return b.period.localeCompare(a.period);
    });
    const total = sorted.length;
    const page = sorted.slice(offset, offset + limit);
    return { periods: page, pagination: { limit, offset, total } };
  },

  async get1RM(athlete: string | { athleteName?: string | null; athleteId?: number | string | null }) {
      const athleteName = typeof athlete === "string" ? athlete : (athlete?.athleteName ?? null);
      const athleteId = typeof athlete === "string" ? null : (athlete?.athleteId ?? null);
      if (canUseRemoteSync()) {
        const url = new URL(syncConfig.endpoint);
        url.searchParams.set("action", "one_rm_upsert");
        if (athleteId !== null && athleteId !== undefined && String(athleteId) !== "") {
          url.searchParams.set("athlete_id", String(athleteId));
        } else if (athleteName) {
          url.searchParams.set("athleteName", athleteName);
        }
        appendSharedToken(url);
        const payload = await fetchJson(url.toString(), {
          method: "GET",
          redirect: "follow",
          headers: {},
        }).then(unwrapOk);
        const rawRecords = payload.records ?? payload;
        const records = Array.isArray(rawRecords) ? rawRecords : [];
        return records.map((record: any) => ({
          id: safeOptionalInt(record.id),
          athlete_id: safeOptionalInt(record.athlete_id),
          exercise_id: safeInt(record.exercise_id),
          weight: Number(record.one_rm ?? record.weight ?? 0),
          recorded_at: record.recorded_at ?? record.date ?? null,
        }));
      }
      const records = this._get(STORAGE_KEYS.ONE_RM) || [];
      return records.filter((r: any) => r.athlete_name === athleteName);
  },
  
  async update1RM(record: {
      athlete_id?: number | string | null;
      athleteId?: number | string | null;
      athlete_name?: string | null;
      athleteName?: string | null;
      exercise_id: number;
      one_rm?: number;
      weight?: number;
    }) {
      if (canUseRemoteSync()) {
        const athleteId = record.athlete_id ?? record.athleteId;
        const oneRm = record.one_rm ?? record.weight;
        if (athleteId === null || athleteId === undefined || athleteId === "" || oneRm === null || oneRm === undefined) {
          throw new Error("athlete_id et one_rm sont requis");
        }
        const url = new URL(syncConfig.endpoint);
        url.searchParams.set("action", "one_rm_upsert");
        appendSharedToken(url);
        await fetchJson(url.toString(), {
          method: "POST",
          redirect: "follow",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            athlete_id: athleteId,
            exercise_id: record.exercise_id,
            one_rm: oneRm,
          }),
        }).then(unwrapOk);
        return { status: "ok" };
      }
      const records = this._get(STORAGE_KEYS.ONE_RM) || [];
      const athleteName = record.athlete_name ?? record.athleteName;
      const filtered = records.filter((r: any) => !(r.athlete_name === athleteName && r.exercise_id === record.exercise_id));
      this._save(STORAGE_KEYS.ONE_RM, [
        ...filtered,
        { ...record, athlete_name: athleteName, id: Date.now(), date: new Date().toISOString() },
      ]);
      return { status: "ok" };
  },

  async getSwimRecords(options: { athleteId?: number | null; athleteName?: string | null }) {
      if (syncConfig.endpoint) {
        const baseUrl = new URL(syncConfig.endpoint);
        baseUrl.searchParams.set("action", "swim_records");
        if (options.athleteId) {
          baseUrl.searchParams.set("athlete_id", String(options.athleteId));
        } else if (options.athleteName) {
          baseUrl.searchParams.set("athleteName", options.athleteName);
        }
        appendSharedToken(baseUrl);

        const limit = 200; // worker cap = 200
        const hardCap = 2000; // safety guard
        let offset = 0;
        let total = 0;
        const all: any[] = [];

        while (true) {
          const pageUrl = new URL(baseUrl.toString());
          pageUrl.searchParams.set("limit", String(limit));
          pageUrl.searchParams.set("offset", String(offset));

          const payload = await fetchJson(pageUrl.toString(), {
            method: "GET",
            redirect: "follow",
            headers: {},
          });
          if (!payload || payload.ok !== true) {
            throw new Error(payload?.error || "Format inattendu");
          }

          const pageRecords = Array.isArray(payload?.data?.records) ? payload.data.records : [];
          const pagination = payload?.meta?.pagination || {};
          total = Number(pagination.total || total || 0);

          all.push(...pageRecords);
          offset += pageRecords.length;

          if (pageRecords.length === 0) break;
          if (total && offset >= total) break;
          if (offset >= hardCap) break;
          if (pageRecords.length < limit) break;
        }

        return {
          records: all,
          pagination: { limit: all.length, offset: 0, total: total || all.length },
        };
      }


      const records = this._get(STORAGE_KEYS.SWIM_RECORDS) || [];
      const filtered = records.filter((r: any) => {
        if (options.athleteId) return r.athlete_id === options.athleteId;
        if (options.athleteName) return r.athlete_name === options.athleteName;
        return false;
      });
      return { records: filtered, pagination: { limit: filtered.length, offset: 0, total: filtered.length } };
  },

  async upsertSwimRecord(payload: {
    id?: number | null;
    athlete_id?: number | null;
    athleteName?: string | null;
    athlete_name?: string | null;
    event_name: string;
    pool_length?: number | null;
    time_seconds?: number | null;
    record_date?: string | null;
    notes?: string | null;
    /** Points FFN. Optionnel: ne doit pas casser le flow existant si absent. */
    ffn_points?: number | null;
    record_type?: "training" | "comp" | string | null;
  }) {
      if (syncConfig.endpoint) {
        const url = new URL(syncConfig.endpoint);
        url.searchParams.set("action", "swim_records_upsert");
        appendSharedToken(url);
        await fetchJson(url.toString(), {
          method: "POST",
          redirect: "follow",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).then(unwrapOk);
        return { status: "ok" };
      }

      const records = this._get(STORAGE_KEYS.SWIM_RECORDS) || [];
      if (payload.id) {
        const updated = records.map((record: any) =>
          record.id === payload.id
            ? { ...record, ...payload, athlete_id: payload.athlete_id ?? record.athlete_id }
            : record,
        );
        this._save(STORAGE_KEYS.SWIM_RECORDS, updated);
        return { status: "ok" };
      }
      const created = {
        ...payload,
        id: Date.now(),
        athlete_id: payload.athlete_id ?? -1,
        athlete_name: payload.athleteName ?? null,
      };
      this._save(STORAGE_KEYS.SWIM_RECORDS, [...records, created]);
      return { status: "created" };
  },

  // --- SWIM CATALOG ---
  async getSwimCatalog(): Promise<SwimSessionTemplate[]> {
      if (syncConfig.hasCloudflareSync) {
        const url = new URL(syncConfig.endpoint);
        url.searchParams.set("action", "swim_catalog_list");
        appendSharedToken(url);
        const payload = await fetchJson(url.toString(), {
          method: "GET",
          redirect: "follow",
          headers: {},
        }).then(unwrapOk);
        const catalogs = Array.isArray(payload.catalogs) ? payload.catalogs : [];
        return catalogs.map((catalog: any) => ({
          id: safeInt(catalog.id, Date.now()),
          name: String(catalog.name || ""),
          description: catalog.description ?? null,
          created_by: safeOptionalInt(catalog.created_by) ?? null,
          created_at: catalog.created_at ?? null,
          updated_at: catalog.updated_at ?? null,
          items: Array.isArray(catalog.items)
            ? catalog.items.map((item: any, index: number) => ({
                id: safeOptionalInt(item.id) ?? undefined,
                catalog_id: safeOptionalInt(item.catalog_id) ?? undefined,
                ordre: safeOptionalInt(item.ordre) ?? index,
                label: item.label ?? null,
                distance: safeOptionalInt(item.distance) ?? null,
                duration: safeOptionalInt(item.duration) ?? null,
                intensity: item.intensity ?? null,
                notes: item.notes ?? null,
                raw_payload: parseRawPayload(item.raw_payload),
              }))
            : [],
        }));
      }

      const raw = this._get(STORAGE_KEYS.SWIM_SESSIONS) || [];
      return raw.map((catalog: any) => ({
        id: safeInt(catalog.id, Date.now()),
        name: String(catalog.name || catalog.title || ""),
        description: catalog.description ?? null,
        created_by: safeOptionalInt(catalog.created_by) ?? null,
        created_at: catalog.created_at ?? null,
        updated_at: catalog.updated_at ?? null,
        items: Array.isArray(catalog.items)
          ? catalog.items.map((item: any, index: number) => ({
              id: safeOptionalInt(item.id) ?? undefined,
              catalog_id: safeOptionalInt(item.catalog_id) ?? undefined,
              ordre: safeOptionalInt(item.ordre) ?? index,
              label: item.label ?? item.section ?? null,
              distance: safeOptionalInt(item.distance) ?? null,
              duration: safeOptionalInt(item.duration) ?? null,
              intensity: item.intensity ?? null,
              notes: item.notes ?? item.instruction ?? null,
              raw_payload: parseRawPayload(item.raw_payload) ?? (item.section || item.stroke || item.instruction || item.rest
                ? {
                    section: item.section,
                    stroke: item.stroke,
                    instruction: item.instruction,
                    rest: item.rest,
                  }
                : null),
            }))
          : [],
      }));
  },

  async createSwimSession(session: any) {
      if (syncConfig.hasCloudflareSync) {
        const url = new URL(syncConfig.endpoint);
        url.searchParams.set("action", "swim_catalog_upsert");
        appendSharedToken(url);
        const items = Array.isArray(session.items)
          ? session.items.map((item: any, index: number) => ({
              ordre: item.ordre ?? index,
              label: item.label ?? null,
              distance: item.distance ?? null,
              duration: item.duration ?? null,
              intensity: item.intensity ?? null,
              notes: item.notes ?? null,
              raw_payload: item.raw_payload ?? null,
            }))
          : [];
        await fetchJson(url.toString(), {
          method: "POST",
          redirect: "follow",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            catalog: {
              id: session.id ?? undefined,
              name: session.name,
              description: session.description ?? null,
            },
            items,
          }),
        }).then(unwrapOk);
        return { status: "created" };
      }

      const s = this._get(STORAGE_KEYS.SWIM_SESSIONS) || [];
      if (session.id) {
        const exists = s.some((entry: any) => entry.id === session.id);
        const updated = exists
          ? s.map((entry: any) => (entry.id === session.id ? { ...entry, ...session } : entry))
          : [...s, { ...session, id: session.id }];
        this._save(STORAGE_KEYS.SWIM_SESSIONS, updated);
        return { status: exists ? "updated" : "created" };
      }
      this._save(STORAGE_KEYS.SWIM_SESSIONS, [...s, { ...session, id: Date.now() }]);
      return { status: "created" };
  },

  async deleteSwimSession(sessionId: number) {
      if (syncConfig.hasCloudflareSync) {
        const url = new URL(syncConfig.endpoint);
        url.searchParams.set("action", "swim_catalog_delete");
        appendSharedToken(url);
        await fetchJson(url.toString(), {
          method: "POST",
          redirect: "follow",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ catalog_id: sessionId }),
        }).then(unwrapOk);
        return { status: "deleted" };
      }
      const sessions = this._get(STORAGE_KEYS.SWIM_SESSIONS) || [];
      const updatedSessions = sessions.filter((session: SwimSessionTemplate) => session.id !== sessionId);
      this._save(STORAGE_KEYS.SWIM_SESSIONS, updatedSessions);
      return { status: "deleted" };
  },

  async getAssignmentsForCoach(): Promise<Assignment[] | null> {
      if (canUseRemoteSync()) {
        return null;
      }
      await delay(100);
      return this._get(STORAGE_KEYS.ASSIGNMENTS) || [];
  },

  // --- ASSIGNMENTS & NOTIFICATIONS ---
  async getAssignments(
    athleteName: string,
    athleteId?: number | null,
    options?: { assignmentType?: "swim" | "strength"; status?: string },
  ): Promise<Assignment[]> {
      if (canUseRemoteSync()) {
        const groupIds = await fetchUserGroupIds(athleteId ?? null);
        const targets = [
          ...(athleteId !== null && athleteId !== undefined ? [{ type: "user" as const, id: athleteId }] : []),
          ...groupIds.map((id) => ({ type: "group" as const, id })),
        ];
        if (!targets.length) return [];
        const rawAssignments = (
          await Promise.all(
            targets.map(async (target) => {
              const url = new URL(syncConfig.endpoint);
              url.searchParams.set("action", "assignments_list");
              if (target.type === "user") {
                url.searchParams.set("target_user_id", String(target.id));
              } else {
                url.searchParams.set("target_group_id", String(target.id));
              }
              if (options?.assignmentType) {
                url.searchParams.set("assignment_type", options.assignmentType);
              }
              if (options?.status) {
                url.searchParams.set("status", options.status);
              }
              appendSharedToken(url);
              const payload = await fetchJson(url.toString(), {
                method: "GET",
                redirect: "follow",
                headers: {},
              });
              if (!payload || payload.ok !== true) {
                throw new Error(payload?.error || "Format inattendu");
              }
              return Array.isArray(payload?.data?.assignments) ? payload.data.assignments : [];
            }),
          )
        ).flat();
        if (rawAssignments.length === 0) return [];
        const [swimCatalogs, strengthCatalogs] = await Promise.all([
          this.getSwimCatalog(),
          this.getStrengthSessions(),
        ]);
        const swimById = new Map(swimCatalogs.map((catalog) => [catalog.id, catalog]));
        const strengthById = new Map(strengthCatalogs.map((session) => [session.id, session]));
        const mapped = rawAssignments
          .map((assignment: any) => {
            const sessionType = assignment.assignment_type === "strength" ? "strength" : "swim";
            const sessionId =
              safeOptionalInt(
                sessionType === "swim" ? assignment.swim_catalog_id : assignment.strength_session_id,
              ) ?? 0;
            const scheduledDate = assignment.scheduled_date || assignment.due_at || assignment.created_at || "";
            const status = String(assignment.status || "assigned");
            const swimSession = sessionType === "swim" ? swimById.get(sessionId) : undefined;
            const strengthSession = sessionType === "strength" ? strengthById.get(sessionId) : undefined;
            const base = {
              id: safeInt(assignment.id, Date.now()),
              session_id: sessionId,
              session_type: sessionType,
              title:
                sessionType === "swim"
                  ? swimSession?.name ?? "Séance natation"
                  : strengthSession?.title ?? "Séance musculation",
              description: (swimSession?.description ?? strengthSession?.description) ?? "",
              assigned_date: scheduledDate || new Date().toISOString(),
              status,
              items: strengthSession?.items ?? swimSession?.items,
            } as Assignment & { cycle?: string };
            if (sessionType === "strength") {
              base.cycle = strengthSession?.cycle ?? "endurance";
            }
            return base;
          })
          .filter((assignment: Assignment) => assignment.status !== "completed");
        const unique = new Map(mapped.map((assignment) => [assignment.id, assignment]));
        return Array.from(unique.values());
      }

      await delay(200);
      const all = this._get(STORAGE_KEYS.ASSIGNMENTS) || [];
      return all.filter((a: any) => {
        const matchesUserId =
          athleteId !== null &&
          athleteId !== undefined &&
          String(athleteId) !== "" &&
          String(a.target_user_id) === String(athleteId);
        const matchesUser = matchesUserId || a.target_athlete === athleteName;
        if (!matchesUser) return false;
        if (options?.assignmentType && a.session_type !== options.assignmentType) return false;
        if (options?.status) return a.status === options.status;
        return a.status !== "completed";
      });
  },

  async assignments_create(data: {
    assignment_type?: "swim" | "strength";
    session_type?: "swim" | "strength";
    session_id: number;
    target_athlete?: string;
    target_user_id?: number | null;
    target_group_id?: number | null;
    assigned_date?: string;
    scheduled_date?: string;
  }) {
      const assignmentType = data.assignment_type ?? data.session_type;
      if (!assignmentType) return { status: "error" };
      const scheduledDate = data.scheduled_date ?? data.assigned_date ?? new Date().toISOString();
      if (syncConfig.hasCloudflareSync) {
        const payload: Record<string, unknown> = {
          assignment_type: assignmentType,
          session_id: data.session_id,
          scheduled_date: scheduledDate,
        };
        if (data.target_user_id !== null && data.target_user_id !== undefined) {
          payload.target_user_id = data.target_user_id;
        } else if (data.target_group_id !== null && data.target_group_id !== undefined) {
          payload.target_group_id = data.target_group_id;
        }
        await fetchJson(`${syncConfig.endpoint}?action=assignments_create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).then(unwrapOk);
        return { status: "assigned" };
      }

      // Fetch source session to copy details (simplification for mock)
      let source: any;
      if (assignmentType === 'swim') {
          source = (this._get(STORAGE_KEYS.SWIM_SESSIONS) || []).find((s: any) => s.id === data.session_id);
      } else {
          source = (this._get(STORAGE_KEYS.STRENGTH_SESSIONS) || []).find((s: any) => s.id === data.session_id);
      }

      if (!source) return { status: "error" };

      const assignment = {
          id: Date.now(),
          session_id: data.session_id,
          session_type: assignmentType,
          target_athlete: data.target_athlete ?? "",
          target_user_id: data.target_user_id ?? null,
          target_group_id: data.target_group_id ?? null,
          assigned_date: scheduledDate,
          title: source.name ?? source.title,
          description: source.description,
          items: source.items,
          status: 'assigned'
      };

      const all = this._get(STORAGE_KEYS.ASSIGNMENTS) || [];
      this._save(STORAGE_KEYS.ASSIGNMENTS, [...all, assignment]);

      // Create Notification
      const notifs = this._get(STORAGE_KEYS.NOTIFICATIONS) || [];
      this._save(STORAGE_KEYS.NOTIFICATIONS, [...notifs, {
          id: Date.now() + 1,
          sender: "Coach",
          target_athlete: data.target_athlete,
          target_user_id: data.target_user_id ?? null,
          target_group_id: data.target_group_id ?? null,
          title: "Nouvelle séance assignée",
          message: `Séance ${source.title ?? source.name} prévue le ${scheduledDate}.`,
          type: "assignment",
          related_id: assignment.id,
          read: false,
          date: new Date().toISOString()
      }]);

      return { status: "assigned" };
  },

  async assignments_delete(assignmentId: number) {
      if (syncConfig.hasCloudflareSync) {
        const url = new URL(syncConfig.endpoint);
        url.searchParams.set("action", "assignments_delete");
        url.searchParams.set("assignment_id", String(assignmentId));
        await fetchJson(url.toString(), { method: "DELETE" }).then(unwrapOk);
        return { status: "deleted" };
      }

      const assignments = this._get(STORAGE_KEYS.ASSIGNMENTS) || [];
      const updated = assignments.filter((assignment: any) => assignment.id !== assignmentId);
      this._save(STORAGE_KEYS.ASSIGNMENTS, updated);
      return { status: "deleted" };
  },

  async getNotifications(athleteName: string): Promise<Notification[]> {
      await delay(200);
      const notifs = this._get(STORAGE_KEYS.NOTIFICATIONS) || [];
      return notifs.filter((n: any) => n.target_athlete === athleteName || n.target_athlete === "All").reverse();
  },
  
  async notifications_send(payload: {
    title: string;
    body?: string | null;
    type: "message" | "assignment" | "birthday";
    targets: Array<{ target_user_id?: number | null; target_group_id?: number | null }>;
    reply_to_target_id?: number;
  }) {
    if (syncConfig.hasCloudflareSync) {
      await fetchJson(`${syncConfig.endpoint}?action=notifications_send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(unwrapOk);
      return { status: "sent" };
    }
    const notifs = this._get(STORAGE_KEYS.NOTIFICATIONS) || [];
    const baseNotif = {
      sender: "Coach",
      title: payload.title,
      message: payload.body || "",
      type: payload.type,
    };
    const entries = payload.targets.map((target, index) => ({
      ...baseNotif,
      id: Date.now() + index,
      read: false,
      date: new Date().toISOString(),
      sender_id: null,
      sender_email: null,
      target_user_id: target.target_user_id ?? null,
      target_group_id: target.target_group_id ?? null,
    }));
    this._save(STORAGE_KEYS.NOTIFICATIONS, [...notifs, ...entries]);
    return { status: "sent" };
  },

  async markNotificationRead(id: number) {
      const notifs = this._get(STORAGE_KEYS.NOTIFICATIONS) || [];
      const updated = notifs.map((n: any) => n.id === id ? { ...n, read: true } : n);
      this._save(STORAGE_KEYS.NOTIFICATIONS, updated);
  },

  async notifications_list(options: {
    targetUserId?: number | null;
    targetAthleteName?: string | null;
    limit?: number;
    offset?: number;
    order?: "asc" | "desc";
    status?: "read" | "unread";
    type?: "message" | "assignment" | "birthday";
    from?: string;
    to?: string;
  }): Promise<NotificationListResult> {
    const limitRaw = options.limit ?? 20;
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Number(limitRaw), 1), 200) : 20;
    const offsetRaw = options.offset ?? 0;
    const offset = Number.isFinite(offsetRaw) ? Math.max(Number(offsetRaw), 0) : 0;
    const order = options.order === "asc" ? "asc" : "desc";

    if (syncConfig.hasCloudflareSync) {
      const groupIds = await fetchUserGroupIds(options.targetUserId ?? null);
      const targets = [
        ...(options.targetUserId ? [{ type: "user" as const, id: options.targetUserId }] : []),
        ...groupIds.map((id) => ({ type: "group" as const, id })),
      ];
      if (!targets.length) {
        return { notifications: [], pagination: { limit, offset, total: 0 } };
      }
      const perTargetLimit = Math.max(limit, 50);
      const rawNotifications = (
        await Promise.all(
          targets.map(async (target) => {
            const url = new URL(syncConfig.endpoint);
            url.searchParams.set("action", "notifications_list");
            url.searchParams.set("limit", String(perTargetLimit));
            url.searchParams.set("offset", "0");
            url.searchParams.set("order", order);
            if (target.type === "user") {
              url.searchParams.set("target_user_id", String(target.id));
            } else {
              url.searchParams.set("target_group_id", String(target.id));
            }
            if (options.status) {
              url.searchParams.set("status", options.status);
            }
            if (options.type) {
              url.searchParams.set("type", options.type);
            }
            if (options.from) {
              url.searchParams.set("from", options.from);
            }
            if (options.to) {
              url.searchParams.set("to", options.to);
            }
            appendSharedToken(url);
            const payload = await fetchJson(url.toString(), {
              method: "GET",
              redirect: "follow",
              headers: {},
            });
            if (!payload || payload.ok !== true) {
              throw new Error(payload?.error || "Format inattendu");
            }
            return Array.isArray(payload?.data?.notifications) ? payload.data.notifications : [];
          }),
        )
      ).flat();
      const mapped = rawNotifications.map((notif: any) => ({
        id: safeInt(notif.id, Date.now()),
        target_id: safeOptionalInt(notif.target_id) ?? undefined,
        target_user_id: safeOptionalInt(notif.target_user_id) ?? null,
        sender_id: safeOptionalInt(notif.created_by) ?? null,
        sender_email: notif.sender_email ? String(notif.sender_email) : null,
        target_group_id: safeOptionalInt(notif.target_group_id) ?? null,
        target_group_name: notif.target_group_name ? String(notif.target_group_name) : null,
        sender_name: notif.sender_name ? String(notif.sender_name) : null,
        sender_role: notif.sender_role ? String(notif.sender_role) : null,
        counterparty_id: safeOptionalInt(notif.counterparty_id) ?? null,
        counterparty_name: notif.counterparty_name ? String(notif.counterparty_name) : null,
        counterparty_role: notif.counterparty_role ? String(notif.counterparty_role) : null,
        sender: notif.sender_name
          ? String(notif.sender_name)
          : notif.sender
            ? String(notif.sender)
            : notif.created_by
              ? "Coach"
              : "Système",
        title: String(notif.title || ""),
        message: String(notif.body || ""),
        type: String(notif.type || "message"),
        read: Boolean(notif.read_at),
        date: notif.created_at || new Date().toISOString(),
      }));
      const sorted = mapped.sort((a, b) => {
        const aDate = new Date(a.date || 0).getTime();
        const bDate = new Date(b.date || 0).getTime();
        return order === "asc" ? aDate - bDate : bDate - aDate;
      });
      const total = sorted.length;
      const paged = sorted.slice(offset, offset + limit);
      return { notifications: paged, pagination: { limit, offset, total } };
    }

    await delay(200);
    const notifs = this._get(STORAGE_KEYS.NOTIFICATIONS) || [];
    const filtered = notifs.filter((notif: any) => {
      if (options.targetUserId && notif.target_user_id !== options.targetUserId) {
        return false;
      }
      if (options.targetAthleteName) {
        const matchesName =
          notif.target_athlete === options.targetAthleteName ||
          notif.target_athlete === "All";
        if (!matchesName) return false;
      }
      if (options.type && notif.type !== options.type) return false;
      if (options.status === "read" && !notif.read) return false;
      if (options.status === "unread" && notif.read) return false;
      return true;
    });
    const sorted = filtered.sort((a: any, b: any) => {
      const aDate = new Date(a.date || a.created_at || 0).getTime();
      const bDate = new Date(b.date || b.created_at || 0).getTime();
      return order === "asc" ? aDate - bDate : bDate - aDate;
    });
    const total = sorted.length;
    const page = sorted.slice(offset, offset + limit);
    const notifications = page.map((notif: any) => ({
      id: safeInt(notif.id, Date.now()),
      target_user_id: safeOptionalInt(notif.target_user_id) ?? null,
      sender_id: safeOptionalInt(notif.sender_id) ?? null,
      sender_email: notif.sender_email ? String(notif.sender_email) : null,
      sender: String(notif.sender || "Coach"),
      title: String(notif.title || ""),
      message: String(notif.message || ""),
      type: String(notif.type || "message"),
      read: Boolean(notif.read),
      date: notif.date || new Date().toISOString(),
      related_id: notif.related_id ?? undefined,
    }));
    return { notifications, pagination: { limit, offset, total } };
  },

  async notifications_mark_read(payload: { targetId?: number; id?: number }) {
    const resolvedId = payload.targetId ?? payload.id;
    if (!resolvedId) {
      throw new Error("Missing target id");
    }
    if (syncConfig.hasCloudflareSync) {
      await fetchJson(`${syncConfig.endpoint}?action=notifications_mark_read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: resolvedId }),
      }).then(unwrapOk);
      return;
    }

    const notifs = this._get(STORAGE_KEYS.NOTIFICATIONS) || [];
    const updated = notifs.map((notif: any) => notif.id === resolvedId ? { ...notif, read: true } : notif);
    this._save(STORAGE_KEYS.NOTIFICATIONS, updated);
  },

  // --- TIMESHEETS ---
  async listTimesheetShifts(options?: { coachId?: number | null; from?: string; to?: string }): Promise<TimesheetShift[]> {
    if (syncConfig.hasCloudflareSync) {
      const url = new URL(syncConfig.endpoint);
      url.searchParams.set("action", "timesheet_list");
      if (options?.coachId) {
        url.searchParams.set("coach_id", String(options.coachId));
      }
      if (options?.from) {
        url.searchParams.set("from", options.from);
      }
      if (options?.to) {
        url.searchParams.set("to", options.to);
      }
      appendSharedToken(url);
      const payload = await fetchJson(url.toString(), {
        method: "GET",
        redirect: "follow",
        headers: {},
      }).then(unwrapOk);
      return Array.isArray(payload?.shifts) ? payload.shifts : [];
    }

    await delay(200);
    const shifts = this._get(STORAGE_KEYS.TIMESHEET_SHIFTS) || [];
    return shifts
      .filter((shift: TimesheetShift) => {
        if (options?.coachId && shift.coach_id !== options.coachId) return false;
        if (options?.from && shift.shift_date < options.from) return false;
        if (options?.to && shift.shift_date > options.to) return false;
        return true;
      })
      .sort((a: TimesheetShift, b: TimesheetShift) => {
        if (a.shift_date !== b.shift_date) {
          return a.shift_date < b.shift_date ? 1 : -1;
        }
        return a.start_time < b.start_time ? 1 : -1;
      });
  },

  async listTimesheetLocations(): Promise<TimesheetLocation[]> {
    if (syncConfig.hasCloudflareSync) {
      const url = new URL(syncConfig.endpoint);
      url.searchParams.set("action", "timesheet_locations");
      appendSharedToken(url);
      const payload = await fetchJson(url.toString(), {
        method: "GET",
        redirect: "follow",
        headers: {},
      }).then(unwrapOk);
      return Array.isArray(payload?.locations) ? payload.locations : [];
    }

    await delay(120);
    const stored = this._get(STORAGE_KEYS.TIMESHEET_LOCATIONS);
    if (Array.isArray(stored) && stored.length) {
      return stored;
    }
    const now = new Date().toISOString();
    const seeded = defaultTimesheetLocations.map((name, index) => ({
      id: index + 1,
      name,
      created_at: now,
      updated_at: now,
    }));
    this._save(STORAGE_KEYS.TIMESHEET_LOCATIONS, seeded);
    return seeded;
  },

  async createTimesheetLocation(payload: { name: string }) {
    if (syncConfig.hasCloudflareSync) {
      await fetchJson(`${syncConfig.endpoint}?action=timesheet_location_create`, {
        method: "POST",
        redirect: "follow",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(unwrapOk);
      return { status: "created" };
    }

    await delay(120);
    const trimmed = payload.name.trim();
    if (!trimmed) {
      throw new Error("Missing location name");
    }
    const stored = this._get(STORAGE_KEYS.TIMESHEET_LOCATIONS);
    const seedTimestamp = new Date().toISOString();
    const locations = Array.isArray(stored) && stored.length
      ? stored
      : defaultTimesheetLocations.map((name, index) => ({
          id: index + 1,
          name,
          created_at: seedTimestamp,
          updated_at: seedTimestamp,
        }));
    const exists = locations.some((item: TimesheetLocation) => item.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      return { status: "exists" };
    }
    const now = new Date().toISOString();
    const created = { id: Date.now(), name: trimmed, created_at: now, updated_at: now };
    this._save(STORAGE_KEYS.TIMESHEET_LOCATIONS, [...locations, created]);
    return { status: "created" };
  },

  async deleteTimesheetLocation(payload: { id: number }) {
    if (syncConfig.hasCloudflareSync) {
      await fetchJson(`${syncConfig.endpoint}?action=timesheet_location_delete`, {
        method: "POST",
        redirect: "follow",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: payload.id }),
      }).then(unwrapOk);
      return { status: "deleted" };
    }

    await delay(120);
    const locations = this._get(STORAGE_KEYS.TIMESHEET_LOCATIONS) || [];
    const updated = (locations as TimesheetLocation[]).filter((item) => item.id !== payload.id);
    this._save(STORAGE_KEYS.TIMESHEET_LOCATIONS, updated);
    return { status: "deleted" };
  },

  async listTimesheetCoaches(): Promise<{ id: number; display_name: string }[]> {
    if (syncConfig.hasCloudflareSync) {
      const url = new URL(syncConfig.endpoint);
      url.searchParams.set("action", "timesheet_coaches");
      appendSharedToken(url);
      const payload = await fetchJson(url.toString(), {
        method: "GET",
        redirect: "follow",
        headers: {},
      }).then(unwrapOk);
      return Array.isArray(payload?.coaches) ? payload.coaches : [];
    }
    return [];
  },

  async createTimesheetShift(payload: Omit<TimesheetShift, "id" | "created_at" | "updated_at" | "coach_name">) {
    if (syncConfig.hasCloudflareSync) {
      await fetchJson(`${syncConfig.endpoint}?action=timesheet_create`, {
        method: "POST",
        redirect: "follow",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(unwrapOk);
      return { status: "created" };
    }

    await delay(200);
    const shifts = this._get(STORAGE_KEYS.TIMESHEET_SHIFTS) || [];
    const created = { ...payload, id: Date.now(), created_at: new Date().toISOString() };
    this._save(STORAGE_KEYS.TIMESHEET_SHIFTS, [...shifts, created]);
    return { status: "created" };
  },

  async updateTimesheetShift(payload: Partial<TimesheetShift> & { id: number }) {
    if (syncConfig.hasCloudflareSync) {
      await fetchJson(`${syncConfig.endpoint}?action=timesheet_update`, {
        method: "POST",
        redirect: "follow",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(unwrapOk);
      return { status: "updated" };
    }

    await delay(200);
    const shifts = this._get(STORAGE_KEYS.TIMESHEET_SHIFTS) || [];
    const index = shifts.findIndex((shift: TimesheetShift) => shift.id === payload.id);
    if (index === -1) return { status: "missing" };
    const updated = [...shifts];
    updated[index] = { ...updated[index], ...payload, updated_at: new Date().toISOString() };
    this._save(STORAGE_KEYS.TIMESHEET_SHIFTS, updated);
    return { status: "updated" };
  },

  async deleteTimesheetShift(payload: { id: number }) {
    if (syncConfig.hasCloudflareSync) {
      await fetchJson(`${syncConfig.endpoint}?action=timesheet_delete`, {
        method: "POST",
        redirect: "follow",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: payload.id }),
      }).then(unwrapOk);
      return { status: "deleted" };
    }

    await delay(200);
    const shifts = this._get(STORAGE_KEYS.TIMESHEET_SHIFTS) || [];
    const updated = shifts.filter((shift: TimesheetShift) => shift.id !== payload.id);
    this._save(STORAGE_KEYS.TIMESHEET_SHIFTS, updated);
    return { status: "deleted" };
  },
  
  // --- DEMO SEED ---
  async seedDemoData() {
      // 1. Exercises
      const exercises = [
          { id: 1, nom_exercice: "Squat", description: "Flexion des jambes", exercise_type: "strength" },
          { id: 2, nom_exercice: "Développé Couché", description: "Poussée horizontale", exercise_type: "strength" },
          { id: 3, nom_exercice: "Tractions", description: "Tirage vertical", exercise_type: "strength" },
          { id: 4, nom_exercice: "Rotations Élastique", description: "Coiffe des rotateurs", exercise_type: "warmup" }
      ];
      this._save(STORAGE_KEYS.EXERCISES, exercises);

      // 2. Strength Session
      const sSession = {
          id: 101, title: "Full Body A", description: "Séance globale", cycle: "Endurance",
          items: [
             { exercise_id: 4, exercise_name: "Rotations Élastique", category: "warmup", order_index: 0, sets: 2, reps: 15, rest_seconds: 30, percent_1rm: 0 },
             { exercise_id: 1, exercise_name: "Squat", category: "strength", order_index: 1, sets: 4, reps: 10, rest_seconds: 90, percent_1rm: 70 },
             { exercise_id: 2, exercise_name: "Développé Couché", category: "strength", order_index: 2, sets: 4, reps: 10, rest_seconds: 90, percent_1rm: 70 }
          ]
      };
      this._save(STORAGE_KEYS.STRENGTH_SESSIONS, [sSession]);

      // 3. Swim Session
      const swSession = {
          id: 201,
          name: "VMA 100",
          description: "Travail de vitesse",
          created_by: 1,
          items: [
              { label: "Échauffement 4N", distance: 400, intensity: "Souple", notes: "Progressif" },
              { label: "Corps NL", distance: 1000, intensity: "Max", notes: "10x100 départ 1:30" }
          ]
      };
      this._save(STORAGE_KEYS.SWIM_SESSIONS, [swSession]);

      // 4. Assignments (Assuming user 'Camille')
      const today = new Date().toISOString().split('T')[0];
      await this.assignments_create({ session_id: 101, assignment_type: 'strength', target_athlete: 'Camille', assigned_date: today });

      return { status: "seeded" };
  },
  
  // --- PROFILE ---
  async getProfile(options: { userId?: number | null; displayName?: string | null }): Promise<UserProfile | null> {
      if (!syncConfig.endpoint) {
        return null;
      }
      const url = new URL(syncConfig.endpoint);
      url.searchParams.set("action", "users_get");
      if (options.userId) {
        url.searchParams.set("user_id", String(options.userId));
      } else if (options.displayName) {
        url.searchParams.set("display_name", options.displayName);
      }
      appendSharedToken(url);
      const payload = await fetchJson(url.toString(), {
        method: "GET",
        redirect: "follow",
        headers: {},
      }).then(unwrapOk);
      const user = payload.user ?? payload;
      if (!user) return null;
      return {
        id: user.id ?? null,
        display_name: user.display_name ?? user.displayName ?? null,
        email: user.profile_email ?? user.email ?? null,
        birthdate: user.profile_birthdate ?? user.birthdate ?? null,
        group_id: safeOptionalInt(user.group_id) ?? null,
        group_label: user.group_label ?? null,
        objectives: user.objectives ?? null,
        bio: user.bio ?? null,
        avatar_url: user.avatar_url ?? null,
        ffn_iuf: user.ffn_iuf ?? null,
      };
  },

  async updateProfile(payload: {
    userId?: number | null;
    profile: {
      group_id?: number | null;
      group_label?: string | null;
      birthdate?: string | null;
      objectives?: string | null;
      bio?: string | null;
      avatar_url?: string | null;
      ffn_iuf?: string | null;
    };
  }) {
      if (!syncConfig.endpoint) {
        return { status: "skipped" };
      }
      const url = new URL(syncConfig.endpoint);
      url.searchParams.set("action", "users_update");
      appendSharedToken(url);
      await fetchJson(url.toString(), {
        method: "POST",
        redirect: "follow",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: payload.userId ?? undefined,
          profile: payload.profile,
        }),
      }).then(unwrapOk);
      return { status: "updated" };
  },

  async getAthletes(): Promise<AthleteSummary[]> {
      if (!syncConfig.endpoint) {
        const athletes = new Map<string, AthleteSummary>();
        const addAthlete = (name?: string | null, id?: number | null) => {
          const displayName = String(name ?? "").trim();
          if (!displayName) return;
          const parsedId = id !== null && id !== undefined ? safeOptionalInt(id) : null;
          const key = parsedId !== null ? `id:${parsedId}` : `name:${displayName.toLowerCase()}`;
          if (!athletes.has(key)) {
            athletes.set(key, { id: parsedId, display_name: displayName });
          }
        };
        const sessions = this._get(STORAGE_KEYS.SESSIONS) ?? [];
        sessions.forEach((session: any) => addAthlete(session.athlete_name, session.athlete_id));
        const strengthRuns = this._get(STORAGE_KEYS.STRENGTH_RUNS) ?? [];
        strengthRuns.forEach((run: any) => addAthlete(run.athlete_name, run.athlete_id));
        const assignments = this._get(STORAGE_KEYS.ASSIGNMENTS) ?? [];
        assignments.forEach((assignment: any) => addAthlete(assignment.target_athlete, assignment.target_user_id));
        return Array.from(athletes.values()).sort((a, b) =>
          a.display_name.localeCompare(b.display_name, "fr"),
        );
      }
      const mapUsersToAthletes = (users: any[]) =>
        users
          .map((user: any) => {
            const displayName = String(user.display_name ?? user.displayName ?? "").trim();
            if (!displayName) return null;
            return {
              id: safeOptionalInt(user.id),
              display_name: displayName,
              group_label: user.group_label ?? user.groupLabel ?? null,
            } as AthleteSummary;
          })
          .filter(Boolean) as AthleteSummary[];
      const url = new URL(syncConfig.endpoint);
      url.searchParams.set("action", "groups_get");
      appendSharedToken(url);
      const payload = await fetchJson(url.toString(), {
        method: "GET",
        redirect: "follow",
        headers: {},
      }).then(unwrapOk);
      const groups = Array.isArray(payload?.groups) ? payload.groups : [];
      if (!groups.length) {
        const listUrl = new URL(syncConfig.endpoint);
        listUrl.searchParams.set("action", "users_list");
        listUrl.searchParams.set("role", "athlete");
        appendSharedToken(listUrl);
        const usersPayload = await fetchJson(listUrl.toString(), {
          method: "GET",
          redirect: "follow",
          headers: {},
        }).then(unwrapOk);
        const users = Array.isArray(usersPayload?.users) ? usersPayload.users : [];
        return mapUsersToAthletes(users).sort((a, b) =>
          a.display_name.localeCompare(b.display_name, "fr"),
        );
      }
      const athleteMap = new Map<string, AthleteSummary>();
      await Promise.all(
        groups.map(async (group: any) => {
          const groupUrl = new URL(syncConfig.endpoint);
          groupUrl.searchParams.set("action", "groups_get");
          groupUrl.searchParams.set("group_id", String(group.id));
          appendSharedToken(groupUrl);
          const groupPayload = await fetchJson(groupUrl.toString(), {
            method: "GET",
            redirect: "follow",
            headers: {},
          }).then(unwrapOk);
          const members = Array.isArray(groupPayload?.members) ? groupPayload.members : [];
          members.forEach((member: any) => {
            if (member.role && member.role !== "athlete") return;
            const displayName = String(member.display_name ?? member.displayName ?? "").trim();
            if (!displayName) return;
            const memberId = safeOptionalInt(member.user_id ?? member.userId ?? member.id);
            const key = memberId !== null ? `id:${memberId}` : `name:${displayName.toLowerCase()}`;
            if (athleteMap.has(key)) return;
            athleteMap.set(key, {
              id: memberId,
              display_name: displayName,
              group_label: group.name ?? null,
            });
          });
        }),
      );
      return Array.from(athleteMap.values()).sort((a, b) =>
        a.display_name.localeCompare(b.display_name, "fr"),
      );
  },

  async getGroups(): Promise<GroupSummary[]> {
      if (!syncConfig.endpoint) {
        return [];
      }
      const url = new URL(syncConfig.endpoint);
      url.pathname = "/api/groups";
      url.search = "";
      const payload = await fetchJson(url.toString(), {
        method: "GET",
        redirect: "follow",
        headers: {},
      }).then(unwrapOk);
      const groups = Array.isArray(payload?.groups) ? payload.groups : [];
      return groups
        .map((group: any) => ({
          id: safeInt(group.id, 0),
          name: String(group.name ?? group.label ?? group.title ?? `Groupe ${group.id ?? ""}`).trim(),
          member_count: safeOptionalInt(group.member_count ?? group.members_count ?? group.membersCount),
        }))
        .filter((group: GroupSummary) => group.id > 0 && group.name);
  },

  async getUpcomingBirthdays(options?: { days?: number }): Promise<UpcomingBirthday[]> {
      if (!syncConfig.endpoint) {
        return [];
      }
      const url = new URL(syncConfig.endpoint);
      url.searchParams.set("action", "birthdays_upcoming");
      if (options?.days) {
        url.searchParams.set("days", String(options.days));
      }
      appendSharedToken(url);
      const payload = await fetchJson(url.toString(), {
        method: "GET",
        redirect: "follow",
        headers: {},
      }).then(unwrapOk);
      return Array.isArray(payload?.birthdays) ? payload.birthdays : [];
  },

  async listUsers(options?: {
    role?: "athlete" | "coach" | "comite" | "admin";
    includeInactive?: boolean;
  }): Promise<UserSummary[]> {
      if (!syncConfig.endpoint) {
        return [];
      }
      const roles = options?.role ? [options.role] : (["athlete", "coach", "comite", "admin"] as const);
      const responses = await Promise.all(
        roles.map(async (selectedRole) => {
          const url = new URL(syncConfig.endpoint);
          url.searchParams.set("action", "users_list");
          url.searchParams.set("role", selectedRole);
          if (options?.includeInactive) {
            url.searchParams.set("include_inactive", "1");
          }
          appendSharedToken(url);
          const payload = await fetchJson(url.toString(), {
            method: "GET",
            redirect: "follow",
            headers: {},
          }).then(unwrapOk);
          return Array.isArray(payload?.users) ? payload.users : [];
        }),
      );
      const combined = responses.flat();
      const userMap = new Map<number, UserSummary>();
      combined.forEach((user: any) => {
        const id = safeOptionalInt(user.id);
        if (id === null) return;
        const displayName = String(user.display_name ?? user.displayName ?? "").trim();
        if (!displayName) return;
        userMap.set(id, {
          id,
          display_name: displayName,
          role: String(user.role ?? ""),
          email: user.email ?? null,
          is_active: user.is_active ?? null,
          group_label: user.group_label ?? user.groupLabel ?? null,
        });
      });
      return Array.from(userMap.values()).sort((a, b) =>
        a.display_name.localeCompare(b.display_name, "fr"),
      );
  },

  async createCoach(payload: { display_name: string; email?: string | null; password?: string | null }) {
      if (!syncConfig.endpoint) {
        return { status: "skipped", user: null, initialPassword: null };
      }
      const url = new URL(syncConfig.endpoint);
      url.searchParams.set("action", "users_create");
      appendSharedToken(url);
      const response = await fetchJson(url.toString(), {
        method: "POST",
        redirect: "follow",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: payload.display_name,
          role: "coach",
          email: payload.email ?? undefined,
          password: payload.password ?? undefined,
        }),
      }).then(unwrapOk);
      return {
        status: "created",
        user: response?.user ?? null,
        initialPassword: response?.initial_password ?? null,
      };
  },

  async updateUserRole(payload: { userId: number; role: "athlete" | "coach" | "comite" | "admin" }) {
      if (!syncConfig.endpoint) {
        return { status: "skipped" };
      }
      const url = new URL(syncConfig.endpoint);
      url.searchParams.set("action", "users_update");
      appendSharedToken(url);
      await fetchJson(url.toString(), {
        method: "POST",
        redirect: "follow",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: payload.userId,
          role: payload.role,
        }),
      }).then(unwrapOk);
      return { status: "updated" };
  },

  async disableUser(payload: { userId: number }) {
      if (!syncConfig.endpoint) {
        return { status: "skipped" };
      }
      const url = new URL(syncConfig.endpoint);
      url.searchParams.set("action", "users_delete");
      appendSharedToken(url);
      await fetchJson(url.toString(), {
        method: "POST",
        redirect: "follow",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: payload.userId,
        }),
      }).then(unwrapOk);
      return { status: "disabled" };
  },

  async authPasswordUpdate(payload: { userId?: number | null; password: string }) {
      if (!syncConfig.endpoint) {
        return { status: "skipped" };
      }
      const url = new URL(syncConfig.endpoint);
      url.searchParams.set("action", "auth_password_update");
      appendSharedToken(url);
      await fetchJson(url.toString(), {
        method: "POST",
        redirect: "follow",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: payload.userId ?? undefined,
          password: payload.password,
        }),
      }).then(unwrapOk);
      return { status: "updated" };
  },

  // --- LOCAL STORAGE UTILS ---
  _get(key: string) {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  },

  _save(key: string, data: any) {
    localStorage.setItem(key, JSON.stringify(data));
  },

  resetCache() {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
    window.location.reload();
  }
};
