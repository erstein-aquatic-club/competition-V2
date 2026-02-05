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

/**
 * Parse FFN HTML page to extract swim records.
 * FFN pages have sections like "Bassin : 25 m" followed by a table of records,
 * then "Bassin : 50 m" with another table.
 * We walk through ALL elements in DOM order to track which pool section we're in.
 */
function parseMppFromHtml(html: string): MppRecord[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return [];

  const results: MppRecord[] = [];

  // Track current pool as we walk through sections (default to null = unknown)
  let currentPool: number | null = null;

  // Get all elements in DOM order using TreeWalker-like approach
  const body = doc.body ?? doc.documentElement;
  if (!body) return [];

  // Recursive function to walk DOM in order
  function walkNode(node: Node) {
    // Check if this node contains a pool section marker
    if (node.nodeType === 1) { // Element node
      const el = node as Element;
      const tagName = el.tagName?.toUpperCase() ?? "";

      // Look for pool markers in section headers (non-table elements)
      // Use full textContent since "Bassin : 25 m" might be in nested spans/b tags
      if (tagName !== "TR" && tagName !== "TD" && tagName !== "TH" && tagName !== "TABLE" && tagName !== "TBODY") {
        const fullText = clean(el.textContent ?? "");
        // Only match if this element directly contains the pool marker (not inherited from descendants)
        // Check if this element's first text matches the pattern
        const poolMatch = fullText.match(/Bassin\s*:\s*(25|50)\s*m/i);
        if (poolMatch) {
          // Verify it's a direct match, not from a table cell child
          const hasTableChild = el.querySelector("table, tr, td, th");
          if (!hasTableChild) {
            const newPool = Number(poolMatch[1]);
            if (newPool !== currentPool) {
              console.log(`[ffn-sync] Pool section detected: ${newPool}m`);
            }
            currentPool = newPool;
          }
        }
      }

      // Parse table rows
      if (tagName === "TR") {
        const cells = el.querySelectorAll("td, th");
        if (cells.length >= 2) {
          const cellTexts: string[] = [];
          for (const cell of cells) {
            cellTexts.push(clean(cell.textContent ?? ""));
          }

          const eventName = cellTexts[0];
          const timeRaw = cellTexts[1];

          if (eventName && timeRaw) {
            const timeSeconds = parseFfnTimeToSeconds(timeRaw);

            // Skip header rows and invalid times
            if (timeSeconds != null && !/épreuve|epreuve|nage/i.test(eventName)) {
              const dateRaw = extractDateFromTexts(cellTexts);
              const points = extractPointsFromTexts(cellTexts);

              // Only add if we know the pool
              if (currentPool !== null) {
                results.push({
                  event_name: eventName,
                  pool_length: currentPool,
                  time_seconds: timeSeconds,
                  record_date: parseFfnDateToIso(dateRaw ?? "") || null,
                  ffn_points: points,
                });
              }
            }
          }
        }
      }
    }

    // Walk children
    for (const child of Array.from(node.childNodes)) {
      walkNode(child);
    }
  }

  // Helper to get direct text content (not from children)
  function getDirectTextContent(el: Element): string {
    let text = "";
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === 3) { // Text node
        text += child.textContent ?? "";
      }
    }
    return clean(text);
  }

  walkNode(body);

  console.log(`[ffn-sync] Parsed ${results.length} raw records from HTML`);
  const poolCounts = results.reduce((acc, r) => {
    acc[r.pool_length] = (acc[r.pool_length] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);
  console.log(`[ffn-sync] Pool distribution:`, poolCounts);

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

async function fetchFfnMpp(iuf: string): Promise<MppRecord[]> {
  const id = clean(iuf);
  if (!/^\d{5,10}$/.test(id)) throw new Error("IUF invalide (attendu: 5 à 10 chiffres)");

  // Fetch without idbas filter - let the parser detect pool from HTML sections
  const url =
    `${FFN_BASE}/nat_recherche.php` +
    `?idact=nat` +
    `&idrch_id=${encodeURIComponent(id)}` +
    `&idiuf=${encodeURIComponent(id)}`;

  const html = await fetchFfnHtml(url);
  return parseMppFromHtml(html);
}

async function fetchFfnBestPerformances(iuf: string): Promise<MppRecord[]> {
  // Single fetch - parser will detect both 25m and 50m sections from HTML
  return fetchFfnMpp(iuf);
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
