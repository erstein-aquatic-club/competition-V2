/**
 * API Users - User management methods
 */

import {
  supabase,
  canUseSupabase,
  safeInt,
  safeOptionalInt,
  STORAGE_KEYS,
} from './client';
import type {
  UserProfile,
  AthleteSummary,
  GroupSummary,
  UpcomingBirthday,
  UserSummary,
} from './types';
import { localStorageGet } from './localStorage';

export async function getProfile(options: {
  userId?: number | null;
  displayName?: string | null;
}): Promise<UserProfile | null> {
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
}

export async function updateProfile(payload: {
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
  const { error } = await supabase.from("user_profiles").upsert(
    {
      user_id: userId,
      ...payload.profile,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
  return { status: "updated" };
}

export async function getAthletes(): Promise<AthleteSummary[]> {
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
    const sessions = (localStorageGet(STORAGE_KEYS.SESSIONS) ?? []) as any[];
    sessions.forEach((session: any) => addAthlete(session.athlete_name, session.athlete_id));
    const strengthRuns = (localStorageGet(STORAGE_KEYS.STRENGTH_RUNS) ?? []) as any[];
    strengthRuns.forEach((run: any) => addAthlete(run.athlete_name, run.athlete_id));
    const assignments = (localStorageGet(STORAGE_KEYS.ASSIGNMENTS) ?? []) as any[];
    assignments.forEach((assignment: any) =>
      addAthlete(assignment.target_athlete, assignment.target_user_id),
    );
    return Array.from(athletes.values()).sort((a, b) =>
      a.display_name.localeCompare(b.display_name, "fr"),
    );
  }

  const { data: groups, error: groupsError } = await supabase
    .from("groups")
    .select("id, name");
  if (groupsError) throw new Error(groupsError.message);
  if (!groups?.length) {
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, display_name")
      .eq("role", "athlete")
      .eq("is_active", true);
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
}

export async function getGroups(): Promise<GroupSummary[]> {
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
}

export async function getUpcomingBirthdays(options?: {
  days?: number;
}): Promise<UpcomingBirthday[]> {
  if (!canUseSupabase()) return [];
  const days = options?.days ?? 30;
  const { data, error } = await supabase.rpc("get_upcoming_birthdays", { p_days: days });
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data : [];
}

export async function listUsers(options?: {
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
}

export async function createCoach(payload: {
  display_name: string;
  email?: string | null;
  password?: string | null;
}) {
  if (!canUseSupabase()) return { status: "skipped", user: null, initialPassword: null };
  const { data, error } = await supabase.functions.invoke("admin-user", {
    body: {
      action: "create_coach",
      display_name: payload.display_name,
      email: payload.email,
      password: payload.password,
    },
  });
  if (error) throw new Error(error.message);
  return {
    status: "created",
    user: data?.user ?? null,
    initialPassword: data?.initial_password ?? null,
  };
}

export async function updateUserRole(payload: {
  userId: number;
  role: "athlete" | "coach" | "comite" | "admin";
}) {
  if (!canUseSupabase()) return { status: "skipped" };
  const { error } = await supabase.functions.invoke("admin-user", {
    body: { action: "update_role", user_id: payload.userId, role: payload.role },
  });
  if (error) throw new Error(error.message);
  return { status: "updated" };
}

export async function disableUser(payload: { userId: number }) {
  if (!canUseSupabase()) return { status: "skipped" };
  const { error } = await supabase.functions.invoke("admin-user", {
    body: { action: "disable_user", user_id: payload.userId },
  });
  if (error) throw new Error(error.message);
  return { status: "disabled" };
}

export async function getPendingApprovals(): Promise<
  Array<{ user_id: number; display_name: string; email: string | null; created_at: string }>
> {
  if (!canUseSupabase()) return [];
  const { data, error } = await supabase
    .from("user_profiles")
    .select("user_id, display_name, email, created_at")
    .eq("is_approved", false);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function approveUser(userId: number): Promise<void> {
  if (!canUseSupabase()) return;
  const { error } = await supabase
    .from("user_profiles")
    .update({ is_approved: true, approved_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function rejectUser(userId: number): Promise<void> {
  if (!canUseSupabase()) return;
  const { error } = await supabase.functions.invoke("admin-user", {
    body: { action: "disable_user", target_user_id: userId },
  });
  if (error) throw new Error(error.message);
}

export async function authPasswordUpdate(payload: {
  userId?: number | null;
  password: string;
}) {
  if (!canUseSupabase()) return { status: "skipped" };
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  if (!payload.userId || payload.userId === currentUser?.user_metadata?.app_user_id) {
    const { error } = await supabase.auth.updateUser({ password: payload.password });
    if (error) throw new Error(error.message);
    return { status: "updated" };
  }
  const { error } = await supabase.functions.invoke("admin-user", {
    body: { action: "update_password", user_id: payload.userId, password: payload.password },
  });
  if (error) throw new Error(error.message);
  return { status: "updated" };
}
