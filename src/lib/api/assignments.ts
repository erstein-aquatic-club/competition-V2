/**
 * API Assignments - Assignment management methods
 */

import {
  supabase,
  canUseSupabase,
  safeInt,
  safeOptionalInt,
  delay,
  fetchUserGroupIds,
  STORAGE_KEYS,
} from './client';
import type { Assignment } from './types';
import { localStorageGet, localStorageSave } from './localStorage';
import { getSwimCatalog } from './swim';
import { getStrengthSessions } from './strength';

export async function getAssignmentsForCoach(): Promise<Assignment[] | null> {
  if (canUseSupabase()) {
    return null;
  }
  await delay(100);
  return (localStorageGet(STORAGE_KEYS.ASSIGNMENTS) || []) as Assignment[];
}

export async function getAssignments(
  athleteName: string,
  athleteId?: number | null,
  options?: { assignmentType?: "swim" | "strength"; status?: string },
): Promise<Assignment[]> {
  if (canUseSupabase()) {
    const groupIds = await fetchUserGroupIds(athleteId ?? null);
    const orFilters: string[] = [];
    if (athleteId !== null && athleteId !== undefined) {
      orFilters.push(`target_user_id.eq.${athleteId}`);
    }
    groupIds.forEach((gid) => orFilters.push(`target_group_id.eq.${gid}`));
    if (!orFilters.length) return [];

    let query = supabase
      .from("session_assignments")
      .select("*")
      .or(orFilters.join(","));
    if (options?.assignmentType) {
      query = query.eq("assignment_type", options.assignmentType);
    }
    if (options?.status) {
      query = query.eq("status", options.status);
    } else {
      query = query.neq("status", "completed");
    }
    const { data: rawAssignments, error } = await query;
    if (error) throw new Error(error.message);
    if (!rawAssignments?.length) return [];

    const [swimCatalogs, strengthCatalogs] = await Promise.all([
      getSwimCatalog(),
      getStrengthSessions(),
    ]);
    const swimById = new Map(swimCatalogs.map((catalog) => [catalog.id, catalog]));
    const strengthById = new Map(
      strengthCatalogs.map((session) => [session.id, session]),
    );
    const mapped = rawAssignments.map((assignment: any) => {
      const sessionType =
        assignment.assignment_type === "strength" ? "strength" : "swim";
      const sessionId =
        safeOptionalInt(
          sessionType === "swim"
            ? assignment.swim_catalog_id
            : assignment.strength_session_id,
        ) ?? 0;
      const scheduledDate = assignment.scheduled_date || assignment.created_at || "";
      const status = String(assignment.status || "assigned");
      const swimSession =
        sessionType === "swim" ? swimById.get(sessionId) : undefined;
      const strengthSession =
        sessionType === "strength" ? strengthById.get(sessionId) : undefined;
      const base = {
        id: safeInt(assignment.id, Date.now()),
        session_id: sessionId,
        session_type: sessionType,
        title:
          sessionType === "swim"
            ? (swimSession?.name ?? "Séance natation")
            : (strengthSession?.title ?? "Séance musculation"),
        description:
          (swimSession?.description ?? strengthSession?.description) ?? "",
        assigned_date: scheduledDate || new Date().toISOString(),
        assigned_slot: assignment.scheduled_slot ?? null,
        status,
        items: strengthSession?.items ?? swimSession?.items,
      } as Assignment & { cycle?: string; assigned_slot?: string | null };
      if (sessionType === "strength") {
        base.cycle = strengthSession?.cycle ?? "endurance";
      }
      return base;
    });
    const unique = new Map(mapped.map((assignment) => [assignment.id, assignment]));
    return Array.from(unique.values());
  }

  await delay(200);
  const all = (localStorageGet(STORAGE_KEYS.ASSIGNMENTS) || []) as any[];
  return all.filter((a: any) => {
    const matchesUserId =
      athleteId !== null &&
      athleteId !== undefined &&
      String(athleteId) !== "" &&
      String(a.target_user_id) === String(athleteId);
    const matchesUser = matchesUserId || a.target_athlete === athleteName;
    if (!matchesUser) return false;
    if (options?.assignmentType && a.session_type !== options.assignmentType) return false;
    if (options?.status) return a.status === options.status;
    return a.status !== "completed";
  });
}

