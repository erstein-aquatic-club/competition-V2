import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function clean(v: string): string {
  return v.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function parseTime(s: string): number | null {
  const m = s.match(/(\d+):(\d+)\.(\d+)|(\d+)\.(\d+)/);
  if (!m) return null;
  if (m[1]) return Number(m[1]) * 60 + Number(m[2]) + Number(m[3].padEnd(2, "0")) / 100;
  if (m[4]) return Number(m[4]) + Number(m[5].padEnd(2, "0")) / 100;
  return null;
}

function parseDate(s: string): string | null {
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

interface Rec { event_name: string; pool_length: number; time_seconds: number; record_date: string | null; ffn_points: number | null; }

function parseHtml(html: string): Rec[] {
  const results: Rec[] = [];
  const parts = html.split(/Bassin\s*:\s*(25|50)\s*m/gi);
  let pool: number | null = null;

  for (const part of parts) {
    if (/^(25|50)$/.test(part.trim())) { pool = Number(part); continue; }
    if (!pool) continue;

    const rows = part.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
    for (const row of rows) {
      const cells = (row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || []).map(c => clean(c.replace(/<[^>]*>/g, "")));
      if (cells.length < 2) continue;
      const time = parseTime(cells[1]);
      if (!time || /épreuve|nage/i.test(cells[0])) continue;

      let date: string | null = null, pts: number | null = null;
      for (const c of cells.slice(2)) {
        if (!date) date = parseDate(c);
        if (!pts && /pts/i.test(c)) { const m = c.match(/(\d+)/); if (m) pts = Number(m[1]); }
      }
      results.push({ event_name: cells[0], pool_length: pool, time_seconds: time, record_date: date, ffn_points: pts });
    }
  }

  const best = new Map<string, Rec>();
  for (const r of results) {
    const k = `${r.event_name}__${r.pool_length}`;
    if (!best.has(k) || r.time_seconds < best.get(k)!.time_seconds) best.set(k, r);
  }
  console.log("[ffn] pools:", [...best.values()].reduce((a, r) => { a[r.pool_length] = (a[r.pool_length] || 0) + 1; return a; }, {} as Record<number, number>));
  return [...best.values()];
}

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const { athlete_id, athlete_name, iuf } = await req.json();
    if (!athlete_id || !iuf) return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

    const res = await fetch(`https://ffn.extranat.fr/webffn/nat_recherche.php?idact=nat&idrch_id=${iuf}&idiuf=${iuf}`, { headers: { "User-Agent": "suivi-natation/1.0" } });
    if (!res.ok) return new Response(JSON.stringify({ error: "FFN error" }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });

    const records = parseHtml(await res.text());
    let ins = 0, upd = 0, skip = 0;

    for (const r of records) {
      const { data: ex } = await supabase.from("swim_records").select("id, time_seconds").eq("athlete_id", athlete_id).eq("event_name", r.event_name).eq("pool_length", r.pool_length).maybeSingle();
      const notes = [athlete_name ? `Nageur: ${athlete_name}` : null, r.ffn_points ? `${r.ffn_points} pts FFN` : null].filter(Boolean).join(" | ") || null;

      if (ex) {
        if (r.time_seconds < (ex.time_seconds ?? Infinity)) {
          await supabase.from("swim_records").update({ time_seconds: r.time_seconds, record_date: r.record_date, record_type: "comp", notes }).eq("id", ex.id);
          upd++;
        } else skip++;
      } else {
        await supabase.from("swim_records").insert({ athlete_id, event_name: r.event_name, pool_length: r.pool_length, time_seconds: r.time_seconds, record_date: r.record_date, record_type: "comp", notes });
        ins++;
      }
    }

    return new Response(JSON.stringify({ status: "ok", inserted: ins, updated: upd, skipped: skip }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
