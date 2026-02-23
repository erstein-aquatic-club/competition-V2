/**
 * API Competitions - CRUD for coach competition management
 */

import { supabase, canUseSupabase } from "./client";
import type { Competition, CompetitionInput } from "./types";

export async function getCompetitions(): Promise<Competition[]> {
  if (!canUseSupabase()) return [];
  const { data, error } = await supabase
    .from("competitions")
    .select("*")
    .order("date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Competition[];
}

export async function createCompetition(input: CompetitionInput): Promise<Competition> {
  if (!canUseSupabase()) throw new Error("Supabase not available");
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("competitions")
    .insert({ ...input, created_by: user?.id })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Competition;
}

export async function updateCompetition(id: string, input: Partial<CompetitionInput>): Promise<Competition> {
  if (!canUseSupabase()) throw new Error("Supabase not available");
  const { data, error } = await supabase
    .from("competitions")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Competition;
}

export async function deleteCompetition(id: string): Promise<void> {
  if (!canUseSupabase()) throw new Error("Supabase not available");
  const { error } = await supabase
    .from("competitions")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}