export async function assignments_create(
  data: {
    assignment_type?: "swim" | "strength";
    session_type?: "swim" | "strength";
    session_id: number;
    target_athlete?: string;
    target_user_id?: number | null;
    target_group_id?: number | null;
    assigned_date?: string;
    scheduled_date?: string;
    scheduled_slot?: "morning" | "evening";
  },
  currentUserId?: number | null,
) {
  const assignmentType = data.assignment_type ?? data.session_type;
  if (!assignmentType) return { status: "error" };
  const scheduledDate =
    data.scheduled_date ?? data.assigned_date ?? new Date().toISOString();
  if (canUseSupabase()) {
    const insertPayload: Record<string, unknown> = {
      assignment_type: assignmentType,
      scheduled_date: scheduledDate,
      scheduled_slot: data.scheduled_slot ?? null,
      assigned_by: currentUserId ?? null,
      status: "assigned",
    };
    if (assignmentType === "swim") {
      insertPayload.swim_catalog_id = data.session_id;
    } else {
      insertPayload.strength_session_id = data.session_id;
    }
    if (data.target_user_id !== null && data.target_user_id !== undefined) {
      insertPayload.target_user_id = data.target_user_id;
    } else if (data.target_group_id !== null && data.target_group_id !== undefined) {
      insertPayload.target_group_id = data.target_group_id;
    }
    const { data: created, error } = await supabase
      .from("session_assignments")
      .insert(insertPayload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    // Create notification
    const { data: notif, error: notifError } = await supabase
      .from("notifications")
      .insert({
        title: "Nouvelle séance assignée",
        body: `Séance prévue le ${scheduledDate}.`,
        type: "assignment",
      })
      .select("id")
      .single();
    if (!notifError && notif) {
      const targetPayload: Record<string, unknown> = { notification_id: notif.id };
      if (data.target_user_id) targetPayload.target_user_id = data.target_user_id;
      if (data.target_group_id) targetPayload.target_group_id = data.target_group_id;
      await supabase.from("notification_targets").insert(targetPayload);
    }
    return { status: "assigned" };
  }

  // Fetch source session to copy details (simplification for mock)
  let source: any;
  if (assignmentType === "swim") {
    source = ((localStorageGet(STORAGE_KEYS.SWIM_SESSIONS) || []) as any[]).find(
      (s: any) => s.id === data.session_id,
    );
  } else {
    source = ((localStorageGet(STORAGE_KEYS.STRENGTH_SESSIONS) || []) as any[]).find(
      (s: any) => s.id === data.session_id,
    );
  }

  if (!source) return { status: "error" };

  const assignment = {
    id: Date.now(),
    session_id: data.session_id,
    session_type: assignmentType,
    target_athlete: data.target_athlete ?? "",
    target_user_id: data.target_user_id ?? null,
    target_group_id: data.target_group_id ?? null,
    assigned_date: scheduledDate,
    title: source.name ?? source.title,
    description: source.description,
    items: source.items,
    status: "assigned",
  };

  const all = (localStorageGet(STORAGE_KEYS.ASSIGNMENTS) || []) as any[];
  localStorageSave(STORAGE_KEYS.ASSIGNMENTS, [...all, assignment]);

  // Create Notification
  const notifs = (localStorageGet(STORAGE_KEYS.NOTIFICATIONS) || []) as any[];
  localStorageSave(STORAGE_KEYS.NOTIFICATIONS, [
    ...notifs,
    {
      id: Date.now() + 1,
      sender: "Coach",
      target_athlete: data.target_athlete,
      target_user_id: data.target_user_id ?? null,
      target_group_id: data.target_group_id ?? null,
      title: "Nouvelle séance assignée",
      message: `Séance ${source.title ?? source.name} prévue le ${scheduledDate}.`,
      type: "assignment",
      related_id: assignment.id,
      read: false,
      date: new Date().toISOString(),
    },
  ]);

  return { status: "assigned" };
}

export async function assignments_delete(assignmentId: number) {
  if (canUseSupabase()) {
    const { error } = await supabase
      .from("session_assignments")
      .delete()
      .eq("id", assignmentId);
    if (error) throw new Error(error.message);
    return { status: "deleted" };
  }

  const assignments = (localStorageGet(STORAGE_KEYS.ASSIGNMENTS) || []) as any[];
  const updated = assignments.filter((assignment: any) => assignment.id !== assignmentId);
  localStorageSave(STORAGE_KEYS.ASSIGNMENTS, updated);
  return { status: "deleted" };
}
