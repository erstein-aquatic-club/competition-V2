/**
 * API Module - Centralized export
 *
 * This module provides a modular structure for the API layer.
 *
 * Structure:
 * - types.ts - All TypeScript interfaces
 * - client.ts - Supabase client, utilities, and helpers
 * - (future) strength.ts - Exercises, strength sessions, runs
 * - (future) swim.ts - Swim records, swim catalog
 * - (future) records.ts - Hall of fame, club records
 * - (future) users.ts - Profile, athletes, users, groups
 */

// Re-export types
export * from './types';

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

// Re-export main api object from legacy file
export { api, useApiCapabilities } from '../api';
