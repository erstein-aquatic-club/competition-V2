import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "./supabase";
import { useAuth } from "./auth";

// --- Types (re-exported from api/types.ts for backward compatibility) ---
export type {
  Session,
  Exercise,
  StrengthCycleType,
  StrengthSessionTemplate,
  StrengthSessionItem,
  SwimSessionTemplate,
  SwimSessionItem,
  Assignment,
  Notification,
  UserProfile,
  AthleteSummary,
  GroupSummary,
  UpcomingBirthday,
  UserSummary,
  SwimRecord,
  ClubRecord,
  ClubRecordSwimmer,
  TimesheetShift,
  TimesheetLocation,
  FeatureCapability,
  ApiCapabilities,
  ApiErrorInfo,
  SyncSessionInput,
  StrengthRunPayload,
  StrengthSetPayload,
  SwimmerPerformance,
} from "./api/types";

import type {
  Session,
  Exercise,
  StrengthCycleType,
  StrengthSessionTemplate,
  StrengthSessionItem,
  SwimSessionTemplate,
  SwimSessionItem,
  Assignment,
  Notification,
  UserProfile,
  AthleteSummary,
  GroupSummary,
  UpcomingBirthday,
  UserSummary,
  SwimRecord,
  ClubRecord,
  ClubRecordSwimmer,
  TimesheetShift,
  TimesheetLocation,
  ApiCapabilities,
  ApiErrorInfo,
  SwimmerPerformance,
} from "./api/types";

// --- Utilities (imported from api/client.ts) ---
import {
  canUseSupabase,
  STORAGE_KEYS,
  safeInt,
  safeOptionalInt,
  normalizeScaleToFive,
  expandScaleToTen,
  estimateOneRm,
  normalizeCycleType,
  normalizeStrengthItem,
  mapDbExerciseToApi,
  mapApiExerciseToDb,
  delay,
  parseRawPayload,
  fetchUserGroupIds,
  normalizeExerciseType,
} from "./api/client";

// --- Helpers (imported from api/helpers.ts) ---
import {
  normalizeExercise,
  mapToDbSession,
  mapFromDbSession,
  type Pagination,
  type NotificationListResult,
  type StrengthExerciseSummary,
  type StrengthHistoryResult,
  type StrengthHistoryAggregateEntry,
  type StrengthHistoryAggregateResult,
  type SyncSessionInputWithId,
} from "./api/helpers";

// --- Transformers (imported from api/transformers.ts) ---
import {
  prepareStrengthItemsPayload,
  mapItemsForDbInsert,
  createLocalStrengthRun,
  createSetLogDbPayload,
  buildRunUpdatePayload,
  collectEstimated1RMs,
  enrichItemsWithExerciseNames,
  mapLogsForDbInsert,
} from "./api/transformers";

// Re-export error utilities for backward compatibility
export { parseApiError, summarizeApiError } from "./api/client";

const defaultTimesheetLocations = ["Piscine", "Compétition"];

// --- API Service ---

