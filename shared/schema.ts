import { sql } from "drizzle-orm";
import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  doublePrecision,
  date,
  time,
  jsonb,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// =============================================================================
// 1. CORE & USERS
// =============================================================================

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    displayName: text("display_name").notNull(),
    displayNameLower: text("display_name_lower").unique().notNull(),
    role: text("role").notNull().default("athlete"),
    email: text("email").unique(),
    passwordHash: text("password_hash"),
    birthdate: date("birthdate"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => [index("idx_users_created").on(table.createdAt)]
);

export const userProfiles = pgTable(
  "user_profiles",
  {
    userId: integer("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    groupId: integer("group_id"),
    displayName: text("display_name"),
    email: text("email"),
    birthdate: date("birthdate"),
    groupLabel: text("group_label"),
    objectives: text("objectives"),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("idx_user_profiles_updated").on(table.updatedAt)]
);

export const authLoginAttempts = pgTable(
  "auth_login_attempts",
  {
    identifier: text("identifier").notNull(),
    ipAddress: text("ip_address").notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    firstAttemptAt: timestamp("first_attempt_at", {
      withTimezone: true,
    }).notNull(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.ipAddress] })]
);

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    replacedBy: text("replaced_by"),
    tokenHash: text("token_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("refresh_tokens_user_id_idx").on(table.userId)]
);

// =============================================================================
// 2. GROUPS & MEMBERSHIP
// =============================================================================

export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: text("name").unique().notNull(),
  description: text("description"),
});

export const dimGroupes = pgTable("dim_groupes", {
  id: serial("id").primaryKey(),
  name: text("name").unique().notNull(),
  description: text("description"),
});

export const groupMembers = pgTable(
  "group_members",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleInGroup: text("role_in_group"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_group_members_unique").on(table.groupId, table.userId),
    index("idx_group_members_group").on(table.groupId),
    index("idx_group_members_user").on(table.userId),
  ]
);

// =============================================================================
// 3. NOTIFICATIONS
// =============================================================================

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    body: text("body"),
    type: text("type").notNull(),
    createdBy: integer("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    metadata: jsonb("metadata"),
  },
  (table) => [
    index("idx_notifications_created").on(table.createdAt),
    index("idx_notifications_expires").on(table.expiresAt),
  ]
);

export const notificationTargets = pgTable(
  "notification_targets",
  {
    id: serial("id").primaryKey(),
    notificationId: integer("notification_id")
      .notNull()
      .references(() => notifications.id, { onDelete: "cascade" }),
    targetUserId: integer("target_user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    targetGroupId: integer("target_group_id").references(() => groups.id, {
      onDelete: "cascade",
    }),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_notification_targets_user").on(table.targetUserId),
    index("idx_notification_targets_group").on(table.targetGroupId),
    index("idx_notification_targets_notification").on(table.notificationId),
  ]
);

// =============================================================================
// 4. NATATION (SWIMMING)
// =============================================================================

export const dimSessions = pgTable(
  "dim_sessions",
  {
    id: serial("id").primaryKey(),
    athleteId: integer("athlete_id").references(() => users.id, {
      onDelete: "set null",
    }),
    athleteName: text("athlete_name").notNull(),
    timestampReception: timestamp("timestamp_reception", {
      withTimezone: true,
    }),
    sessionDate: date("session_date").notNull(),
    timeSlot: text("time_slot").notNull(),
    distance: integer("distance"),
    duration: integer("duration").notNull(),
    rpe: integer("rpe").notNull(),
    performance: integer("performance"),
    engagement: integer("engagement"),
    fatigue: integer("fatigue"),
    trainingLoad: integer("training_load"),
    comments: text("comments"),
    userAgent: text("user_agent"),
    rawPayload: jsonb("raw_payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_dim_sessions_dedupe").on(
      table.athleteName,
      table.sessionDate,
      table.timeSlot,
      table.duration,
      table.rpe
    ),
    index("idx_dim_sessions_athlete").on(table.athleteId),
    index("idx_dim_sessions_athlete_date").on(
      table.athleteId,
      table.sessionDate
    ),
    index("idx_dim_sessions_name_date").on(
      table.athleteName,
      table.sessionDate
    ),
    index("idx_dim_sessions_date").on(table.sessionDate),
    index("idx_dim_sessions_created").on(table.createdAt),
  ]
);

