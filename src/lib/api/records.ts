/**
 * API Records - Records and hall of fame methods
 */

import {
  supabase,
  canUseSupabase,
  delay,
  STORAGE_KEYS,
} from './client';
import type {
  Session,
  ClubRecord,
  ClubRecordSwimmer,
  SwimmerPerformance,
} from './types';
import { localStorageGet, localStorageSave } from './localStorage';

export async function getHallOfFame() {
  if (canUseSupabase()) {
    const { data: rpcData, error: rpcError } = await supabase.rpc("get_hall_of_fame");
    if (!rpcError && rpcData) {
      const hallOfFame = Array.isArray(rpcData) ? rpcData : [];
      const swimDistance = [...hallOfFame]
        .map((item: any) => ({
          athlete_name: item.athlete_name,
          total_distance: Number(item.total_distance ?? 0),
        }))
        .sort((a, b) => b.total_distance - a.total_distance)
        .slice(0, 5);
      const swimPerformance = [...hallOfFame]
        .map((item: any) => ({
          athlete_name: item.athlete_name,
          avg_effort: Number(item.avg_performance ?? item.avg_engagement ?? 0),
        }))
        .sort((a, b) => b.avg_effort - a.avg_effort)
        .slice(0, 5);
      const swimEngagement = [...hallOfFame]
        .map((item: any) => ({
          athlete_name: item.athlete_name,
          avg_engagement: Number(item.avg_engagement ?? 0),
        }))
        .sort((a, b) => b.avg_engagement - a.avg_engagement)
        .slice(0, 5);
      return {
        distance: swimDistance,
        performance: swimPerformance,
        engagement: swimEngagement,
        strength: [] as any[],
      };
    }
  }

  await delay(300);
  const sessions = (localStorageGet(STORAGE_KEYS.SESSIONS) || []) as Session[];
  const runs = (localStorageGet(STORAGE_KEYS.STRENGTH_RUNS) || []) as any[];

  // Swim Stats
  const map = new Map();
  sessions.forEach((s: Session) => {
    if (!map.has(s.athlete_name)) {
      map.set(s.athlete_name, {
        distance: 0,
        effortSum: 0,
        count: 0,
        engagementSum: 0,
        engagementCount: 0,
      });
    }
    const entry = map.get(s.athlete_name);
    entry.distance += s.distance;
    entry.effortSum += s.effort;
    entry.count += 1;
    if (
      s.engagement !== null &&
      s.engagement !== undefined &&
      Number.isFinite(s.engagement)
    ) {
      entry.engagementSum += s.engagement;
      entry.engagementCount += 1;
    }
  });

  const swimRes = Array.from(map.entries()).map(([name, stats]) => ({
    athlete_name: name,
    total_distance: stats.distance,
    avg_effort: stats.effortSum / stats.count,
    avg_engagement: stats.engagementCount
      ? stats.engagementSum / stats.engagementCount
      : 0,
  }));

  // Strength Stats
  const sMap = new Map();
  runs.forEach((r: any) => {
    if (!sMap.has(r.athlete_name)) {
      sMap.set(r.athlete_name, { volume: 0, reps: 0, sets: 0, maxWeight: 0 });
    }
    const entry = sMap.get(r.athlete_name);
    if (r.logs) {
      r.logs.forEach((l: any) => {
        const reps = Number(l.reps ?? 0);
        const weight = Number(l.weight ?? 0);
        entry.volume += reps * weight;
        entry.reps += reps;
        entry.sets += 1;
        if (weight > entry.maxWeight) {
          entry.maxWeight = weight;
        }
      });
    }
  });

  const strengthRes = Array.from(sMap.entries()).map(([name, stats]) => ({
    athlete_name: name,
    total_volume: stats.volume,
    total_reps: stats.reps,
    total_sets: stats.sets,
    max_weight: stats.maxWeight,
  }));

  return {
    distance: [...swimRes]
      .sort((a, b) => b.total_distance - a.total_distance)
      .slice(0, 5),
    performance: [...swimRes]
      .sort((a, b) => b.avg_effort - a.avg_effort)
      .slice(0, 5),
    engagement: [...swimRes]
      .sort((a, b) => b.avg_engagement - a.avg_engagement)
      .slice(0, 5),
    strength: [...strengthRes]
      .sort((a, b) => b.total_volume - a.total_volume)
      .slice(0, 5),
  };
}

