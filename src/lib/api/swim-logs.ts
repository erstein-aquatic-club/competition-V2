/**
 * API Swim Logs - Technical notes per swim exercise
 */

import { supabase, canUseSupabase } from './client';
import type { SwimExerciseLog, SwimExerciseLogInput } from './types';

export async function getSwimExerciseLogs(sessionId: number): Promise<SwimExerciseLog[]> {
  if (!canUseSupabase()) return [];

  const { data, error } = await supabase
    .from('swim_exercise_logs')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map(mapFromDb);
}

export async function getSwimExerciseLogsHistory(
  userId: string,
  limit = 50,
): Promise<SwimExerciseLog[]> {
  if (!canUseSupabase()) return [];

  const { data, error } = await supabase
    .from('swim_exercise_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map(mapFromDb);
}

export async function saveSwimExerciseLogs(
  sessionId: number,
  userId: string,
  logs: SwimExerciseLogInput[],
): Promise<void> {
  if (!canUseSupabase()) return;

  // Delete existing logs for this session+user, then insert new ones
  const { error: delError } = await supabase
    .from('swim_exercise_logs')
    .delete()
    .eq('session_id', sessionId)
    .eq('user_id', userId);

  if (delError) throw new Error(delError.message);

  if (logs.length === 0) return;

  const rows = logs.map((log) => ({
    session_id: sessionId,
    user_id: userId,
    exercise_label: log.exercise_label,
    source_item_id: log.source_item_id ?? null,
    split_times: log.split_times ?? [],
    tempo: log.tempo ?? null,
    stroke_count: log.stroke_count ?? [],
    notes: log.notes ?? null,
  }));

  const { error } = await supabase.from('swim_exercise_logs').insert(rows);
  if (error) throw new Error(error.message);
}

export async function deleteSwimExerciseLog(logId: string): Promise<void> {
  if (!canUseSupabase()) return;

  const { error } = await supabase
    .from('swim_exercise_logs')
    .delete()
    .eq('id', logId);

  if (error) throw new Error(error.message);
}

function mapFromDb(row: Record<string, unknown>): SwimExerciseLog {
  return {
    id: String(row.id),
    session_id: Number(row.session_id),
    user_id: String(row.user_id),
    exercise_label: String(row.exercise_label ?? ''),
    source_item_id: row.source_item_id != null ? Number(row.source_item_id) : null,
    split_times: Array.isArray(row.split_times) ? row.split_times as SwimExerciseLog['split_times'] : [],
    tempo: row.tempo != null ? Number(row.tempo) : null,
    stroke_count: Array.isArray(row.stroke_count) ? row.stroke_count as SwimExerciseLog['stroke_count'] : [],
    notes: row.notes != null ? String(row.notes) : null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}
