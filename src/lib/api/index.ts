/**
 * API Module - Centralized export
 *
 * This module provides a modular structure for the API layer.
 *
 * Structure:
 * - types.ts - All TypeScript interfaces
 * - client.ts - Supabase client, utilities, and helpers
 * - helpers.ts - Mapping functions and internal types
 * - (future) strength.ts - Exercises, strength sessions, runs
 * - (future) swim.ts - Swim records, swim catalog
 * - (future) records.ts - Hall of fame, club records
 * - (future) users.ts - Profile, athletes, users, groups
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
