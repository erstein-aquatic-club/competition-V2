/**
 * API Swim - Swim catalog methods
 */

import {
  supabase,
  canUseSupabase,
  safeInt,
  safeOptionalInt,
  parseRawPayload,
  STORAGE_KEYS,
} from './client';
import type { SwimSessionTemplate, SwimSessionItem } from './types';
import { localStorageGet, localStorageSave } from './localStorage';

export async function getSwimCatalog(): Promise<SwimSessionTemplate[]> {
  if (canUseSupabase()) {
    const { data: catalogs, error } = await supabase
      .from("swim_sessions_catalog")
      .select("*, swim_session_items(*)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (catalogs ?? []).map((catalog: any) => ({
      id: safeInt(catalog.id, Date.now()),
      name: String(catalog.name || ""),
      description: catalog.description ?? null,
      created_by: safeOptionalInt(catalog.created_by) ?? null,
      created_at: catalog.created_at ?? null,
      updated_at: catalog.updated_at ?? null,
      items: Array.isArray(catalog.swim_session_items)
        ? catalog.swim_session_items
            .sort((a: any, b: any) => (a.ordre ?? 0) - (b.ordre ?? 0))
            .map((item: any, index: number) => ({
              id: safeOptionalInt(item.id) ?? undefined,
              catalog_id: safeOptionalInt(item.catalog_id) ?? undefined,
              ordre: safeOptionalInt(item.ordre) ?? index,
              label: item.label ?? null,
              distance: safeOptionalInt(item.distance) ?? null,
              duration: safeOptionalInt(item.duration) ?? null,
              intensity: item.intensity ?? null,
              notes: item.notes ?? null,
              raw_payload: parseRawPayload(item.raw_payload),
            }))
        : [],
    }));
  }

  const raw = (localStorageGet(STORAGE_KEYS.SWIM_SESSIONS) || []) as any[];
  return raw.map((catalog: any) => ({
    id: safeInt(catalog.id, Date.now()),
    name: String(catalog.name || catalog.title || ""),
    description: catalog.description ?? null,
    created_by: safeOptionalInt(catalog.created_by) ?? null,
    created_at: catalog.created_at ?? null,
    updated_at: catalog.updated_at ?? null,
    items: Array.isArray(catalog.items)
      ? catalog.items.map((item: any, index: number) => ({
          id: safeOptionalInt(item.id) ?? undefined,
          catalog_id: safeOptionalInt(item.catalog_id) ?? undefined,
          ordre: safeOptionalInt(item.ordre) ?? index,
          label: item.label ?? item.section ?? null,
          distance: safeOptionalInt(item.distance) ?? null,
          duration: safeOptionalInt(item.duration) ?? null,
          intensity: item.intensity ?? null,
          notes: item.notes ?? item.instruction ?? null,
          raw_payload:
            parseRawPayload(item.raw_payload) ??
            (item.section || item.stroke || item.instruction || item.rest
              ? {
                  section: item.section,
                  stroke: item.stroke,
                  instruction: item.instruction,
                  rest: item.rest,
                }
              : null),
        }))
      : [],
  }));
}

export async function createSwimSession(session: any) {
  if (canUseSupabase()) {
    const items = Array.isArray(session.items)
      ? session.items.map((item: any, index: number) => ({
          ordre: item.ordre ?? index,
          label: item.label ?? null,
          distance: item.distance ?? null,
          duration: item.duration ?? null,
          intensity: item.intensity ?? null,
          notes: item.notes ?? null,
          raw_payload: item.raw_payload ?? null,
        }))
      : [];
    if (session.id) {
      // Update existing
      const { error } = await supabase
        .from("swim_sessions_catalog")
        .update({
          name: session.name,
          description: session.description ?? null,
        })
        .eq("id", session.id);
      if (error) throw new Error(error.message);
      await supabase.from("swim_session_items").delete().eq("catalog_id", session.id);
      if (items.length > 0) {
        const { error: itemsError } = await supabase
          .from("swim_session_items")
          .insert(items.map((item: any) => ({ ...item, catalog_id: session.id })));
        if (itemsError) throw new Error(itemsError.message);
      }
      return { status: "updated" };
    }
    // Create new
    const { data: created, error } = await supabase
      .from("swim_sessions_catalog")
      .insert({
        name: session.name,
        description: session.description ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (items.length > 0) {
      const { error: itemsError } = await supabase
        .from("swim_session_items")
        .insert(items.map((item: any) => ({ ...item, catalog_id: created.id })));
      if (itemsError) throw new Error(itemsError.message);
    }
    return { status: "created" };
  }

  const s = (localStorageGet(STORAGE_KEYS.SWIM_SESSIONS) || []) as any[];
  if (session.id) {
    const exists = s.some((entry: any) => entry.id === session.id);
    const updated = exists
      ? s.map((entry: any) => (entry.id === session.id ? { ...entry, ...session } : entry))
      : [...s, { ...session, id: session.id }];
    localStorageSave(STORAGE_KEYS.SWIM_SESSIONS, updated);
    return { status: exists ? "updated" : "created" };
  }
  localStorageSave(STORAGE_KEYS.SWIM_SESSIONS, [...s, { ...session, id: Date.now() }]);
  return { status: "created" };
}

export async function deleteSwimSession(sessionId: number) {
  if (canUseSupabase()) {
    const { error } = await supabase
      .from("swim_sessions_catalog")
      .delete()
      .eq("id", sessionId);
    if (error) throw new Error(error.message);
    return { status: "deleted" };
  }
  const sessions = (localStorageGet(STORAGE_KEYS.SWIM_SESSIONS) || []) as any[];
  const updatedSessions = sessions.filter(
    (session: SwimSessionTemplate) => session.id !== sessionId,
  );
  localStorageSave(STORAGE_KEYS.SWIM_SESSIONS, updatedSessions);
  return { status: "deleted" };
}