export const api = {
  async getCapabilities(): Promise<ApiCapabilities> {
    if (!canUseSupabase()) {
      return {
        mode: "local",
        version: null,
        timesheet: { available: true },
        messaging: { available: true },
      };
    }
    return {
      mode: "supabase",
      version: null,
      timesheet: { available: true },
      messaging: { available: true },
    };
  },

  async syncFfnSwimRecords(params: { athleteId?: number; athleteName?: string; iuf: string }) {
    if (!canUseSupabase()) {
      throw new Error("Supabase not configured");
    }
    const { data, error } = await supabase.functions.invoke("ffn-sync", {
      body: {
        athlete_id: params.athleteId ?? null,
        athlete_name: params.athleteName ?? null,
        iuf: params.iuf,
      },
    });
    if (error) throw new Error(error.message);
    return (data ?? { inserted: 0, updated: 0, skipped: 0 }) as { inserted: number; updated: number; skipped: number };
  },

  async importSwimmerPerformances(params: { iuf: string; userId?: number }): Promise<{ total_found: number; new_imported: number; already_existed: number }> {
    if (!canUseSupabase()) throw new Error("Supabase not configured");
    const { data, error } = await supabase.functions.invoke("ffn-performances", {
      body: { swimmer_iuf: params.iuf, user_id: params.userId ?? null },
    });
    if (error) throw new Error(error.message);
    return (data ?? { total_found: 0, new_imported: 0, already_existed: 0 }) as { total_found: number; new_imported: number; already_existed: number };
  },

  async getSwimmerPerformances(filters: {
    userId?: number;
    iuf?: string;
    eventCode?: string;
    poolLength?: number;
    fromDate?: string;
    toDate?: string;
    limit?: number;
  }): Promise<SwimmerPerformance[]> {
    if (!canUseSupabase()) return [];
    let query = supabase.from("swimmer_performances").select("*").order("competition_date", { ascending: false });
    if (filters.userId) query = query.eq("user_id", filters.userId);
    if (filters.iuf) query = query.eq("swimmer_iuf", filters.iuf);
    if (filters.eventCode) query = query.eq("event_code", filters.eventCode);
    if (filters.poolLength) query = query.eq("pool_length", filters.poolLength);
    if (filters.fromDate) query = query.gte("competition_date", filters.fromDate);
    if (filters.toDate) query = query.lte("competition_date", filters.toDate);
    if (filters.limit) query = query.limit(filters.limit);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  // --- SWIM SESSIONS ---
  async syncSession(session: SyncSessionInputWithId): Promise<{ status: string }> {
    if (canUseSupabase()) {
      const dbPayload = mapToDbSession(session);
      const { error } = await supabase.from("dim_sessions").insert(dbPayload);
      if (error) throw new Error(error.message);
      return { status: "ok" };
    }

    await delay(300);
    const sessions = this._get(STORAGE_KEYS.SESSIONS) || [];
    const newSession = { ...session, id: Date.now(), created_at: new Date().toISOString() };
    this._save(STORAGE_KEYS.SESSIONS, [...sessions, newSession]);
    return { status: "ok" };
  },

  async getSessions(athleteName: string, athleteId?: number | string | null): Promise<Session[]> {
    const hasAthleteId = athleteId !== null && athleteId !== undefined && String(athleteId) !== "";
    if (canUseSupabase()) {
      let query = supabase.from("dim_sessions").select("*").order("session_date", { ascending: false });
      if (hasAthleteId) {
        query = query.eq("athlete_id", Number(athleteId));
      } else {
        query = query.eq("athlete_name", athleteName);
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? [])
        .map(mapFromDbSession)
        .filter((session): session is Session => Boolean(session));
    }

    await delay(200);
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
    if (canUseSupabase()) {
      const dbPayload: Record<string, unknown> = {
        athlete_name: session.athlete_name,
        session_date: session.date,
        time_slot: session.slot,
        distance: session.distance,
        duration: session.duration,
        rpe: expandScaleToTen(session.effort),
        performance: expandScaleToTen(session.performance ?? session.feeling),
        engagement: expandScaleToTen(session.engagement ?? session.feeling),
        fatigue: expandScaleToTen(session.feeling),
        comments: session.comments,
      };
      const { error } = await supabase.from("dim_sessions").update(dbPayload).eq("id", session.id);
      if (error) throw new Error(error.message);
      return { status: "updated" };
    }

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
    if (canUseSupabase()) {
      const { error } = await supabase.from("dim_sessions").delete().eq("id", sessionId);
      if (error) throw new Error(error.message);
      return { status: "deleted" };
    }

    await delay(200);
    const sessions = this._get(STORAGE_KEYS.SESSIONS) || [];
    const updatedSessions = sessions.filter((session: Session) => session.id !== sessionId);
    this._save(STORAGE_KEYS.SESSIONS, updatedSessions);
    return { status: "deleted" };
  },

  async getHallOfFame() {
    if (canUseSupabase()) {
      const { data: rpcData, error: rpcError } = await supabase.rpc("get_hall_of_fame");
      if (!rpcError && rpcData) {
        const hallOfFame = Array.isArray(rpcData) ? rpcData : [];
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
        return {
          distance: swimDistance,
          performance: swimPerformance,
          engagement: swimEngagement,
          strength: [] as any[],
        };
      }
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
    if (!canUseSupabase()) return [];
    let query = supabase.from("club_records").select("*");
    if (filters.pool_m) query = query.eq("pool_m", filters.pool_m);
    if (filters.sex) query = query.eq("sex", filters.sex);
    if (filters.age) query = query.eq("age", filters.age);
    if (filters.event_code) query = query.eq("event_code", filters.event_code);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async getClubRecordSwimmers(): Promise<ClubRecordSwimmer[]> {
    if (!canUseSupabase()) return [];
    const { data, error } = await supabase.from("club_record_swimmers").select("*");
    if (error) throw new Error(error.message);
    return (data ?? []).map((s: any) => ({ ...s, is_active: s.is_active ? 1 : 0 }));
  },

  async createClubRecordSwimmer(payload: {
    display_name: string;
    iuf?: string | null;
    sex?: "M" | "F" | null;
    birthdate?: string | null;
    is_active?: boolean;
  }): Promise<ClubRecordSwimmer | null> {
    if (!canUseSupabase()) return null;
    const { data, error } = await supabase.from("club_record_swimmers").insert({
      source_type: "manual",
      display_name: payload.display_name,
      iuf: payload.iuf ?? null,
      sex: payload.sex ?? null,
      birthdate: payload.birthdate ?? null,
      is_active: payload.is_active !== false,
    }).select().single();
    if (error) throw new Error(error.message);
    return data ? { ...data, is_active: data.is_active ? 1 : 0 } : null;
  },

  async updateClubRecordSwimmer(
    id: number,
    payload: { iuf?: string | null; is_active?: boolean; sex?: "M" | "F" | null; birthdate?: string | null },
  ): Promise<ClubRecordSwimmer | null> {
    if (!canUseSupabase()) return null;
    const updatePayload: Record<string, unknown> = {};
    if (payload.iuf !== undefined) updatePayload.iuf = payload.iuf;
    if (payload.is_active !== undefined) updatePayload.is_active = payload.is_active;
    if (payload.sex !== undefined) updatePayload.sex = payload.sex;
    if (payload.birthdate !== undefined) updatePayload.birthdate = payload.birthdate;
    const { data, error } = await supabase.from("club_record_swimmers").update(updatePayload).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return data ? { ...data, is_active: data.is_active ? 1 : 0 } : null;
  },

  async updateClubRecordSwimmerForUser(
    userId: number,
    payload: { iuf?: string | null; is_active?: boolean; sex?: "M" | "F" | null; birthdate?: string | null },
  ): Promise<ClubRecordSwimmer | null> {
    if (!canUseSupabase()) return null;
    const updatePayload: Record<string, unknown> = {};
    if (payload.iuf !== undefined) updatePayload.iuf = payload.iuf;
    if (payload.is_active !== undefined) updatePayload.is_active = payload.is_active;
    if (payload.sex !== undefined) updatePayload.sex = payload.sex;
    if (payload.birthdate !== undefined) updatePayload.birthdate = payload.birthdate;
    const { data, error } = await supabase.from("club_record_swimmers").update(updatePayload).eq("user_id", userId).eq("source_type", "user").select().single();
    if (error) throw new Error(error.message);
    return data ? { ...data, is_active: data.is_active ? 1 : 0 } : null;
  },

  async importClubRecords(): Promise<any> {
    if (!canUseSupabase()) return null;
    const { data, error } = await supabase.functions.invoke("import-club-records");
    if (error) throw new Error(error.message);
    return data?.summary ?? data;
  },

  async getImportLogs(filters?: { swimmerIuf?: string; limit?: number }): Promise<any[]> {
    if (!canUseSupabase()) return [];
    let query = supabase.from("import_logs").select("*").order("started_at", { ascending: false });
    if (filters?.swimmerIuf) query = query.eq("swimmer_iuf", filters.swimmerIuf);
    if (filters?.limit) query = query.limit(filters.limit);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async importSingleSwimmer(swimmerIuf: string, swimmerName?: string): Promise<{ total_found: number; new_imported: number; already_existed: number }> {
    if (!canUseSupabase()) throw new Error("Supabase not configured");
    const { data, error } = await supabase.functions.invoke("ffn-performances", {
      body: { swimmer_iuf: swimmerIuf },
    });
    if (error) throw new Error(error.message);
    return (data ?? { total_found: 0, new_imported: 0, already_existed: 0 }) as { total_found: number; new_imported: number; already_existed: number };
  },

  // --- STRENGTH ---
  async getExercises(): Promise<Exercise[]> {
      if (canUseSupabase()) {
        const { data, error } = await supabase.from("dim_exercices").select("*");
        if (error) throw new Error(error.message);
        return (data ?? []).map(mapDbExerciseToApi);
      }
      const exercises = this._get(STORAGE_KEYS.EXERCISES) || [];
      const list = Array.isArray(exercises) ? exercises : [];
      return list.map((exercise: any) => normalizeExercise(exercise));
  },

  async createExercise(exercise: Omit<Exercise, "id">) {
      const exercise_type = normalizeExerciseType(exercise.exercise_type);

      if (canUseSupabase()) {
        const dbRow = mapApiExerciseToDb({ ...exercise, exercise_type });
        const { error } = await supabase.from("dim_exercices").insert(dbRow);
        if (error) throw new Error(error.message);
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
      const exercise_type = normalizeExerciseType(exercise.exercise_type);

      if (canUseSupabase()) {
        const dbRow = mapApiExerciseToDb({ ...exercise, exercise_type });
        const { error } = await supabase.from("dim_exercices").update(dbRow).eq("id", exercise.id);
        if (error) throw new Error(error.message);
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
      if (canUseSupabase()) {
        const { error } = await supabase.from("dim_exercices").delete().eq("id", exerciseId);
        if (error) throw new Error(error.message);
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
      if (canUseSupabase()) {
        const { data: sessions, error } = await supabase
          .from("strength_sessions")
          .select("*, strength_session_items(*, dim_exercices(nom_exercice, exercise_type))")
          .order("created_at", { ascending: false });
        if (error) throw new Error(error.message);
        return (sessions ?? []).map((session: any) => {
          const rawItems = Array.isArray(session.strength_session_items) ? session.strength_session_items : [];
          const cycle = normalizeCycleType(rawItems[0]?.cycle_type);
          return {
            id: safeInt(session.id, Date.now()),
            title: String(session.name || ""),
            description: session.description ?? "",
            cycle,
            items: rawItems
              .sort((a: any, b: any) => (a.ordre ?? 0) - (b.ordre ?? 0))
              .map((item: any, index: number) => ({
                ...normalizeStrengthItem(item, index, cycle),
                exercise_name: item.dim_exercices?.nom_exercice ?? undefined,
                category: item.dim_exercices?.exercise_type ?? undefined,
              })),
          };
        });
      }
      return this._get(STORAGE_KEYS.STRENGTH_SESSIONS) || [];
  },

  async createStrengthSession(session: any) {
       const { cycle, normalizedItems, itemsPayload } = prepareStrengthItemsPayload(session);

       if (canUseSupabase()) {
         const { data: created, error } = await supabase.from("strength_sessions").insert({
           name: session?.title ?? session?.name ?? "",
           description: session?.description ?? "",
         }).select("id").single();
         if (error) throw new Error(error.message);
         const sessionId = created.id;
         if (itemsPayload.length > 0) {
           const { error: itemsError } = await supabase.from("strength_session_items").insert(
             mapItemsForDbInsert(itemsPayload, sessionId, cycle),
           );
           if (itemsError) throw new Error(itemsError.message);
         }
         return { status: "created", id: sessionId };
       }

       const s = this._get(STORAGE_KEYS.STRENGTH_SESSIONS) || [];
       const id = Date.now();
       const enrichedItems = enrichItemsWithExerciseNames(normalizedItems, this._get(STORAGE_KEYS.EXERCISES) || []);
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
       const { cycle, normalizedItems, itemsPayload } = prepareStrengthItemsPayload(session);

       if (canUseSupabase()) {
         const { error } = await supabase.from("strength_sessions").update({
           name: session?.title ?? session?.name ?? "",
           description: session?.description ?? "",
         }).eq("id", session.id);
         if (error) throw new Error(error.message);
         // Replace items: delete old, insert new
         await supabase.from("strength_session_items").delete().eq("session_id", session.id);
         if (itemsPayload.length > 0) {
           const { error: itemsError } = await supabase.from("strength_session_items").insert(
             mapItemsForDbInsert(itemsPayload, session.id, cycle),
           );
           if (itemsError) throw new Error(itemsError.message);
         }
         return { status: "updated" };
       }

       const sessions = this._get(STORAGE_KEYS.STRENGTH_SESSIONS) || [];
       const index = sessions.findIndex((item: StrengthSessionTemplate) => item.id === session.id);
       if (index === -1) {
         throw new Error("Séance introuvable");
       }
       const enrichedItems = enrichItemsWithExerciseNames(normalizedItems, this._get(STORAGE_KEYS.EXERCISES) || []);
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
       // Delegates to updateStrengthSession which handles both Supabase and local
       return this.updateStrengthSession(session);
  },

  async deleteStrengthSession(sessionId: number) {
      if (canUseSupabase()) {
        const { error } = await supabase.from("strength_sessions").delete().eq("id", sessionId);
        if (error) throw new Error(error.message);
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
      if (canUseSupabase()) {
        const { data: run, error } = await supabase.from("strength_session_runs").insert({
          assignment_id: data.assignment_id ?? null,
          athlete_id: data.athlete_id ?? null,
          status: "in_progress",
          progress_pct: data.progress_pct ?? 0,
          started_at: new Date().toISOString(),
        }).select("id").single();
        if (error) throw new Error(error.message);
        if (data.assignment_id) {
          await supabase.from("session_assignments").update({ status: "in_progress" }).eq("id", data.assignment_id);
        }
        return { run_id: run.id };
      }
      const runs = this._get(STORAGE_KEYS.STRENGTH_RUNS) || [];
      const run_id = Date.now();
      const newRun = createLocalStrengthRun(data, run_id);
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
        if (canUseSupabase() && (athleteId === null || athleteId === undefined || athleteId === "")) {
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

      if (canUseSupabase()) {
        const { error } = await supabase.from("strength_set_logs").insert(
          createSetLogDbPayload(payload),
        );
        if (error) throw new Error(error.message);
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
      if (canUseSupabase()) {
        const updatePayload = buildRunUpdatePayload(update);
        const { error } = await supabase.from("strength_session_runs").update(updatePayload).eq("id", update.run_id);
        if (error) throw new Error(error.message);
        if (update.status === "completed" && update.assignment_id) {
          await supabase.from("session_assignments").update({ status: "completed" }).eq("id", update.assignment_id);
        }
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
      if (canUseSupabase()) {
        const { error } = await supabase.from("strength_session_runs").delete().eq("id", runId);
        if (error) throw new Error(error.message);
        return { status: "deleted", source: "remote" as const };
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
      return { status: "deleted", source: "local" as const };
  },

  async saveStrengthRun(run: any) {
      if (canUseSupabase()) {
        let runId = run.run_id;
        // Step 1: Create run if needed
        if (!runId) {
          const { data: newRun, error } = await supabase.from("strength_session_runs").insert({
            assignment_id: run.assignment_id ?? null,
            athlete_id: run.athlete_id ?? null,
            status: "in_progress",
            progress_pct: run.progress_pct ?? 0,
            started_at: new Date().toISOString(),
          }).select("id").single();
          if (error) throw new Error(error.message);
          runId = newRun.id;
        }

        // Step 2: Insert all set logs
        if (runId && Array.isArray(run.logs) && run.logs.length > 0) {
          const { error: logsError } = await supabase.from("strength_set_logs").insert(
            mapLogsForDbInsert(run.logs, runId),
          );
          if (logsError) throw new Error(logsError.message);
        }

        // Step 3: Calculate 1RM estimates and upsert records
        const estimatedRecords = collectEstimated1RMs(Array.isArray(run.logs) ? run.logs : []);
        if (estimatedRecords.size > 0) {
          const athleteId = run.athlete_id ?? null;
          const athleteName = run.athlete_name ?? null;
          if (athleteId !== null && athleteId !== undefined && athleteId !== "") {
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

        // Step 4: Mark run as completed
        if (runId) {
          await supabase.from("strength_session_runs").update({
            progress_pct: run.progress_pct ?? 100,
            status: "completed",
            completed_at: new Date().toISOString(),
          }).eq("id", runId);
        }

        // Step 5: Mark assignment completed if applicable
        if (run.assignment_id) {
          await supabase.from("session_assignments").update({ status: "completed" }).eq("id", run.assignment_id);
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
      const estimatedRecords = collectEstimated1RMs(Array.isArray(run.logs) ? run.logs : []);
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

    if (canUseSupabase()) {
      let query = supabase.from("strength_session_runs")
        .select("*, strength_set_logs(*)")
        .order("started_at", { ascending: order === "asc" })
        .range(offset, offset + limit - 1);
      if (hasAthleteId) {
        query = query.eq("athlete_id", Number(athleteId));
      }
      if (options?.status) {
        query = query.eq("status", options.status);
      }
      if (options?.from) {
        query = query.gte("started_at", options.from);
      }
      if (options?.to) {
        query = query.lte("started_at", options.to + "T23:59:59");
      }
      const { data: runs, error, count } = await query;
      if (error) throw new Error(error.message);
      return { runs: runs ?? [], pagination: { limit, offset, total: count ?? (runs ?? []).length }, exercise_summary: [] };
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

    if (canUseSupabase()) {
      const rpcParams: Record<string, unknown> = { p_period: period };
      if (hasAthleteId) rpcParams.p_athlete_id = Number(athleteId);
      if (options?.from) rpcParams.p_from = options.from;
      if (options?.to) rpcParams.p_to = options.to;
      const { data: rpcData, error: rpcError } = await supabase.rpc("get_strength_history_aggregate", rpcParams);
      if (rpcError) throw new Error(rpcError.message);
      const periods = Array.isArray(rpcData) ? rpcData : [];
      return { periods, pagination: { limit, offset, total: periods.length } };
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
      if (canUseSupabase()) {
        let query = supabase.from("one_rm_records").select("*");
        if (athleteId !== null && athleteId !== undefined && String(athleteId) !== "") {
          query = query.eq("athlete_id", Number(athleteId));
        }
        const { data, error } = await query;
        if (error) throw new Error(error.message);
        return (data ?? []).map((record: any) => ({
          id: safeOptionalInt(record.id),
          athlete_id: safeOptionalInt(record.athlete_id),
          exercise_id: safeInt(record.exercise_id),
          weight: Number(record.one_rm ?? 0),
          recorded_at: record.recorded_at ?? null,
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
      if (canUseSupabase()) {
        const athleteId = record.athlete_id ?? record.athleteId;
        const oneRm = record.one_rm ?? record.weight;
        if (athleteId === null || athleteId === undefined || athleteId === "" || oneRm === null || oneRm === undefined) {
          throw new Error("athlete_id et one_rm sont requis");
        }
        const { error } = await supabase.from("one_rm_records").upsert({
          athlete_id: Number(athleteId),
          exercise_id: record.exercise_id,
          one_rm: oneRm,
          recorded_at: new Date().toISOString(),
        }, { onConflict: "athlete_id,exercise_id" });
        if (error) throw new Error(error.message);
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
      if (canUseSupabase()) {
        let query = supabase.from("swim_records").select("*").order("record_date", { ascending: false });
        if (options.athleteId) {
          query = query.eq("athlete_id", options.athleteId);
        }
        const { data, error } = await query;
        if (error) throw new Error(error.message);
        const records = data ?? [];
        return {
          records,
          pagination: { limit: records.length, offset: 0, total: records.length },
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
      if (canUseSupabase()) {
        const dbPayload: Record<string, unknown> = {
          athlete_id: payload.athlete_id ?? null,
          event_name: payload.event_name,
          pool_length: payload.pool_length ?? null,
          time_seconds: payload.time_seconds ?? null,
          record_date: payload.record_date ?? null,
          notes: payload.notes ?? null,
        };
        if (payload.id) {
          const { error } = await supabase.from("swim_records").update(dbPayload).eq("id", payload.id);
          if (error) throw new Error(error.message);
        } else {
          const { error } = await supabase.from("swim_records").insert(dbPayload);
          if (error) throw new Error(error.message);
        }
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
      if (canUseSupabase()) {
        const { data: catalogs, error } = await supabase
          .from("swim_sessions_catalog")
          .select("*, swim_session_items(*)")
          .order("created_at", { ascending: false });
        if (error) throw new Error(error.message);
        return (catalogs ?? []).map((catalog: any) => ({
          id: safeInt(catalog.id, Date.now()),
          name: String(catalog.name || ""),
          description: catalog.description ?? null,
          created_by: safeOptionalInt(catalog.created_by) ?? null,
          created_at: catalog.created_at ?? null,
          updated_at: catalog.updated_at ?? null,
          items: Array.isArray(catalog.swim_session_items)
            ? catalog.swim_session_items
                .sort((a: any, b: any) => (a.ordre ?? 0) - (b.ordre ?? 0))
                .map((item: any, index: number) => ({
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
      if (canUseSupabase()) {
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
        if (session.id) {
          // Update existing
          const { error } = await supabase.from("swim_sessions_catalog").update({
            name: session.name,
            description: session.description ?? null,
          }).eq("id", session.id);
          if (error) throw new Error(error.message);
          await supabase.from("swim_session_items").delete().eq("catalog_id", session.id);
          if (items.length > 0) {
            const { error: itemsError } = await supabase.from("swim_session_items").insert(
              items.map((item: any) => ({ ...item, catalog_id: session.id })),
            );
            if (itemsError) throw new Error(itemsError.message);
          }
          return { status: "updated" };
        }
        // Create new
        const { data: created, error } = await supabase.from("swim_sessions_catalog").insert({
          name: session.name,
          description: session.description ?? null,
        }).select("id").single();
        if (error) throw new Error(error.message);
        if (items.length > 0) {
          const { error: itemsError } = await supabase.from("swim_session_items").insert(
            items.map((item: any) => ({ ...item, catalog_id: created.id })),
          );
          if (itemsError) throw new Error(itemsError.message);
        }
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
      if (canUseSupabase()) {
        const { error } = await supabase.from("swim_sessions_catalog").delete().eq("id", sessionId);
        if (error) throw new Error(error.message);
        return { status: "deleted" };
      }
      const sessions = this._get(STORAGE_KEYS.SWIM_SESSIONS) || [];
      const updatedSessions = sessions.filter((session: SwimSessionTemplate) => session.id !== sessionId);
      this._save(STORAGE_KEYS.SWIM_SESSIONS, updatedSessions);
      return { status: "deleted" };
  },

  async getAssignmentsForCoach(): Promise<Assignment[] | null> {
      if (canUseSupabase()) {
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
      if (canUseSupabase()) {
        const groupIds = await fetchUserGroupIds(athleteId ?? null);
        const orFilters: string[] = [];
        if (athleteId !== null && athleteId !== undefined) {
          orFilters.push(`target_user_id.eq.${athleteId}`);
        }
        groupIds.forEach((gid) => orFilters.push(`target_group_id.eq.${gid}`));
        if (!orFilters.length) return [];

        let query = supabase.from("session_assignments").select("*").or(orFilters.join(","));
        if (options?.assignmentType) {
          query = query.eq("assignment_type", options.assignmentType);
        }
        if (options?.status) {
          query = query.eq("status", options.status);
        } else {
          query = query.neq("status", "completed");
        }
        const { data: rawAssignments, error } = await query;
        if (error) throw new Error(error.message);
        if (!rawAssignments?.length) return [];

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
            const scheduledDate = assignment.scheduled_date || assignment.created_at || "";
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
              assigned_slot: assignment.scheduled_slot ?? null,
              status,
              items: strengthSession?.items ?? swimSession?.items,
            } as Assignment & { cycle?: string; assigned_slot?: string | null };
            if (sessionType === "strength") {
              base.cycle = strengthSession?.cycle ?? "endurance";
            }
            return base;
          });
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
    scheduled_slot?: "morning" | "evening";
  }) {
      const assignmentType = data.assignment_type ?? data.session_type;
      if (!assignmentType) return { status: "error" };
      const scheduledDate = data.scheduled_date ?? data.assigned_date ?? new Date().toISOString();
      if (canUseSupabase()) {
        // Read the caller's app user ID to record who created the assignment
        const callerUserId = useAuth.getState().userId;
        const insertPayload: Record<string, unknown> = {
          assignment_type: assignmentType,
          scheduled_date: scheduledDate,
          scheduled_slot: data.scheduled_slot ?? null,
          assigned_by: callerUserId ?? null,
          status: "assigned",
        };
        if (assignmentType === "swim") {
          insertPayload.swim_catalog_id = data.session_id;
        } else {
          insertPayload.strength_session_id = data.session_id;
        }
        if (data.target_user_id !== null && data.target_user_id !== undefined) {
          insertPayload.target_user_id = data.target_user_id;
        } else if (data.target_group_id !== null && data.target_group_id !== undefined) {
          insertPayload.target_group_id = data.target_group_id;
        }
        const { data: created, error } = await supabase.from("session_assignments").insert(insertPayload).select("id").single();
        if (error) throw new Error(error.message);
        // Create notification
        const { data: notif, error: notifError } = await supabase.from("notifications").insert({
          title: "Nouvelle séance assignée",
          body: `Séance prévue le ${scheduledDate}.`,
          type: "assignment",
        }).select("id").single();
        if (!notifError && notif) {
          const targetPayload: Record<string, unknown> = { notification_id: notif.id };
          if (data.target_user_id) targetPayload.target_user_id = data.target_user_id;
          if (data.target_group_id) targetPayload.target_group_id = data.target_group_id;
          await supabase.from("notification_targets").insert(targetPayload);
        }
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
      if (canUseSupabase()) {
        const { error } = await supabase.from("session_assignments").delete().eq("id", assignmentId);
        if (error) throw new Error(error.message);
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
    if (canUseSupabase()) {
      const { data: notif, error } = await supabase.from("notifications").insert({
        title: payload.title,
        body: payload.body ?? null,
        type: payload.type,
      }).select("id").single();
      if (error) throw new Error(error.message);
      if (notif && payload.targets.length > 0) {
        const { error: targetError } = await supabase.from("notification_targets").insert(
          payload.targets.map((target) => ({
            notification_id: notif.id,
            target_user_id: target.target_user_id ?? null,
            target_group_id: target.target_group_id ?? null,
          })),
        );
        if (targetError) throw new Error(targetError.message);
      }
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

    if (canUseSupabase()) {
      const groupIds = await fetchUserGroupIds(options.targetUserId ?? null);
      const orFilters: string[] = [];
      if (options.targetUserId) {
        orFilters.push(`target_user_id.eq.${options.targetUserId}`);
      }
      groupIds.forEach((gid) => orFilters.push(`target_group_id.eq.${gid}`));
      if (!orFilters.length) {
        return { notifications: [], pagination: { limit, offset, total: 0 } };
      }
      let query = supabase
        .from("notification_targets")
        .select("*, notifications!inner(*)")
        .or(orFilters.join(","))
        .order("notifications(created_at)", { ascending: order === "asc" });
      if (options.status === "read") {
        query = query.not("read_at", "is", null);
      } else if (options.status === "unread") {
        query = query.is("read_at", null);
      }
      if (options.type) {
        query = query.eq("notifications.type", options.type);
      }
      if (options.from) {
        query = query.gte("notifications.created_at", options.from);
      }
      if (options.to) {
        query = query.lte("notifications.created_at", options.to + "T23:59:59");
      }
      const { data: rawTargets, error } = await query;
      if (error) throw new Error(error.message);
      const mapped = (rawTargets ?? []).map((t: any) => {
        const notif = t.notifications || {};
        return {
          id: safeInt(t.id, Date.now()),
          target_id: safeOptionalInt(t.id) ?? undefined,
          target_user_id: safeOptionalInt(t.target_user_id) ?? null,
          sender_id: safeOptionalInt(notif.created_by) ?? null,
          sender_email: null,
          target_group_id: safeOptionalInt(t.target_group_id) ?? null,
          target_group_name: null,
          sender_name: null,
          sender_role: null,
          counterparty_id: null,
          counterparty_name: null,
          counterparty_role: null,
          sender: notif.created_by ? "Coach" : "Système",
          title: String(notif.title || ""),
          message: String(notif.body || ""),
          type: String(notif.type || "message"),
          read: Boolean(t.read_at),
          date: notif.created_at || new Date().toISOString(),
        };
      });
      const total = mapped.length;
      const paged = mapped.slice(offset, offset + limit);
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
    if (canUseSupabase()) {
      const { error } = await supabase.from("notification_targets").update({ read_at: new Date().toISOString() }).eq("id", resolvedId);
      if (error) throw new Error(error.message);
      return;
    }

    const notifs = this._get(STORAGE_KEYS.NOTIFICATIONS) || [];
    const updated = notifs.map((notif: any) => notif.id === resolvedId ? { ...notif, read: true } : notif);
    this._save(STORAGE_KEYS.NOTIFICATIONS, updated);
  },

  // --- TIMESHEETS ---
  async listTimesheetShifts(options?: { coachId?: number | null; from?: string; to?: string }): Promise<TimesheetShift[]> {
    if (canUseSupabase()) {
      let query = supabase.from("timesheet_shifts").select("*").order("shift_date", { ascending: false });
      if (options?.coachId) query = query.eq("coach_id", options.coachId);
      if (options?.from) query = query.gte("shift_date", options.from);
      if (options?.to) query = query.lte("shift_date", options.to);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data ?? [];
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
    if (canUseSupabase()) {
      const { data, error } = await supabase.from("timesheet_locations").select("*").order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
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
    if (canUseSupabase()) {
      const { error } = await supabase.from("timesheet_locations").insert({ name: payload.name.trim() });
      if (error) throw new Error(error.message);
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
    if (canUseSupabase()) {
      const { error } = await supabase.from("timesheet_locations").delete().eq("id", payload.id);
      if (error) throw new Error(error.message);
      return { status: "deleted" };
    }

    await delay(120);
    const locations = this._get(STORAGE_KEYS.TIMESHEET_LOCATIONS) || [];
    const updated = (locations as TimesheetLocation[]).filter((item) => item.id !== payload.id);
    this._save(STORAGE_KEYS.TIMESHEET_LOCATIONS, updated);
    return { status: "deleted" };
  },

  async listTimesheetCoaches(): Promise<{ id: number; display_name: string }[]> {
    if (canUseSupabase()) {
      const { data, error } = await supabase.from("users").select("id, display_name").eq("role", "coach").eq("is_active", true);
      if (error) throw new Error(error.message);
      return (data ?? []).map((u: any) => ({ id: u.id, display_name: u.display_name }));
    }
    return [];
  },

  async createTimesheetShift(payload: Omit<TimesheetShift, "id" | "created_at" | "updated_at" | "coach_name">) {
    if (canUseSupabase()) {
      const { error } = await supabase.from("timesheet_shifts").insert({
        coach_id: payload.coach_id,
        shift_date: payload.shift_date,
        start_time: payload.start_time,
        end_time: payload.end_time ?? null,
        location: payload.location ?? null,
      });
      if (error) throw new Error(error.message);
      return { status: "created" };
    }

    await delay(200);
    const shifts = this._get(STORAGE_KEYS.TIMESHEET_SHIFTS) || [];
    const created = { ...payload, id: Date.now(), created_at: new Date().toISOString() };
    this._save(STORAGE_KEYS.TIMESHEET_SHIFTS, [...shifts, created]);
    return { status: "created" };
  },

  async updateTimesheetShift(payload: Partial<TimesheetShift> & { id: number }) {
    if (canUseSupabase()) {
      const { id, ...rest } = payload;
      const { error } = await supabase.from("timesheet_shifts").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
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
    if (canUseSupabase()) {
      const { error } = await supabase.from("timesheet_shifts").delete().eq("id", payload.id);
      if (error) throw new Error(error.message);
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
      if (!canUseSupabase()) return null;
      let query = supabase.from("user_profiles").select("*");
      if (options.userId) {
        query = query.eq("user_id", options.userId);
      } else if (options.displayName) {
        query = query.eq("display_name", options.displayName);
      }
      const { data, error } = await query.maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return {
        id: data.user_id ?? null,
        display_name: data.display_name ?? null,
        email: data.email ?? null,
        birthdate: data.birthdate ?? null,
        group_id: safeOptionalInt(data.group_id) ?? null,
        group_label: data.group_label ?? null,
        objectives: data.objectives ?? null,
        bio: data.bio ?? null,
        avatar_url: data.avatar_url ?? null,
        ffn_iuf: data.ffn_iuf ?? null,
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
      if (!canUseSupabase()) return { status: "skipped" };
      const userId = payload.userId;
      if (!userId) return { status: "skipped" };
      const { error } = await supabase.from("user_profiles").upsert({
        user_id: userId,
        ...payload.profile,
      }, { onConflict: "user_id" });
      if (error) throw new Error(error.message);
      return { status: "updated" };
  },

  async getAthletes(): Promise<AthleteSummary[]> {
      if (!canUseSupabase()) {
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
      // Fetch athletes from groups + members
      const { data: groups, error: groupsError } = await supabase.from("groups").select("id, name");
      if (groupsError) throw new Error(groupsError.message);
      if (!groups?.length) {
        // No groups → list all athletes directly
        const { data: users, error: usersError } = await supabase.from("users").select("id, display_name").eq("role", "athlete").eq("is_active", true);
        if (usersError) throw new Error(usersError.message);
        return (users ?? [])
          .map((u: any) => ({ id: u.id, display_name: u.display_name }))
          .filter((a: AthleteSummary) => a.display_name)
          .sort((a, b) => a.display_name.localeCompare(b.display_name, "fr"));
      }
      const { data: members, error: membersError } = await supabase
        .from("group_members")
        .select("user_id, group_id, users!inner(display_name, role)")
        .eq("users.role", "athlete");
      if (membersError) throw new Error(membersError.message);
      const groupMap = new Map(groups.map((g: any) => [g.id, g.name]));
      const athleteMap = new Map<number, AthleteSummary>();
      (members ?? []).forEach((m: any) => {
        const userId = m.user_id;
        if (athleteMap.has(userId)) return;
        athleteMap.set(userId, {
          id: userId,
          display_name: (m.users as any)?.display_name ?? "",
          group_label: groupMap.get(m.group_id) ?? null,
        });
      });
      return Array.from(athleteMap.values())
        .filter((a) => a.display_name)
        .sort((a, b) => a.display_name.localeCompare(b.display_name, "fr"));
  },

  async getGroups(): Promise<GroupSummary[]> {
      if (!canUseSupabase()) return [];
      const { data, error } = await supabase.from("groups").select("id, name, description");
      if (error) throw new Error(error.message);
      return (data ?? [])
        .map((group: any) => ({
          id: safeInt(group.id, 0),
          name: String(group.name ?? `Groupe ${group.id ?? ""}`).trim(),
          member_count: null,
        }))
        .filter((group: GroupSummary) => group.id > 0 && group.name);
  },

  async getUpcomingBirthdays(options?: { days?: number }): Promise<UpcomingBirthday[]> {
      if (!canUseSupabase()) return [];
      const days = options?.days ?? 30;
      const { data, error } = await supabase.rpc("get_upcoming_birthdays", { p_days: days });
      if (error) throw new Error(error.message);
      return Array.isArray(data) ? data : [];
  },

  async listUsers(options?: {
    role?: "athlete" | "coach" | "comite" | "admin";
    includeInactive?: boolean;
  }): Promise<UserSummary[]> {
      if (!canUseSupabase()) return [];
      let query = supabase.from("users").select("id, display_name, role, email, is_active");
      if (options?.role) {
        query = query.eq("role", options.role);
      }
      if (!options?.includeInactive) {
        query = query.eq("is_active", true);
      }
      const { data, error } = await query.order("display_name");
      if (error) throw new Error(error.message);
      return (data ?? []).map((user: any) => ({
        id: user.id,
        display_name: user.display_name ?? "",
        role: user.role ?? "",
        email: user.email ?? null,
        is_active: user.is_active ?? null,
        group_label: null,
      }));
  },

  async createCoach(payload: { display_name: string; email?: string | null; password?: string | null }) {
      if (!canUseSupabase()) return { status: "skipped", user: null, initialPassword: null };
      const { data, error } = await supabase.functions.invoke("admin-user", {
        body: { action: "create_coach", display_name: payload.display_name, email: payload.email, password: payload.password },
      });
      if (error) throw new Error(error.message);
      return {
        status: "created",
        user: data?.user ?? null,
        initialPassword: data?.initial_password ?? null,
      };
  },

  async updateUserRole(payload: { userId: number; role: "athlete" | "coach" | "comite" | "admin" }) {
      if (!canUseSupabase()) return { status: "skipped" };
      const { error } = await supabase.functions.invoke("admin-user", {
        body: { action: "update_role", user_id: payload.userId, role: payload.role },
      });
      if (error) throw new Error(error.message);
      return { status: "updated" };
  },

  async disableUser(payload: { userId: number }) {
      if (!canUseSupabase()) return { status: "skipped" };
      const { error } = await supabase.functions.invoke("admin-user", {
        body: { action: "disable_user", user_id: payload.userId },
      });
      if (error) throw new Error(error.message);
      return { status: "disabled" };
  },

  async getPendingApprovals(): Promise<Array<{ user_id: number; display_name: string; email: string | null; created_at: string }>> {
    if (!canUseSupabase()) return [];
    const { data, error } = await supabase
      .from("user_profiles")
      .select("user_id, display_name, email, created_at")
      .eq("is_approved", false);
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async approveUser(userId: number): Promise<void> {
    if (!canUseSupabase()) return;
    const { error } = await supabase
      .from("user_profiles")
      .update({ is_approved: true, approved_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
  },

  async rejectUser(userId: number): Promise<void> {
    if (!canUseSupabase()) return;
    const { data, error } = await supabase.functions.invoke("admin-user", {
      body: { action: "disable_user", target_user_id: userId },
    });
    if (error) throw new Error(error.message);
  },

  async authPasswordUpdate(payload: { userId?: number | null; password: string }) {
      if (!canUseSupabase()) return { status: "skipped" };
      // If updating own password, use auth directly
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!payload.userId || payload.userId === currentUser?.user_metadata?.app_user_id) {
        const { error } = await supabase.auth.updateUser({ password: payload.password });
        if (error) throw new Error(error.message);
        return { status: "updated" };
      }
      // Admin updating another user's password
      const { error } = await supabase.functions.invoke("admin-user", {
        body: { action: "update_password", user_id: payload.userId, password: payload.password },
      });
      if (error) throw new Error(error.message);
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