export const swimRecords = pgTable(
  "swim_records",
  {
    id: serial("id").primaryKey(),
    athleteId: integer("athlete_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventName: text("event_name").notNull(),
    poolLength: integer("pool_length"),
    timeSeconds: doublePrecision("time_seconds"),
    recordDate: date("record_date"),
    notes: text("notes"),
  },
  (table) => [
    index("idx_swim_records_athlete").on(table.athleteId),
    index("idx_swim_records_date").on(table.recordDate),
  ]
);

export const clubPerformances = pgTable(
  "club_performances",
  {
    id: serial("id").primaryKey(),
    athleteName: text("athlete_name").notNull(),
    sex: text("sex").notNull(),
    poolM: integer("pool_m").notNull(),
    eventCode: text("event_code").notNull(),
    eventLabel: text("event_label"),
    age: integer("age").notNull(),
    timeMs: integer("time_ms").notNull(),
    recordDate: date("record_date"),
    source: text("source"),
    importId: text("import_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("club_performances_filters_idx").on(
      table.poolM,
      table.sex,
      table.age,
      table.eventCode
    ),
  ]
);

export const clubRecords = pgTable(
  "club_records",
  {
    id: serial("id").primaryKey(),
    performanceId: integer("performance_id").notNull(),
    athleteName: text("athlete_name").notNull(),
    sex: text("sex").notNull(),
    poolM: integer("pool_m").notNull(),
    eventCode: text("event_code").notNull(),
    eventLabel: text("event_label"),
    age: integer("age").notNull(),
    timeMs: integer("time_ms").notNull(),
    recordDate: date("record_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("club_records_unique_idx").on(
      table.poolM,
      table.sex,
      table.age,
      table.eventCode
    ),
    index("club_records_filters_idx").on(
      table.poolM,
      table.sex,
      table.age,
      table.eventCode
    ),
  ]
);

export const clubRecordSwimmers = pgTable(
  "club_record_swimmers",
  {
    id: serial("id").primaryKey(),
    sourceType: text("source_type").notNull(),
    userId: integer("user_id"),
    displayName: text("display_name").notNull(),
    iuf: text("iuf"),
    sex: text("sex"),
    birthdate: date("birthdate"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("club_record_swimmers_user_idx").on(
      table.userId,
      table.sourceType
    ),
    index("club_record_swimmers_active_idx").on(table.isActive),
  ]
);

export const swimSessionsCatalog = pgTable(
  "swim_sessions_catalog",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    createdBy: integer("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_swim_sessions_created_by").on(table.createdBy),
    index("idx_swim_sessions_created").on(table.createdAt),
  ]
);

export const swimSessionItems = pgTable(
  "swim_session_items",
  {
    id: serial("id").primaryKey(),
    catalogId: integer("catalog_id")
      .notNull()
      .references(() => swimSessionsCatalog.id, { onDelete: "cascade" }),
    ordre: integer("ordre").notNull(),
    label: text("label"),
    distance: integer("distance"),
    duration: integer("duration"),
    intensity: text("intensity"),
    notes: text("notes"),
    rawPayload: jsonb("raw_payload"),
  },
  (table) => [
    index("idx_swim_session_items_catalog").on(table.catalogId, table.ordre),
  ]
);

// =============================================================================
// 5. MUSCULATION (STRENGTH TRAINING)
// =============================================================================

export const dimExercices = pgTable("dim_exercices", {
  id: serial("id").primaryKey(),
  numeroExercice: integer("numero_exercice"),
  nomExercice: text("nom_exercice").notNull(),
  description: text("description"),
  illustrationGif: text("illustration_gif"),
  exerciseType: text("exercise_type").notNull(),
  nbSeriesEndurance: integer("nb_series_endurance"),
  nbRepsEndurance: integer("nb_reps_endurance"),
  pourcentageCharge1rmEndurance: doublePrecision(
    "pourcentage_charge_1rm_endurance"
  ),
  recupSeriesEndurance: integer("recup_series_endurance"),
  recupExercicesEndurance: integer("recup_exercices_endurance"),
  nbSeriesHypertrophie: integer("nb_series_hypertrophie"),
  nbRepsHypertrophie: integer("nb_reps_hypertrophie"),
  pourcentageCharge1rmHypertrophie: doublePrecision(
    "pourcentage_charge_1rm_hypertrophie"
  ),
  recupSeriesHypertrophie: integer("recup_series_hypertrophie"),
  recupExercicesHypertrophie: integer("recup_exercices_hypertrophie"),
  nbSeriesForce: integer("nb_series_force"),
  nbRepsForce: integer("nb_reps_force"),
  pourcentageCharge1rmForce: doublePrecision("pourcentage_charge_1rm_force"),
  recupSeriesForce: integer("recup_series_force"),
  recupExercicesForce: integer("recup_exercices_force"),
});

export const strengthSessions = pgTable(
  "strength_sessions",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    createdBy: integer("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_strength_sessions_created_by").on(table.createdBy),
    index("idx_strength_sessions_created").on(table.createdAt),
  ]
);

