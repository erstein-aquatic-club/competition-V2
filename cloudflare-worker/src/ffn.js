// src/ffn.js
// Scraper FFN (Extranat) — Meilleures Performances Personnelles (MPP)
// Objectif: récupérer les meilleures perfs **séparément** pour bassin 25m et 50m
// en s'appuyant sur les sections "Bassin : 25 mètres" / "Bassin : 50 mètres" présentes sur la page.

const FFN_BASE = "https://ffn.extranat.fr/webffn";

function clean(v) {
  return String(v ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function poolFromText(text) {
  const s = clean(text);
  if (/Bassin\s*:\s*25/i.test(s)) return 25;
  if (/Bassin\s*:\s*50/i.test(s)) return 50;
  return null;
}

function parseHrefIds(href) {
  if (!href) return { idcpt: null, idepr: null };
  const m1 = href.match(/idcpt=(\d+)/);
  const m2 = href.match(/idepr=(\d+)/);
  return { idcpt: m1 ? m1[1] : null, idepr: m2 ? m2[1] : null };
}

function parseLocationAndCountry(raw) {
  const s = clean(raw);
  if (!s) return { location: null, country: null };
  const match = s.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (match) {
    return { location: clean(match[1]) || null, country: clean(match[2]) || null };
  }
  return { location: s, country: null };
}

export function parseFfnTimeToSeconds(raw) {
  const s = clean(raw);
  if (!s) return null;

  // On ne garde que le premier motif "mm:ss.xx" ou "ss.xx"
  const m = s.match(/(\d{1,2}):(\d{2})\.(\d{1,2})|(\d{1,2})\.(\d{1,2})/);
  if (!m) return null;

  // mm:ss.xx
  if (m[1] != null && m[2] != null && m[3] != null) {
    const mm = Number(m[1]);
    const ss = Number(m[2]);
    const cs = Number(m[3].padEnd(2, "0")); // centièmes
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

export function parseFfnDateToIso(raw) {
  const s = clean(raw);
  if (!s) return null;

  const m1 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;

  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;

  return null;
}

function extractDateFromCells(cells) {
  for (const c of cells) {
    const m = clean(c).match(/(\d{2}\/\d{2}\/\d{4})/);
    if (m) return m[1];
  }
  return null;
}

function extractPointsFromCells(cells) {
  for (const c of cells) {
    const s = clean(c);
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

function extractAgeFromCells(cells) {
  for (const c of cells) {
    const s = clean(c);
    const match = s.match(/(\d{1,2})\s*(ans|an)\b/i);
    if (match) {
      const age = Number(match[1]);
      if (Number.isFinite(age)) return age;
    }
  }
  return null;
}

function extractSexFromCells(cells) {
  for (const c of cells) {
    const s = clean(c);
    if (/dames|femmes|f[eé]minin/i.test(s)) return "F";
    if (/messieurs|hommes|masculin/i.test(s)) return "M";
  }
  return null;
}

async function fetchHtml(url, { timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

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
    clearTimeout(t);
  }
}

async function postHtml(url, body, { timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  const form = new URLSearchParams(body);

  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "User-Agent": "suivi-natation/1.0",
        Accept: "text/html,application/xhtml+xml",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Origin: "https://ffn.extranat.fr",
        Referer: url,
      },
      body: form.toString(),
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      throw new Error(
        `FFN HTTP ${res.status} ${res.statusText}${bodyText ? " — " + bodyText.slice(0, 120) : ""}`,
      );
    }

    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

/**
 * Parse toutes les lignes <tr> de la page, en conservant le "pool" courant
 * en fonction des sections textuelles "Bassin : 25 mètres" / "Bassin : 50 mètres".
 *
 * Retour: Array<{ pool_length: 25|50|null, cells: string[] }>
 */
function parseMppTableRowsWithPool(html) {
  /** @type {{ pool_length: number|null, cells: string[] }[]} */
  const rows = [];

  const state = {
    inTr: false,
    inCell: false,
    cellText: "",
    row: /** @type {string[]} */ ([]),
    currentPool: /** @type {number|null} */ (null),
    rowPool: /** @type {number|null} */ (null),
  };

  const setPoolIfSeen = (txt) => {
    const s = clean(txt);
    if (!s) return;

    // Ex: "Bassin : 25 mètres", "Bassin : 50 mètres"
    const m = s.match(/Bassin\s*:\s*(25|50)\s*m/i);
    if (m) {
      state.currentPool = Number(m[1]);
    }
  };

  const rewriter = new HTMLRewriter()
    // On écoute le texte global pour détecter les titres de sections "Bassin : XX mètres"
    .on("body", {
      text(t) {
        // Ne pas polluer cellText ici, on fait juste un "scan" pour mettre à jour currentPool.
        setPoolIfSeen(t.text);
      },
    })
    .on("tr", {
      element(el) {
        state.inTr = true;
        state.row = [];
        state.rowPool = state.currentPool;

        el.onEndTag(() => {
          state.inTr = false;

          // On pousse la row seulement si elle ressemble à une ligne de données
          if (state.row.length > 0) {
            rows.push({ pool_length: state.rowPool, cells: state.row });
          }
        });
      },
    })
    .on("td, th", {
      element(el) {
        state.inCell = true;
        state.cellText = "";

        el.onEndTag(() => {
          state.row.push(state.cellText);
          state.inCell = false;
          state.cellText = "";
        });
      },
      text(t) {
        if (state.inCell) state.cellText += t.text;
      },
    })
    // Certains indicateurs peuvent être dans des attributs (alt/title)
    .on("td img, th img", {
      element(el) {
        if (!state.inCell) return;
        const alt = clean(el.getAttribute("alt") || "");
        const title = clean(el.getAttribute("title") || "");
        const extra = clean(`${alt} ${title}`);
        if (extra) state.cellText += ` ${extra}`;
      },
    });

  // On exécute le rewriter en “transformant” une Response.
  // Il faut consommer le body, sinon les handlers ne se déclenchent pas.
  const resp = new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  return rewriter.transform(resp).text().then(() => rows);
}

/**
 * Parse les performances FFN (toutes les perfs) avec contexte bassin + épreuve longue.
 *
 * Retour: Array<{ pool_length: number|null, event_long: string|null, cells: string[], hrefs: string[] }>
 */
function parsePerfsTableRowsWithMeta(html) {
  /** @type {{ pool_length: number|null, event_long: string|null, cells: string[], hrefs: string[] }[]} */
  const rows = [];

  const state = {
    inTable: false,
    inThead: false,
    inTheadP: false,
    theadText: "",
    theadPText: "",
    tablePool: /** @type {number|null} */ (null),
    tableEventLong: /** @type {string|null} */ (null),
    inTr: false,
    inCell: false,
    cellText: "",
    row: /** @type {string[]} */ ([]),
    rowHrefs: /** @type {string[]} */ ([]),
  };

  const rewriter = new HTMLRewriter()
    .on("table", {
      element(el) {
        state.inTable = true;
        state.tablePool = null;
        state.tableEventLong = null;
        state.theadText = "";
        state.theadPText = "";

        el.onEndTag(() => {
          state.inTable = false;
        });
      },
    })
    .on("thead", {
      element(el) {
        if (!state.inTable) return;
        state.inThead = true;
        state.theadText = "";

        el.onEndTag(() => {
          state.inThead = false;
          if (state.tablePool == null) {
            state.tablePool = poolFromText(state.theadText);
          }
        });
      },
      text(t) {
        if (state.inThead) state.theadText += t.text;
      },
    })
    .on("thead p", {
      element(el) {
        if (!state.inThead) return;
        state.inTheadP = true;
        state.theadPText = "";

        el.onEndTag(() => {
          const txt = clean(state.theadPText);
          if (txt && !/Bassin\s*:/i.test(txt) && !state.tableEventLong) {
            state.tableEventLong = txt;
          }
          state.inTheadP = false;
          state.theadPText = "";
        });
      },
      text(t) {
        if (state.inTheadP) state.theadPText += t.text;
      },
    })
    .on("tbody tr", {
      element(el) {
        state.inTr = true;
        state.row = [];
        state.rowHrefs = [];

        el.onEndTag(() => {
          state.inTr = false;
          if (state.row.length > 0) {
            rows.push({
              pool_length: state.tablePool,
              event_long: state.tableEventLong,
              cells: state.row,
              hrefs: state.rowHrefs,
            });
          }
        });
      },
    })
    .on("tbody tr td, tbody tr th", {
      element(el) {
        state.inCell = true;
        state.cellText = "";

        el.onEndTag(() => {
          state.row.push(state.cellText);
          state.inCell = false;
          state.cellText = "";
        });
      },
      text(t) {
        if (state.inCell) state.cellText += t.text;
      },
    })
    .on("tbody tr td img, tbody tr th img", {
      element(el) {
        if (!state.inCell) return;
        const alt = clean(el.getAttribute("alt") || "");
        const title = clean(el.getAttribute("title") || "");
        const extra = clean(`${alt} ${title}`);
        if (extra) state.cellText += ` ${extra}`;
      },
    })
    .on("tbody tr a[href]", {
      element(el) {
        const href = el.getAttribute("href");
        if (href) state.rowHrefs.push(href);
      },
    });

  const resp = new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  return rewriter.transform(resp).text().then(() => rows);
}

/**
 * Récupère les MPP FFN pour un bassin précis (25/50).
 * La page peut contenir les deux sections "Bassin : 25" et "Bassin : 50" :
 * => on filtre ici **strictement** sur poolLength.
 */
export async function fetchFfnMpp(iuf, poolLength, { activity = "nat" } = {}) {
  const id = clean(iuf);
  if (!/^\d{5,10}$/.test(id)) throw new Error("IUF invalide (attendu: 5 à 10 chiffres)");

  // NB: même si idbas est fourni, la page peut inclure les deux bassins.
  const url =
    `${FFN_BASE}/nat_recherche.php` +
    `?idact=${encodeURIComponent(activity)}` +
    `&idbas=${encodeURIComponent(String(poolLength))}` +
    `&idrch_id=${encodeURIComponent(id)}` +
    `&idiuf=${encodeURIComponent(id)}`;

  const html = await fetchHtml(url);
  const rawRows = await parseMppTableRowsWithPool(html);

  /**
   * NOTE (schema evolution):
   * - Historically we returned `points`.
   * - The DB now stores this value in `ffn_points`.
   * To keep backward compatibility with existing code (and older deployments),
   * we return BOTH: `points` and `ffn_points`.
   */
  /** @type {{event_name: string, pool_length: number, time_seconds: number, record_date: string|null, points: number|null, ffn_points: number|null, age: number|null, sex: string|null}[]} */
  const results = [];

  for (const row of rawRows) {
    const rowPool = row.pool_length;

    // Si on a détecté un bassin pour la ligne, on filtre strictement.
    // Sinon, on suppose que la page est déjà filtrée par idbas (fallback).
    if (rowPool != null && rowPool !== poolLength) continue;

    const cells = row.cells;

    // Heuristique: dans les tables MPP, cell[0]=épreuve, cell[1]=temps (avec âge/pts parfois)
    const event = clean(cells[0]);
    const timeRaw = clean(cells[1]);
    if (!event || !timeRaw) continue;

    const timeSeconds = parseFfnTimeToSeconds(timeRaw);
    if (timeSeconds == null) continue;

    const dateRaw = extractDateFromCells(cells);
    const points = extractPointsFromCells(cells);
    const ffnPoints = points ?? null;
    const age = extractAgeFromCells(cells);
    const sex = extractSexFromCells(cells);

    results.push({
      event_name: event,
      pool_length: poolLength,
      time_seconds: timeSeconds,
      record_date: parseFfnDateToIso(dateRaw) || null,
      // Keep legacy name for compatibility
      points: points ?? null,
      // New explicit name aligned with DB column
      ffn_points: ffnPoints,
      age: age ?? null,
      sex: sex ?? null,
    });
  }

  // Déduplication sécurité (si la page duplique des lignes)
  const seen = new Set();
  const deduped = [];
  for (const r of results) {
    const k = `${r.event_name}__${r.pool_length}`;
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(r);
  }

  return deduped;
}

/**
 * Récupère toutes les performances FFN pour un bassin précis (25/50).
 */
export async function fetchFfnPerformances(iuf, poolLength, { activity = "nat" } = {}) {
  const id = clean(iuf);
  if (!/^\d{5,10}$/.test(id)) throw new Error("IUF invalide (attendu: 5 à 10 chiffres)");

  const html = await postHtml(`${FFN_BASE}/nat_recherche.php`, {
    idact: activity,
    idiuf: id,
    idbas: String(poolLength),
    idrch_id: id,
    idopt: "prf",
    idepr: "",
  });

  const rawRows = await parsePerfsTableRowsWithMeta(html);
  /** @type {Array<{
   * event_name: string,
   * event_long: string|null,
   * pool_length: number,
   * time_seconds: number,
   * record_date: string|null,
   * points: number|null,
   * ffn_points: number|null,
   * age: number|null,
   * sex: string|null,
   * location: string|null,
   * country: string|null,
   * level: string|null,
   * club: string|null,
   * meeting_id: string|null,
   * event_id: string|null
   * }>} */
  const results = [];

  for (const row of rawRows) {
    const rowPool = row.pool_length;
    if (rowPool != null && rowPool !== poolLength) continue;

    const cells = row.cells;
    const event = clean(cells[0]);
    const timeRaw = clean(cells[1]);
    if (!event || !timeRaw) continue;

    const timeSeconds = parseFfnTimeToSeconds(timeRaw);
    if (timeSeconds == null) continue;

    const ageRaw = clean(cells[2] || "");
    const age = ageRaw ? Number(clean(ageRaw).replace(/[()]/g, "")) : null;
    const pointsRaw = clean(cells[3] || "");
    const points = pointsRaw ? Number(pointsRaw.replace(/\s*pts$/i, "")) : null;

    const locationRaw = clean(cells[4] || "");
    const { location, country } = parseLocationAndCountry(locationRaw);

    const recordDate = parseFfnDateToIso(cells[5] || "");
    const level = clean(cells[6] || "") || null;
    const club = clean(cells[8] || "") || null;

    const { idcpt, idepr } = parseHrefIds(row.hrefs?.[0]);
    const sex = extractSexFromCells(cells);

    results.push({
      event_name: event,
      event_long: row.event_long || null,
      pool_length: poolLength,
      time_seconds: timeSeconds,
      record_date: recordDate || null,
      points: Number.isFinite(points) ? points : null,
      ffn_points: Number.isFinite(points) ? points : null,
      age: Number.isFinite(age) ? age : null,
      sex: sex ?? null,
      location,
      country,
      level,
      club,
      meeting_id: idcpt,
      event_id: idepr,
    });
  }

  return results;
}

/**
 * Récupère toutes les performances FFN **pour 25m et 50m indépendamment**.
 */
export async function fetchFfnAllPerformancesByIuf(iuf, { activity = "nat" } = {}) {
  const [perfs25, perfs50] = await Promise.all([
    fetchFfnPerformances(iuf, 25, { activity }).catch(() => []),
    fetchFfnPerformances(iuf, 50, { activity }).catch(() => []),
  ]);
  return [...perfs25, ...perfs50];
}

/**
 * Récupère les meilleures perfs FFN **pour 25m et 50m indépendamment**.
 */
export async function fetchFfnBestPerformancesByIuf(iuf, { activity = "nat" } = {}) {
  const [mpp25, mpp50] = await Promise.all([
    fetchFfnMpp(iuf, 25, { activity }).catch(() => []),
    fetchFfnMpp(iuf, 50, { activity }).catch(() => []),
  ]);
  return [...mpp25, ...mpp50];
}
