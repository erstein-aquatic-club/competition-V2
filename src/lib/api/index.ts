/**
 * API Module - Centralized export
 *
 * This module re-exports from the main api.ts for now.
 * Future refactoring will split into:
 * - types.ts (done)
 * - client.ts - Supabase client and utilities
 * - sessions.ts - Session sync
 * - strength.ts - Exercises, strength sessions, runs
 * - swim.ts - Swim records, swim catalog
 * - records.ts - Hall of fame, club records
 * - assignments.ts - Assignments
 * - notifications.ts - Notifications
 * - timesheet.ts - Timesheet
 * - users.ts - Profile, athletes, users, groups
 */

// Re-export types from dedicated file
export * from './types';

// Re-export everything else from main api.ts
// This maintains backward compatibility
export { api, parseApiError, summarizeApiError, useApiCapabilities } from '../api';
