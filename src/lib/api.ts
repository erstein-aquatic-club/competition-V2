import { useAuth } from "./auth";
import { supabase } from "./supabase";

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
  ApiCapabilities,
} from "./api/types";

// --- Utilities (imported from api/client.ts) ---
import {
  canUseSupabase,
  STORAGE_KEYS,
  normalizeScaleToFive,
  expandScaleToTen,
  delay,
} from "./api/client";

// --- Helpers ---
import {
  mapToDbSession,
  mapFromDbSession,
  type SyncSessionInputWithId,
} from "./api/helpers";

// Re-export error utilities for backward compatibility
export { parseApiError, summarizeApiError } from "./api/client";

// --- Delegated module imports ---
import {
  getProfile as _getProfile,
  updateProfile as _updateProfile,
  getAthletes as _getAthletes,
  getGroups as _getGroups,
  getUpcomingBirthdays as _getUpcomingBirthdays,
  listUsers as _listUsers,
  createCoach as _createCoach,
  updateUserRole as _updateUserRole,
  disableUser as _disableUser,
  getPendingApprovals as _getPendingApprovals,
  approveUser as _approveUser,
  rejectUser as _rejectUser,
  authPasswordUpdate as _authPasswordUpdate,
} from "./api/users";

import {
  listTimesheetShifts as _listTimesheetShifts,
  listTimesheetLocations as _listTimesheetLocations,
  createTimesheetLocation as _createTimesheetLocation,
  deleteTimesheetLocation as _deleteTimesheetLocation,
  listTimesheetCoaches as _listTimesheetCoaches,
  createTimesheetShift as _createTimesheetShift,
  updateTimesheetShift as _updateTimesheetShift,
  deleteTimesheetShift as _deleteTimesheetShift,
} from "./api/timesheet";

import {
  getNotifications as _getNotifications,
  notifications_send as _notifications_send,
  markNotificationRead as _markNotificationRead,
  notifications_list as _notifications_list,
  notifications_mark_read as _notifications_mark_read,
} from "./api/notifications";

import {
  getAssignmentsForCoach as _getAssignmentsForCoach,
  getAssignments as _getAssignments,
  assignments_create as _assignments_create,
  assignments_delete as _assignments_delete,
} from "./api/assignments";

import {
  getSwimCatalog as _getSwimCatalog,
  createSwimSession as _createSwimSession,
  deleteSwimSession as _deleteSwimSession,
} from "./api/swim";

import {
  getHallOfFame as _getHallOfFame,
  getClubRecords as _getClubRecords,
  getClubRecordSwimmers as _getClubRecordSwimmers,
  createClubRecordSwimmer as _createClubRecordSwimmer,
  updateClubRecordSwimmer as _updateClubRecordSwimmer,
  updateClubRecordSwimmerForUser as _updateClubRecordSwimmerForUser,
  importClubRecords as _importClubRecords,
  getImportLogs as _getImportLogs,
  importSingleSwimmer as _importSingleSwimmer,
  getSwimRecords as _getSwimRecords,
  upsertSwimRecord as _upsertSwimRecord,
  getSwimmerPerformances as _getSwimmerPerformances,
  importSwimmerPerformances as _importSwimmerPerformances,
} from "./api/records";

import {
  getExercises as _getExercises,
  createExercise as _createExercise,
  updateExercise as _updateExercise,
  deleteExercise as _deleteExercise,
  getStrengthSessions as _getStrengthSessions,
  createStrengthSession as _createStrengthSession,
  updateStrengthSession as _updateStrengthSession,
  persistStrengthSessionOrder as _persistStrengthSessionOrder,
  deleteStrengthSession as _deleteStrengthSession,
  startStrengthRun as _startStrengthRun,
  logStrengthSet as _logStrengthSet,
  updateStrengthRun as _updateStrengthRun,
  deleteStrengthRun as _deleteStrengthRun,
  saveStrengthRun as _saveStrengthRun,
  getStrengthHistory as _getStrengthHistory,
  getStrengthHistoryAggregate as _getStrengthHistoryAggregate,
  get1RM as _get1RM,
  update1RM as _update1RM,
} from "./api/strength";

// --- API Service ---