export const strengthSessionItems = pgTable(
  "strength_session_items",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id")
      .notNull()
      .references(() => strengthSessions.id, { onDelete: "cascade" }),
    ordre: integer("ordre").notNull(),
    exerciseId: integer("exercise_id")
      .notNull()
      .references(() => dimExercices.id, { onDelete: "cascade" }),
    block: text("block").notNull(),
    cycleType: text("cycle_type").notNull(),
    sets: integer("sets"),
    reps: integer("reps"),
    pct1rm: doublePrecision("pct_1rm"),
    restSeriesS: integer("rest_series_s"),
    restExerciseS: integer("rest_exercise_s"),
    notes: text("notes"),
    rawPayload: jsonb("raw_payload"),
  },
  (table) => [
    index("idx_strength_session_items_session").on(
      table.sessionId,
      table.ordre
    ),
  ]
);

export const sessionAssignments = pgTable(
  "session_assignments",
  {
    id: serial("id").primaryKey(),
    assignmentType: text("assignment_type").notNull(),
    swimCatalogId: integer("swim_catalog_id").references(
      () => swimSessionsCatalog.id,
      { onDelete: "set null" }
    ),
    strengthSessionId: integer("strength_session_id").references(
      () => strengthSessions.id,
      { onDelete: "set null" }
    ),
    targetUserId: integer("target_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    targetGroupId: integer("target_group_id").references(() => groups.id, {
      onDelete: "set null",
    }),
    assignedBy: integer("assigned_by").references(() => users.id, {
      onDelete: "set null",
    }),
    scheduledDate: date("scheduled_date"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    status: text("status").notNull().default("assigned"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_assignments_assigned_by").on(
      table.assignedBy,
      table.scheduledDate
    ),
    index("idx_assignments_target_user").on(
      table.targetUserId,
      table.scheduledDate
    ),
    index("idx_assignments_target_group").on(
      table.targetGroupId,
      table.scheduledDate
    ),
    index("idx_assignments_status").on(table.status),
  ]
);

