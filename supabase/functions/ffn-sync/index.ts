// supabase/functions/ffn-sync/index.ts
// Edge Function: Sync FFN (Fédération Française de Natation) records for an athlete
// Scrapes the FFN Extranat website for best personal performances and upserts into swim_records

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser, Element } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const FFN_BASE = "https://ffn.extranat.fr/webffn";

// --- Utility functions (ported from cloudflare-worker/src/ffn.js) ---

function clean(v: string | null | undefined): string {
  return String(v ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseFfnTimeToSeconds(raw: string): number | null {
  const s = clean(raw);
  if (!s) return null;

  const m = s.match(/(\d{1,2}):(\d{2})\.(\d{1,2})|(\d{1,2})\.(\d{1,2})/);
  if (!m) return null;

  // mm:ss.xx
  if (m[1] != null && m[2] != null && m[3] != null) {
    const mm = Number(m[1]);
    const ss = Number(m[2]);
    const cs = Number(m[3].padEnd(2, "0"));
    if (![mm, ss, cs].every(Number.isFinite)) return null;
    return mm * 60 + ss + cs / 100;
  }

  // ss.xx
  if (m[4] != null && m[5] != null) {
    const ss = Number(m[4]);
    const cs = Number(m[5].padEnd(2, "0"));
    if (![ss, cs].every(Number.isFinite)) return null;
    return ss + cs / 100;
  }

  return null;
}

function parseFfnDateToIso(raw: string): string | null {
  const s = clean(raw);
  if (!s) return null;

  const m1 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;

  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;

  return null;
}

function extractDateFromTexts(texts: string[]): string | null {
  for (const t of texts) {
    const m = clean(t).match(/(\d{2}\/\d{2}\/\d{4})/);
    if (m) return m[1];
  }
  return null;
}

function extractPointsFromTexts(texts: string[]): number | null {
  for (const t of texts) {
    const s = clean(t);
    if (/pts/i.test(s)) {
      const m = s.match(/(\d{1,5})/);
      if (m) {
        const n = Number(m[1]);
        return Number.isFinite(n) ? n : null;
      }
    }
  }
  return null;
}

// --- FFN HTML fetching ---

async function fetchFfnHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "suivi-natation/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `FFN HTTP ${res.status} ${res.statusText}${body ? " — " + body.slice(0, 120) : ""}`,
      );
    }

    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

// --- MPP parsing using deno-dom ---

interface MppRecord {
  event_name: string;
  pool_length: number;
  time_seconds: number;
  record_date: string | null;
  ffn_points: number | null;
}

function parseMppFromHtml(html: string, defaultPoolLength: number): MppRecord[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return [];

  const results: MppRecord[] = [];

  // Track current pool as we walk through sections
  let currentPool: number = defaultPoolLength;

  // First pass: find all pool section markers and their positions
  // FFN pages have sections like "Bassin : 25 m" or "Bassin : 50 m"
  const allElements = Array.from(doc.querySelectorAll("*"));
  const poolMarkers: Array<{ index: number; pool: number }> = [];

  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i] as Element;
    const text = clean(el.textContent ?? "");

    // Detect pool section headers (but not in table cells)
    const poolMatch = text.match(/Bassin\s*:\s*(25|50)\s*m/i);
    if (poolMatch && el.tagName !== "TR" && el.tagName !== "TD" && el.tagName !== "TH") {
      poolMarkers.push({ index: i, pool: Number(poolMatch[1]) });
    }
  }

  // Parse table rows with pool context
  const rows = doc.querySelectorAll("tr");
  for (const rowNode of rows) {
    const row = rowNode as Element;
    const cells = row.querySelectorAll("td, th");
    if (cells.length < 2) continue;

    const cellTexts: string[] = [];
    for (const cell of cells) {
      cellTexts.push(clean(cell.textContent ?? ""));
    }

    const eventName = cellTexts[0];
    const timeRaw = cellTexts[1];
    if (!eventName || !timeRaw) continue;

    const timeSeconds = parseFfnTimeToSeconds(timeRaw);
    if (timeSeconds == null) continue;

    // Skip header rows
    if (/épreuve|epreuve|nage/i.test(eventName) && /temps/i.test(timeRaw)) continue;

    // Try to detect pool from the row content (some FFN pages include "25m" or "50m" in the event)
    let detectedPool: number | null = null;
    const rowText = cellTexts.join(" ");
    const rowPoolMatch = rowText.match(/\b(25|50)\s*m\b/i);
    if (rowPoolMatch) {
      detectedPool = Number(rowPoolMatch[1]);
    }

    const dateRaw = extractDateFromTexts(cellTexts);
    const points = extractPointsFromTexts(cellTexts);

    results.push({
      event_name: eventName,
      // Use detected pool from row, or fall back to default (from URL parameter)
      pool_length: detectedPool ?? defaultPoolLength,
      time_seconds: timeSeconds,
      record_date: parseFfnDateToIso(dateRaw ?? "") || null,
      ffn_points: points,
    });
  }

  // Deduplicate by event_name + pool_length (keep best time)
  const bestByKey = new Map<string, MppRecord>();
  for (const r of results) {
    const key = `${r.event_name}__${r.pool_length}`;
    const existing = bestByKey.get(key);
    if (!existing || r.time_seconds < existing.time_seconds) {
      bestByKey.set(key, r);
    }
  }

  return Array.from(bestByKey.values());
}

