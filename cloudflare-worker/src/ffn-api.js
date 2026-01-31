const express = require("express");
const fetch = require("node-fetch");
const cheerio = require("cheerio");

const app = express();
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const FFN_URL = "https://ffn.extranat.fr/webffn/nat_recherche.php?idact=nat";

function clean(s) {
  return String(s || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function poolFromText(t) {
  const txt = clean(t);
  if (/Bassin\s*:\s*25/i.test(txt)) return 25;
  if (/Bassin\s*:\s*50/i.test(txt)) return 50;
  return null;
}

function parseHrefIds(href) {
  if (!href) return { idcpt: null, idepr: null };
  const m1 = href.match(/idcpt=(\d+)/);
  const m2 = href.match(/idepr=(\d+)/);
  return { idcpt: m1 ? m1[1] : null, idepr: m2 ? m2[1] : null };
}

function parseSwimmerMeta($) {
  const swimmerTitle = clean($("h5").first().text()) || null;
  const idiuf =
    $('input[type="hidden"]#idiuf').attr("value") ||
    $('input[type="hidden"][name="idiuf"]').attr("value") ||
    null;

  const idrchId =
    $('input[type="hidden"]#idrch_id').attr("value") ||
    $('input[type="hidden"][name="idrch_id"]').attr("value") ||
    null;

  return {
    iuf: idrchId || idiuf || null,
    title: swimmerTitle,
    idiuf,
    idrchId,
  };
}

async function postFfn(bodyParams) {
  const form = new URLSearchParams(bodyParams);

  const resp = await fetch(FFN_URL, {
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Origin": "https://ffn.extranat.fr",
      "Referer": FFN_URL,
    },
    body: form.toString(),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`FFN HTTP ${resp.status}${txt ? " — " + txt.slice(0, 200) : ""}`);
  }
  return resp.text();
}

/**
 * Parse MPP (Meilleures Performances Personnelles)
 */
function parseMppRowsFromHtml(html) {
  const $ = cheerio.load(html);
  const swimmer = parseSwimmerMeta($);

  const rows = [];

  $("table").each((_, tbl) => {
    const table = $(tbl);

    // On parcourt les enfants directs (thead/tbody) dans l’ordre
    let currentBassin = null;

    table.children().each((__, node) => {
      const el = $(node);
      const tag = (node.tagName || "").toLowerCase();

      if (tag === "thead") {
        // ✅ Le bassin est défini par CE thead uniquement
        currentBassin = poolFromText(el.text());
        return;
      }

      if (tag === "tbody") {
        // On ne lit les lignes que si un bassin a été trouvé juste avant
        if (!currentBassin) return;

        el.find("tr").each((___, tr) => {
          const $tr = $(tr);
          const epreuve = clean($tr.find('th[scope="row"]').first().text());
          if (!epreuve) return;

          const tds = $tr.find("td");
          const temps = clean(tds.eq(0).text()) || null;
          const age = clean(tds.eq(1).text()).replace(/[()]/g, "").trim() || null;
          const points = clean(tds.eq(2).text()).replace(/\s*pts$/i, "").trim() || null;

          const lieu = clean(tds.eq(3).find("p").first().text() || tds.eq(3).text()) || null;
          const paysRaw = clean(tds.eq(3).find("p").eq(1).text());
          const pays = paysRaw ? paysRaw.replace(/[()]/g, "") : null;

          const date = clean(tds.eq(4).text()) || null;
          const niveau = clean(tds.eq(5).text()).replace(/[\[\]]/g, "") || null;

          const href = tds.eq(6).find("a[href]").attr("href") || null;
          const { idcpt, idepr } = parseHrefIds(href);

          const club = clean(tds.eq(7).text()) || null;

          rows.push({
            type: "mpp",
            bassin: currentBassin,        // ✅ 25 ou 50 selon section
            epreuveLongue: null,
            epreuve,
            temps,
            age,
            points,
            lieu,
            pays,
            date,
            niveau,
            club,
            idcpt,
            idepr,
          });
        });
      }
    });
  });

  return { swimmer, rows };
}

/**
 * Parse Performances (toutes les perfs) — une table par "épreuveLongue + bassin"
 */
function parsePerfsRowsFromHtml(html, bassinRequested) {
  const $ = cheerio.load(html);
  const swimmer = parseSwimmerMeta($);

  const rows = [];

  $("table").each((_, tbl) => {
    const table = $(tbl);

    // Chaque table de performances a un <thead> du style:
    // <p>50 Nage Libre Messieurs</p>
    // <p class="text-sm font-medium">Bassin : 25 mètres</p>
    const theadText = clean(table.find("thead").text());
    const bassin = poolFromText(theadText);
    if (!bassin) return;

    // On ne garde que le bassin demandé (sécurité)
    if (bassinRequested && bassin !== bassinRequested) return;

    const epreuveLongue = clean(table.find("thead p").first().text()) || null;

    table.find("tbody tr").each((__, tr) => {
      const $tr = $(tr);

      // Code court: 50 NL (dans th scope=row)
      const epreuve = clean($tr.find('th[scope="row"]').first().text());
      if (!epreuve) return;

      const tds = $tr.find("td");

      const temps = clean(tds.eq(0).text()) || null;
      const age = clean(tds.eq(1).text()).replace(/[()]/g, "").trim() || null;
      const points = clean(tds.eq(2).text()).replace(/\s*pts$/i, "").trim() || null;

      const lieu = clean(tds.eq(3).find("p").first().text() || tds.eq(3).text()) || null;
      const paysRaw = clean(tds.eq(3).find("p").eq(1).text());
      const pays = paysRaw ? paysRaw.replace(/[()]/g, "") : null;

      const date = clean(tds.eq(4).text()) || null;
      const niveau = clean(tds.eq(5).text()).replace(/[\[\]]/g, "") || null;

      const href = tds.eq(6).find("a[href]").attr("href") || null;
      const { idcpt, idepr } = parseHrefIds(href);

      const club = clean(tds.eq(7).text()) || null;

      rows.push({
        type: "perf",
        bassin,
        epreuveLongue,
        epreuve,
        temps,
        age,
        points,
        lieu,
        pays,
        date,
        niveau,
        club,
        idcpt,
        idepr,
      });
    });
  });

  return { swimmer, bassin: bassinRequested || null, rows };
}

// ---- Fetchers ----

async function fetchFfnMppByIuf(iuf) {
  // MPP: affichage après sélection nageur via idrch + idrch_id
  const html = await postFfn({ idrch: String(iuf), idrch_id: String(iuf) });
  return parseMppRowsFromHtml(html);
}

async function fetchFfnAllPerfsByIuf(iuf, bassin) {
  // Performances: POST observé
  // 25m: idact=nat&idiuf=...&idbas=25&idrch_id=...&idepr=&idopt=prf
  // 50m: idem idbas=50
  const html = await postFfn({
    idact: "nat",
    idiuf: String(iuf),
    idbas: String(bassin),
    idrch_id: String(iuf),
    idopt: "prf",
    idepr: "",
  });

  return parsePerfsRowsFromHtml(html, bassin);
}

// ---- Routes ----

app.get("/api/ffn/mpp/:iuf", async (req, res) => {
  try {
    const data = await fetchFfnMppByIuf(req.params.iuf);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get("/api/ffn/perfs/:iuf", async (req, res) => {
  try {
    const bassin = Number(req.query.bassin || 25);
    if (![25, 50].includes(bassin)) {
      return res.status(400).json({ error: "Paramètre bassin invalide. Utilise ?bassin=25 ou ?bassin=50" });
    }
    const data = await fetchFfnAllPerfsByIuf(req.params.iuf, bassin);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3002;
app.listen(PORT, () => {
  console.log(`✅ FFN API prête sur http://localhost:${PORT}`);
  console.log(`   MPP:   http://localhost:${PORT}/api/ffn/mpp/879576`);
  console.log(`   Perfs: http://localhost:${PORT}/api/ffn/perfs/879576?bassin=25`);
});