export const strengthSessionRuns = pgTable(
  "strength_session_runs",
  {
    id: serial("id").primaryKey(),
    assignmentId: integer("assignment_id").references(
      () => sessionAssignments.id,
      { onDelete: "set null" }
    ),
    athleteId: integer("athlete_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("in_progress"),
    progressPct: doublePrecision("progress_pct"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    rawPayload: jsonb("raw_payload"),
  },
  (table) => [
    index("idx_strength_runs_assignment").on(table.assignmentId),
    index("idx_strength_runs_assignment_status").on(
      table.assignmentId,
      table.status
    ),
    index("idx_strength_runs_athlete").on(table.athleteId, table.startedAt),
  ]
);

export const strengthSetLogs = pgTable(
  "strength_set_logs",
  {
    id: serial("id").primaryKey(),
    runId: integer("run_id")
      .notNull()
      .references(() => strengthSessionRuns.id, { onDelete: "cascade" }),
    exerciseId: integer("exercise_id")
      .notNull()
      .references(() => dimExercices.id, { onDelete: "cascade" }),
    setIndex: integer("set_index"),
    reps: integer("reps"),
    weight: doublePrecision("weight"),
    pct1rmSuggested: doublePrecision("pct_1rm_suggested"),
    restSeconds: integer("rest_seconds"),
    rpe: integer("rpe"),
    notes: text("notes"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    rawPayload: jsonb("raw_payload"),
  },
  (table) => [
    index("idx_strength_set_logs_run").on(table.runId),
    index("idx_strength_set_logs_exercise").on(table.exerciseId),
    index("idx_strength_set_logs_completed").on(table.completedAt),
  ]
);

export const oneRmRecords = pgTable(
  "one_rm_records",
  {
    id: serial("id").primaryKey(),
    athleteId: integer("athlete_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    exerciseId: integer("exercise_id")
      .notNull()
      .references(() => dimExercices.id, { onDelete: "cascade" }),
    oneRm: doublePrecision("one_rm").notNull(),
    sourceRunId: integer("source_run_id").references(
      () => strengthSessionRuns.id,
      { onDelete: "set null" }
    ),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_one_rm_athlete").on(table.athleteId, table.recordedAt),
  ]
);

// =============================================================================
// 6. LEGACY COACH SESSIONS
// =============================================================================

export const dimSeance = pgTable(
  "dim_seance",
  {
    id: serial("id").primaryKey(),
    numeroSeance: integer("numero_seance"),
    nomSeance: text("nom_seance"),
    description: text("description"),
  },
  (table) => [index("idx_dim_seance_numero").on(table.numeroSeance)]
);

export const dimSeanceDeroule = pgTable("dim_seance_deroule", {
  id: serial("id").primaryKey(),
  numeroSeance: integer("numero_seance"),
  ordre: integer("ordre"),
  numeroExercice: integer("numero_exercice"),
});

// =============================================================================
// 7. TIMESHEET
// =============================================================================

export const timesheetLocations = pgTable("timesheet_locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const timesheetShifts = pgTable(
  "timesheet_shifts",
  {
    id: serial("id").primaryKey(),
    coachId: integer("coach_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    shiftDate: date("shift_date").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time"),
    location: text("location"),
    isTravel: boolean("is_travel").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_timesheet_shifts_coach").on(table.coachId),
    index("idx_timesheet_shifts_date").on(table.shiftDate),
  ]
);

// =============================================================================
// ZOD SCHEMAS (for validation)
// =============================================================================

export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);

// =============================================================================
// TYPES (inferred from Drizzle tables)
// =============================================================================

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = typeof userProfiles.$inferInsert;
export type Group = typeof groups.$inferSelect;
export type InsertGroup = typeof groups.$inferInsert;
export type GroupMember = typeof groupMembers.$inferSelect;
export type InsertGroupMember = typeof groupMembers.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
export type NotificationTarget = typeof notificationTargets.$inferSelect;
export type InsertNotificationTarget = typeof notificationTargets.$inferInsert;
export type DimSession = typeof dimSessions.$inferSelect;
export type InsertDimSession = typeof dimSessions.$inferInsert;
export type SwimRecord = typeof swimRecords.$inferSelect;
export type InsertSwimRecord = typeof swimRecords.$inferInsert;
export type ClubPerformance = typeof clubPerformances.$inferSelect;
export type InsertClubPerformance = typeof clubPerformances.$inferInsert;
export type ClubRecord = typeof clubRecords.$inferSelect;
export type InsertClubRecord = typeof clubRecords.$inferInsert;
export type ClubRecordSwimmer = typeof clubRecordSwimmers.$inferSelect;
export type InsertClubRecordSwimmer = typeof clubRecordSwimmers.$inferInsert;
export type SwimCatalog = typeof swimSessionsCatalog.$inferSelect;
export type InsertSwimCatalog = typeof swimSessionsCatalog.$inferInsert;
export type SwimSessionItem = typeof swimSessionItems.$inferSelect;
export type InsertSwimSessionItem = typeof swimSessionItems.$inferInsert;
export type Exercice = typeof dimExercices.$inferSelect;
export type InsertExercice = typeof dimExercices.$inferInsert;
export type StrengthSession = typeof strengthSessions.$inferSelect;
export type InsertStrengthSession = typeof strengthSessions.$inferInsert;
export type StrengthSessionItem = typeof strengthSessionItems.$inferSelect;
export type InsertStrengthSessionItem = typeof strengthSessionItems.$inferInsert;
export type SessionAssignment = typeof sessionAssignments.$inferSelect;
export type InsertSessionAssignment = typeof sessionAssignments.$inferInsert;
export type StrengthSessionRun = typeof strengthSessionRuns.$inferSelect;
export type InsertStrengthSessionRun = typeof strengthSessionRuns.$inferInsert;
export type StrengthSetLog = typeof strengthSetLogs.$inferSelect;
export type InsertStrengthSetLog = typeof strengthSetLogs.$inferInsert;
export type OneRmRecord = typeof oneRmRecords.$inferSelect;
export type InsertOneRmRecord = typeof oneRmRecords.$inferInsert;
export type TimesheetShift = typeof timesheetShifts.$inferSelect;
export type InsertTimesheetShift = typeof timesheetShifts.$inferInsert;
export type TimesheetLocation = typeof timesheetLocations.$inferSelect;