export const api = {
  // ── Capabilities ──
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

  // ── FFN Sync (kept in api.ts) ──
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

  // ── Swim Sessions (kept in api.ts) ──
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

  // ── Demo Seed (kept in api.ts) ──
  async seedDemoData() {
    const exercises = [
      { id: 1, nom_exercice: "Squat", description: "Flexion des jambes", exercise_type: "strength" },
      { id: 2, nom_exercice: "Développé Couché", description: "Poussée horizontale", exercise_type: "strength" },
      { id: 3, nom_exercice: "Tractions", description: "Tirage vertical", exercise_type: "strength" },
      { id: 4, nom_exercice: "Rotations Élastique", description: "Coiffe des rotateurs", exercise_type: "warmup" },
    ];
    this._save(STORAGE_KEYS.EXERCISES, exercises);

    const sSession = {
      id: 101, title: "Full Body A", description: "Séance globale", cycle: "Endurance",
      items: [
        { exercise_id: 4, exercise_name: "Rotations Élastique", category: "warmup", order_index: 0, sets: 2, reps: 15, rest_seconds: 30, percent_1rm: 0 },
        { exercise_id: 1, exercise_name: "Squat", category: "strength", order_index: 1, sets: 4, reps: 10, rest_seconds: 90, percent_1rm: 70 },
        { exercise_id: 2, exercise_name: "Développé Couché", category: "strength", order_index: 2, sets: 4, reps: 10, rest_seconds: 90, percent_1rm: 70 },
      ],
    };
    this._save(STORAGE_KEYS.STRENGTH_SESSIONS, [sSession]);

    const swSession = {
      id: 201,
      name: "VMA 100",
      description: "Travail de vitesse",
      created_by: 1,
      items: [
        { label: "Échauffement 4N", distance: 400, intensity: "Souple", notes: "Progressif" },
        { label: "Corps NL", distance: 1000, intensity: "Max", notes: "10x100 départ 1:30" },
      ],
    };
    this._save(STORAGE_KEYS.SWIM_SESSIONS, [swSession]);

    const today = new Date().toISOString().split("T")[0];
    await this.assignments_create({ session_id: 101, assignment_type: "strength", target_athlete: "Camille", assigned_date: today });

    return { status: "seeded" };
  },

  // ── Local Storage Utils (kept in api.ts) ──
  _get(key: string) {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  },

  _save(key: string, data: any) {
    localStorage.setItem(key, JSON.stringify(data));
  },

  resetCache() {
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
    window.location.reload();
  },

  // ══════════════════════════════════════════════════════════════════
  // DELEGATION STUBS — Records
  // ══════════════════════════════════════════════════════════════════
  async getHallOfFame() { return _getHallOfFame(); },
  async getClubRecords(filters: Parameters<typeof _getClubRecords>[0]) { return _getClubRecords(filters); },
  async getClubRecordSwimmers() { return _getClubRecordSwimmers(); },
  async createClubRecordSwimmer(payload: Parameters<typeof _createClubRecordSwimmer>[0]) { return _createClubRecordSwimmer(payload); },
  async updateClubRecordSwimmer(id: number, payload: Parameters<typeof _updateClubRecordSwimmer>[1]) { return _updateClubRecordSwimmer(id, payload); },
  async updateClubRecordSwimmerForUser(userId: number, payload: Parameters<typeof _updateClubRecordSwimmerForUser>[1]) { return _updateClubRecordSwimmerForUser(userId, payload); },
  async importClubRecords() { return _importClubRecords(); },
  async getImportLogs(filters?: Parameters<typeof _getImportLogs>[0]) { return _getImportLogs(filters); },
  async importSingleSwimmer(swimmerIuf: string, swimmerName?: string) { return _importSingleSwimmer(swimmerIuf, swimmerName); },
  async getSwimRecords(options: Parameters<typeof _getSwimRecords>[0]) { return _getSwimRecords(options); },
  async upsertSwimRecord(payload: Parameters<typeof _upsertSwimRecord>[0]) { return _upsertSwimRecord(payload); },
  async getSwimmerPerformances(filters: Parameters<typeof _getSwimmerPerformances>[0]) { return _getSwimmerPerformances(filters); },
  async importSwimmerPerformances(params: Parameters<typeof _importSwimmerPerformances>[0]) { return _importSwimmerPerformances(params); },

  // ══════════════════════════════════════════════════════════════════
  // DELEGATION STUBS — Strength
  // ══════════════════════════════════════════════════════════════════
  async getExercises() { return _getExercises(); },
  async createExercise(exercise: Parameters<typeof _createExercise>[0]) { return _createExercise(exercise); },
  async updateExercise(exercise: Parameters<typeof _updateExercise>[0]) { return _updateExercise(exercise); },
  async deleteExercise(exerciseId: number) { return _deleteExercise(exerciseId); },
  async getStrengthSessions() { return _getStrengthSessions(); },
  async createStrengthSession(session: any) { return _createStrengthSession(session); },
  async updateStrengthSession(session: any) { return _updateStrengthSession(session); },
  async persistStrengthSessionOrder(session: Parameters<typeof _persistStrengthSessionOrder>[0]) { return _persistStrengthSessionOrder(session); },
  async deleteStrengthSession(sessionId: number) { return _deleteStrengthSession(sessionId); },
  async startStrengthRun(data: Parameters<typeof _startStrengthRun>[0]) { return _startStrengthRun(data); },
  async logStrengthSet(payload: Parameters<typeof _logStrengthSet>[0]) { return _logStrengthSet(payload); },
  async updateStrengthRun(update: Parameters<typeof _updateStrengthRun>[0]) { return _updateStrengthRun(update); },
  async deleteStrengthRun(runId: number) { return _deleteStrengthRun(runId); },
  async saveStrengthRun(run: any) { return _saveStrengthRun(run); },
  async getStrengthHistory(athleteName: string, options?: Parameters<typeof _getStrengthHistory>[1]) { return _getStrengthHistory(athleteName, options); },
  async getStrengthHistoryAggregate(athleteName: string, options?: Parameters<typeof _getStrengthHistoryAggregate>[1]) { return _getStrengthHistoryAggregate(athleteName, options); },
  async get1RM(athlete: Parameters<typeof _get1RM>[0]) { return _get1RM(athlete); },
  async update1RM(record: Parameters<typeof _update1RM>[0]) { return _update1RM(record); },

  // ══════════════════════════════════════════════════════════════════
  // DELEGATION STUBS — Swim Catalog
  // ══════════════════════════════════════════════════════════════════
  async getSwimCatalog() { return _getSwimCatalog(); },
  async createSwimSession(session: any) { return _createSwimSession(session); },
  async deleteSwimSession(sessionId: number) { return _deleteSwimSession(sessionId); },

  // ══════════════════════════════════════════════════════════════════
  // DELEGATION STUBS — Assignments
  // ══════════════════════════════════════════════════════════════════
  async getAssignmentsForCoach() { return _getAssignmentsForCoach(); },
  async getAssignments(athleteName: string, athleteId?: number | null, options?: Parameters<typeof _getAssignments>[2]) { return _getAssignments(athleteName, athleteId, options); },
  async assignments_create(data: Parameters<typeof _assignments_create>[0]) {
    const currentUserId = useAuth.getState().userId;
    return _assignments_create(data, currentUserId);
  },
  async assignments_delete(assignmentId: number) { return _assignments_delete(assignmentId); },

  // ══════════════════════════════════════════════════════════════════
  // DELEGATION STUBS — Notifications
  // ══════════════════════════════════════════════════════════════════
  async getNotifications(athleteName: string) { return _getNotifications(athleteName); },
  async notifications_send(payload: Parameters<typeof _notifications_send>[0]) { return _notifications_send(payload); },
  async markNotificationRead(id: number) { return _markNotificationRead(id); },
  async notifications_list(options: Parameters<typeof _notifications_list>[0]) { return _notifications_list(options); },
  async notifications_mark_read(payload: Parameters<typeof _notifications_mark_read>[0]) { return _notifications_mark_read(payload); },

  // ══════════════════════════════════════════════════════════════════
  // DELEGATION STUBS — Timesheet
  // ══════════════════════════════════════════════════════════════════
  async listTimesheetShifts(options?: Parameters<typeof _listTimesheetShifts>[0]) { return _listTimesheetShifts(options); },
  async listTimesheetLocations() { return _listTimesheetLocations(); },
  async createTimesheetLocation(payload: Parameters<typeof _createTimesheetLocation>[0]) { return _createTimesheetLocation(payload); },
  async deleteTimesheetLocation(payload: Parameters<typeof _deleteTimesheetLocation>[0]) { return _deleteTimesheetLocation(payload); },
  async listTimesheetCoaches() { return _listTimesheetCoaches(); },
  async createTimesheetShift(payload: Parameters<typeof _createTimesheetShift>[0]) { return _createTimesheetShift(payload); },
  async updateTimesheetShift(payload: Parameters<typeof _updateTimesheetShift>[0]) { return _updateTimesheetShift(payload); },
  async deleteTimesheetShift(payload: Parameters<typeof _deleteTimesheetShift>[0]) { return _deleteTimesheetShift(payload); },

  // ══════════════════════════════════════════════════════════════════
  // DELEGATION STUBS — Users
  // ══════════════════════════════════════════════════════════════════
  async getProfile(options: Parameters<typeof _getProfile>[0]) { return _getProfile(options); },
  async updateProfile(payload: Parameters<typeof _updateProfile>[0]) { return _updateProfile(payload); },
  async getAthletes() { return _getAthletes(); },
  async getGroups() { return _getGroups(); },
  async getUpcomingBirthdays(options?: Parameters<typeof _getUpcomingBirthdays>[0]) { return _getUpcomingBirthdays(options); },
  async listUsers(options?: Parameters<typeof _listUsers>[0]) { return _listUsers(options); },
  async createCoach(payload: Parameters<typeof _createCoach>[0]) { return _createCoach(payload); },
  async updateUserRole(payload: Parameters<typeof _updateUserRole>[0]) { return _updateUserRole(payload); },
  async disableUser(payload: Parameters<typeof _disableUser>[0]) { return _disableUser(payload); },
  async getPendingApprovals() { return _getPendingApprovals(); },
  async approveUser(userId: number) { return _approveUser(userId); },
  async rejectUser(userId: number) { return _rejectUser(userId); },
  async authPasswordUpdate(payload: Parameters<typeof _authPasswordUpdate>[0]) { return _authPasswordUpdate(payload); },
};
