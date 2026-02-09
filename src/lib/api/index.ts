/**
 * API Module - Centralized export
 *
 * This module provides a modular structure for the API layer.
 *
 * Structure:
 * - types.ts - All TypeScript interfaces
 * - client.ts - Supabase client, utilities, and helpers
 * - helpers.ts - Mapping functions and internal types
 * - transformers.ts - Strength data payload transformers
 * - localStorage.ts - Fallback storage for offline mode
 * - users.ts - Profile, athletes, users, groups
 * - timesheet.ts - Timesheet shifts, locations, coaches
 * - notifications.ts - Notification CRUD
 * - assignments.ts - Assignment CRUD
 * - swim.ts - Swim catalog sessions
 * - records.ts - Hall of fame, club records, swim records, performances
 * - strength.ts - Exercises, strength sessions, runs, history, 1RM
 */

// Re-export types
export * from './types';

// Re-export helpers
export {
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
} from './helpers';

// Re-export client utilities
export {
  isNetworkAvailable,
  canUseSupabase,
  supabase,
  STORAGE_KEYS,
  safeInt,
  safeOptionalInt,
  safeOptionalNumber,
  normalizeScaleToFive,
  expandScaleToTen,
  estimateOneRm,
  parseApiError,
  summarizeApiError,
  normalizeCycleType,
  normalizeExerciseType,
  normalizeStrengthItem,
  validateStrengthItems,
  mapDbExerciseToApi,
  mapApiExerciseToDb,
  delay,
  parseRawPayload,
  fetchUserGroupIds,
} from './client';

// Re-export localStorage utilities
export {
  localStorageGet,
  localStorageSave,
  localStorageRemove,
  resetLocalStorageCache,
  storage,
} from './localStorage';

// Re-export transformers
export {
  prepareStrengthItemsPayload,
  mapItemsForDbInsert,
  createLocalStrengthRun,
  createSetLogDbPayload,
  buildRunUpdatePayload,
  collectEstimated1RMs,
  enrichItemsWithExerciseNames,
  mapLogsForDbInsert,
  type PreparedStrengthItems,
  type DbStrengthItemPayload,
} from './transformers';

// Re-export main api object from legacy file
export { api } from '../api';

// Re-export extracted modules
export {
  getProfile,
  updateProfile,
  getAthletes,
  getGroups,
  getUpcomingBirthdays,
  listUsers,
  createCoach,
  updateUserRole,
  disableUser,
  getPendingApprovals,
  approveUser,
  rejectUser,
  authPasswordUpdate,
} from './users';

export {
  listTimesheetShifts,
  listTimesheetLocations,
  createTimesheetLocation,
  deleteTimesheetLocation,
  listTimesheetCoaches,
  createTimesheetShift,
  updateTimesheetShift,
  deleteTimesheetShift,
} from './timesheet';

export {
  getNotifications,
  notifications_send,
  markNotificationRead,
  notifications_list,
  notifications_mark_read,
} from './notifications';

export {
  getAssignmentsForCoach,
  getAssignments,
  assignments_create,
  assignments_delete,
} from './assignments';

export {
  getSwimCatalog,
  createSwimSession,
  deleteSwimSession,
} from './swim';

export {
  getHallOfFame,
  getClubRecords,
  getClubRecordSwimmers,
  createClubRecordSwimmer,
  updateClubRecordSwimmer,
  updateClubRecordSwimmerForUser,
  importClubRecords,
  getImportLogs,
  importSingleSwimmer,
  getSwimRecords,
  upsertSwimRecord,
  getSwimmerPerformances,
  importSwimmerPerformances,
} from './records';

export {
  getExercises,
  createExercise,
  updateExercise,
  deleteExercise,
  getStrengthSessions,
  createStrengthSession,
  updateStrengthSession,
  persistStrengthSessionOrder,
  deleteStrengthSession,
  startStrengthRun,
  logStrengthSet,
  updateStrengthRun,
  deleteStrengthRun,
  saveStrengthRun,
  getStrengthHistory,
  getStrengthHistoryAggregate,
  get1RM,
  update1RM,
} from './strength';
