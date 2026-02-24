/**
 * API Absences - Planned absence management for swimmers
 */

import { supabase, canUseSupabase } from "./client";
import type { PlannedAbsence } from "./types";

export async function getPlannedAbsences(options?: {
  userId?: number;
  from?: string;
  to?: string;
}): Promise<PlannedAbsence[]> {
  if (!canUseSupabase()) return [];
  let query = supabase.from("planned_absences").select("*");
  if (options?.userId) query = query.eq("user_id", options.userId);
  if (options?.from) query = query.gte("date", options.from);
  if (options?.to) query = query.lte("date", options.to);
  const { data, error } = await query.order("date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PlannedAbsence[];
}

export async function getMyPlannedAbsences(): Promise<PlannedAbsence[]> {
  if (!canUseSupabase()) return [];
  // RLS filters by app_user_id() automatically
  const { data, error } = await supabase
    .from("planned_absences")
    .select("*")
    .order("date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PlannedAbsence[];
}

export async function setPlannedAbsence(date: string, reason?: string | null): Promise<PlannedAbsence> {
  if (!canUseSupabase()) throw new Error("Supabase not available");
  // RLS ensures user can only insert for their own user_id
  // We need to get the current user's integer ID from app_user_id
  const { data: { session } } = await supabase.auth.getSession();
  const appUserId = session?.user?.app_metadata?.app_user_id;
  if (!appUserId) throw new Error("User ID not found");
  const { data, error } = await supabase
    .from("planned_absences")
    .upsert(
      { user_id: appUserId, date, reason: reason ?? null },
      { onConflict: "user_id,date" },
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as PlannedAbsence;
}

export async function removePlannedAbsence(date: string): Promise<void> {
  if (!canUseSupabase()) return;
  const { data: { session } } = await supabase.auth.getSession();
  const appUserId = session?.user?.app_metadata?.app_user_id;
  if (!appUserId) return;
  const { error } = await supabase
    .from("planned_absences")
    .delete()
    .eq("user_id", appUserId)
    .eq("date", date);
  if (error) throw new Error(error.message);
}