export async function getClubRecords(filters: {
  pool_m?: number | null;
  sex?: string | null;
  age?: number | null;
  event_code?: string | null;
}): Promise<ClubRecord[]> {
  if (!canUseSupabase()) return [];
  let query = supabase.from("club_records").select("*");
  if (filters.pool_m) query = query.eq("pool_m", filters.pool_m);
  if (filters.sex) query = query.eq("sex", filters.sex);
  if (filters.age) query = query.eq("age", filters.age);
  if (filters.event_code) query = query.eq("event_code", filters.event_code);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getClubRecordSwimmers(): Promise<ClubRecordSwimmer[]> {
  if (!canUseSupabase()) return [];
  const { data, error } = await supabase.from("club_record_swimmers").select("*");
  if (error) throw new Error(error.message);
  return (data ?? []).map((s: any) => ({ ...s, is_active: s.is_active ? 1 : 0 }));
}

export async function createClubRecordSwimmer(payload: {
  display_name: string;
  iuf?: string | null;
  sex?: "M" | "F" | null;
  birthdate?: string | null;
  is_active?: boolean;
}): Promise<ClubRecordSwimmer | null> {
  if (!canUseSupabase()) return null;
  const { data, error } = await supabase
    .from("club_record_swimmers")
    .insert({
      source_type: "manual",
      display_name: payload.display_name,
      iuf: payload.iuf ?? null,
      sex: payload.sex ?? null,
      birthdate: payload.birthdate ?? null,
      is_active: payload.is_active !== false,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data ? { ...data, is_active: data.is_active ? 1 : 0 } : null;
}

export async function updateClubRecordSwimmer(
  id: number,
  payload: {
    iuf?: string | null;
    is_active?: boolean;
    sex?: "M" | "F" | null;
    birthdate?: string | null;
  },
): Promise<ClubRecordSwimmer | null> {
  if (!canUseSupabase()) return null;
  const updatePayload: Record<string, unknown> = {};
  if (payload.iuf !== undefined) updatePayload.iuf = payload.iuf;
  if (payload.is_active !== undefined) updatePayload.is_active = payload.is_active;
  if (payload.sex !== undefined) updatePayload.sex = payload.sex;
  if (payload.birthdate !== undefined) updatePayload.birthdate = payload.birthdate;
  const { data, error } = await supabase
    .from("club_record_swimmers")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data ? { ...data, is_active: data.is_active ? 1 : 0 } : null;
}

export async function updateClubRecordSwimmerForUser(
  userId: number,
  payload: {
    iuf?: string | null;
    is_active?: boolean;
    sex?: "M" | "F" | null;
    birthdate?: string | null;
  },
): Promise<ClubRecordSwimmer | null> {
  if (!canUseSupabase()) return null;
  const updatePayload: Record<string, unknown> = {};
  if (payload.iuf !== undefined) updatePayload.iuf = payload.iuf;
  if (payload.is_active !== undefined) updatePayload.is_active = payload.is_active;
  if (payload.sex !== undefined) updatePayload.sex = payload.sex;
  if (payload.birthdate !== undefined) updatePayload.birthdate = payload.birthdate;
  const { data, error } = await supabase
    .from("club_record_swimmers")
    .update(updatePayload)
    .eq("user_id", userId)
    .eq("source_type", "user")
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data ? { ...data, is_active: data.is_active ? 1 : 0 } : null;
}

export async function importClubRecords(): Promise<any> {
  if (!canUseSupabase()) return null;
  const { data, error } = await supabase.functions.invoke("import-club-records");
  if (error) throw new Error(error.message);
  return data?.summary ?? data;
}

export async function getImportLogs(filters?: {
  swimmerIuf?: string;
  limit?: number;
}): Promise<any[]> {
  if (!canUseSupabase()) return [];
  let query = supabase
    .from("import_logs")
    .select("*")
    .order("started_at", { ascending: false });
  if (filters?.swimmerIuf) query = query.eq("swimmer_iuf", filters.swimmerIuf);
  if (filters?.limit) query = query.limit(filters.limit);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function importSingleSwimmer(
  swimmerIuf: string,
  _swimmerName?: string,
): Promise<{
  total_found: number;
  new_imported: number;
  already_existed: number;
}> {
  if (!canUseSupabase()) throw new Error("Supabase not configured");
  const { data, error } = await supabase.functions.invoke("ffn-performances", {
    body: { swimmer_iuf: swimmerIuf },
  });
  if (error) throw new Error(error.message);
  return (data ?? {
    total_found: 0,
    new_imported: 0,
    already_existed: 0,
  }) as { total_found: number; new_imported: number; already_existed: number };
}

export async function getSwimRecords(options: {
  athleteId?: number | null;
  athleteName?: string | null;
}) {
  if (canUseSupabase()) {
    let query = supabase
      .from("swim_records")
      .select("*")
      .order("record_date", { ascending: false });
    if (options.athleteId) {
      query = query.eq("athlete_id", options.athleteId);
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const records = data ?? [];
    return {
      records,
      pagination: { limit: records.length, offset: 0, total: records.length },
    };
  }

  const records = (localStorageGet(STORAGE_KEYS.SWIM_RECORDS) || []) as any[];
  const filtered = records.filter((r: any) => {
    if (options.athleteId) return r.athlete_id === options.athleteId;
    if (options.athleteName) return r.athlete_name === options.athleteName;
    return false;
  });
  return {
    records: filtered,
    pagination: { limit: filtered.length, offset: 0, total: filtered.length },
  };
}

export async function upsertSwimRecord(payload: {
  id?: number | null;
  athlete_id?: number | null;
  athleteName?: string | null;
  athlete_name?: string | null;
  event_name: string;
  pool_length?: number | null;
  time_seconds?: number | null;
  record_date?: string | null;
  notes?: string | null;
  ffn_points?: number | null;
  record_type?: "training" | "comp" | string | null;
}) {
  if (canUseSupabase()) {
    const dbPayload: Record<string, unknown> = {
      athlete_id: payload.athlete_id ?? null,
      event_name: payload.event_name,
      pool_length: payload.pool_length ?? null,
      time_seconds: payload.time_seconds ?? null,
      record_date: payload.record_date ?? null,
      notes: payload.notes ?? null,
    };
    if (payload.id) {
      const { error } = await supabase
        .from("swim_records")
        .update(dbPayload)
        .eq("id", payload.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("swim_records").insert(dbPayload);
      if (error) throw new Error(error.message);
    }
    return { status: "ok" };
  }

  const records = (localStorageGet(STORAGE_KEYS.SWIM_RECORDS) || []) as any[];
  if (payload.id) {
    const updated = records.map((record: any) =>
      record.id === payload.id
        ? { ...record, ...payload, athlete_id: payload.athlete_id ?? record.athlete_id }
        : record,
    );
    localStorageSave(STORAGE_KEYS.SWIM_RECORDS, updated);
    return { status: "ok" };
  }
  const created = {
    ...payload,
    id: Date.now(),
    athlete_id: payload.athlete_id ?? -1,
    athlete_name: payload.athleteName ?? null,
  };
  localStorageSave(STORAGE_KEYS.SWIM_RECORDS, [...records, created]);
  return { status: "created" };
}

export async function getSwimmerPerformances(filters: {
  userId?: number;
  iuf?: string;
  eventCode?: string;
  poolLength?: number;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}): Promise<SwimmerPerformance[]> {
  if (!canUseSupabase()) return [];
  let query = supabase
    .from("swimmer_performances")
    .select("*")
    .order("competition_date", { ascending: false });
  if (filters.userId) query = query.eq("user_id", filters.userId);
  if (filters.iuf) query = query.eq("swimmer_iuf", filters.iuf);
  if (filters.eventCode) query = query.eq("event_code", filters.eventCode);
  if (filters.poolLength) query = query.eq("pool_length", filters.poolLength);
  if (filters.fromDate) query = query.gte("competition_date", filters.fromDate);
  if (filters.toDate) query = query.lte("competition_date", filters.toDate);
  if (filters.limit) query = query.limit(filters.limit);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function importSwimmerPerformances(params: {
  iuf: string;
  userId?: number;
}): Promise<{
  total_found: number;
  new_imported: number;
  already_existed: number;
}> {
  if (!canUseSupabase()) throw new Error("Supabase not configured");
  const { data, error } = await supabase.functions.invoke("ffn-performances", {
    body: { swimmer_iuf: params.iuf, user_id: params.userId ?? null },
  });
  if (error) throw new Error(error.message);
  return (data ?? {
    total_found: 0,
    new_imported: 0,
    already_existed: 0,
  }) as { total_found: number; new_imported: number; already_existed: number };
}