async function fetchFfnMpp(iuf: string, poolLength: number): Promise<MppRecord[]> {
  const id = clean(iuf);
  if (!/^\d{5,10}$/.test(id)) throw new Error("IUF invalide (attendu: 5 à 10 chiffres)");

  const url =
    `${FFN_BASE}/nat_recherche.php` +
    `?idact=nat` +
    `&idbas=${encodeURIComponent(String(poolLength))}` +
    `&idrch_id=${encodeURIComponent(id)}` +
    `&idiuf=${encodeURIComponent(id)}`;

  const html = await fetchFfnHtml(url);
  return parseMppFromHtml(html, poolLength);
}

async function fetchFfnBestPerformances(iuf: string): Promise<MppRecord[]> {
  const [mpp25, mpp50] = await Promise.all([
    fetchFfnMpp(iuf, 25).catch(() => []),
    fetchFfnMpp(iuf, 50).catch(() => []),
  ]);

  // Merge and deduplicate - keep best time for each event+pool combo
  const allRecords = [...mpp25, ...mpp50];
  const bestByKey = new Map<string, MppRecord>();

  for (const r of allRecords) {
    const key = `${r.event_name}__${r.pool_length}`;
    const existing = bestByKey.get(key);
    if (!existing || r.time_seconds < existing.time_seconds) {
      bestByKey.set(key, r);
    }
  }

  return Array.from(bestByKey.values());
}

// --- Main handler ---

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const body = await req.json();
    const { athlete_id, athlete_name, iuf } = body;

    if (!athlete_id || !iuf) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: athlete_id and iuf" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const cleanIuf = clean(iuf);
    if (!/^\d{5,10}$/.test(cleanIuf)) {
      return new Response(
        JSON.stringify({ error: "IUF invalide (attendu: 5 à 10 chiffres)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch best performances from FFN for both pool sizes
    let records: MppRecord[];
    try {
      records = await fetchFfnBestPerformances(cleanIuf);
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: "Impossible de contacter l'API FFN",
          details: err instanceof Error ? err.message : String(err),
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (records.length === 0) {
      return new Response(
        JSON.stringify({ status: "ok", inserted: 0, updated: 0, skipped: 0, message: "No records found on FFN for this IUF" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Upsert records into swim_records
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const rec of records) {
      // Check if a record already exists for this athlete/event/pool
      const { data: existing } = await supabase
        .from("swim_records")
        .select("id, time_seconds")
        .eq("athlete_id", athlete_id)
        .eq("event_name", rec.event_name)
        .eq("pool_length", rec.pool_length)
        .maybeSingle();

      const notes = [
        athlete_name ? `Nageur: ${athlete_name}` : null,
        rec.ffn_points ? `${rec.ffn_points} pts FFN` : null,
      ]
        .filter(Boolean)
        .join(" | ") || null;

      if (existing) {
        // Update only if the new time is better (lower)
        if (rec.time_seconds < (existing.time_seconds ?? Infinity)) {
          const { error } = await supabase
            .from("swim_records")
            .update({
              time_seconds: rec.time_seconds,
              record_date: rec.record_date,
              record_type: "comp",
              notes,
            })
            .eq("id", existing.id);

          if (error) {
            console.error(`Update error for ${rec.event_name}:`, error);
            skipped++;
          } else {
            updated++;
          }
        } else {
          skipped++;
        }
      } else {
        // Insert new record
        const { error } = await supabase
          .from("swim_records")
          .insert({
            athlete_id,
            event_name: rec.event_name,
            pool_length: rec.pool_length,
            time_seconds: rec.time_seconds,
            record_date: rec.record_date,
            record_type: "comp",
            notes,
          });

        if (error) {
          console.error(`Insert error for ${rec.event_name}:`, error);
          skipped++;
        } else {
          inserted++;
        }
      }
    }

    return new Response(
      JSON.stringify({ status: "ok", inserted, updated, skipped }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("ffn-sync error:", err);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
