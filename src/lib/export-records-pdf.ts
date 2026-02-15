// src/lib/export-records-pdf.ts
// Generates a PDF of club records with one page per pool/sex combination.
// Each page is a table: rows = events, columns = age categories.
// Branding: EAC logo, EAC red color (#E30613), fixed column widths

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ClubRecord } from "@/lib/api";

// EAC branding colors (RGB)
const EAC_RED: [number, number, number] = [227, 6, 19]; // #E30613
const EAC_GRAY: [number, number, number] = [120, 120, 120];

// ── Constants ──

const AGE_COLS = [
  { age: 8, label: "≤8" },
  { age: 9, label: "9" },
  { age: 10, label: "10" },
  { age: 11, label: "11" },
  { age: 12, label: "12" },
  { age: 13, label: "13" },
  { age: 14, label: "14" },
  { age: 15, label: "15" },
  { age: 16, label: "16" },
  { age: 17, label: "17+" },
];

const EVENTS_ORDER = [
  { id: "50_FREE", label: "50 NL" },
  { id: "100_FREE", label: "100 NL" },
  { id: "200_FREE", label: "200 NL" },
  { id: "400_FREE", label: "400 NL" },
  { id: "800_FREE", label: "800 NL" },
  { id: "1500_FREE", label: "1500 NL" },
  { id: "50_BACK", label: "50 Dos" },
  { id: "100_BACK", label: "100 Dos" },
  { id: "200_BACK", label: "200 Dos" },
  { id: "50_BREAST", label: "50 Br" },
  { id: "100_BREAST", label: "100 Br" },
  { id: "200_BREAST", label: "200 Br" },
  { id: "50_FLY", label: "50 Pap" },
  { id: "100_FLY", label: "100 Pap" },
  { id: "200_FLY", label: "200 Pap" },
  { id: "100_IM", label: "100 4N" },
  { id: "200_IM", label: "200 4N" },
  { id: "400_IM", label: "400 4N" },
];

const PAGES = [
  { pool_m: 25, sex: "M", title: "Records Hommes — Bassin 25m" },
  { pool_m: 25, sex: "F", title: "Records Femmes — Bassin 25m" },
  { pool_m: 50, sex: "M", title: "Records Hommes — Bassin 50m" },
  { pool_m: 50, sex: "F", title: "Records Femmes — Bassin 50m" },
];

// ── Helpers ──

function formatTime(ms: number): string {
  const totalCenti = Math.round(ms / 10);
  const centi = totalCenti % 100;
  const totalSec = Math.floor(totalCenti / 100);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60);
  const pad2 = (v: number) => String(v).padStart(2, "0");
  if (min > 0) return `${min}:${pad2(sec)}.${pad2(centi)}`;
  return `${sec}.${pad2(centi)}`;
}

function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return fullName;
  // "Prénom Nom" → "P. Nom"
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ");
  return `${firstName.charAt(0)}. ${lastName}`;
}

// Load logo image and convert to data URL for embedding in PDF
async function loadLogoAsDataUrl(): Promise<string | null> {
  try {
    const response = await fetch("/icon-192.png");
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ── Main export function ──

export async function exportRecordsPdf(records: ClubRecord[]): Promise<void> {
  // Build a lookup: key = `${pool_m}_${sex}_${event_code}_${age}` → record
  const lookup = new Map<string, ClubRecord>();
  for (const r of records) {
    lookup.set(`${r.pool_m}_${r.sex}_${r.event_code}_${r.age}`, r);
  }

  // Load EAC logo for branding
  const logoDataUrl = await loadLogoAsDataUrl();

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  let isFirstPage = true;

  for (const page of PAGES) {
    if (!isFirstPage) doc.addPage();
    isFirstPage = false;

    // Add EAC logo in top left corner
    if (logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, "PNG", 8, 6, 16, 16); // x, y, width, height
      } catch {
        // If logo fails to load, continue without it
      }
    }

    // Title (offset right to accommodate logo)
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...EAC_RED); // EAC red for title
    doc.text(page.title, pageWidth / 2, 14, { align: "center" });

    // Subtitle
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...EAC_GRAY);
    doc.text(
      `EAC — Erstein Aquatic Club — Édité le ${new Date().toLocaleDateString("fr-FR")}`,
      pageWidth / 2,
      20,
      { align: "center" },
    );
    doc.setTextColor(0, 0, 0);

    // Build table data
    const head = [["Épreuve", ...AGE_COLS.map((a) => a.label)]];

    const body: string[][] = [];
    for (const event of EVENTS_ORDER) {
      const row: string[] = [event.label];
      let hasAny = false;
      for (const ageCol of AGE_COLS) {
        const rec = lookup.get(`${page.pool_m}_${page.sex}_${event.id}_${ageCol.age}`);
        if (rec) {
          hasAny = true;
          row.push(`${formatTime(rec.time_ms)}\n${shortName(rec.athlete_name)}`);
        } else {
          row.push("");
        }
      }
      if (hasAny) {
        body.push(row);
      }
    }

    if (body.length === 0) {
      doc.setFontSize(10);
      doc.text("Aucun record enregistré", pageWidth / 2, 35, { align: "center" });
      continue;
    }

    autoTable(doc, {
      startY: 24,
      head,
      body,
      theme: "grid",
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
        valign: "middle",
        halign: "center",
        lineWidth: 0.2,
        lineColor: [200, 200, 200],
      },
      headStyles: {
        fillColor: EAC_RED, // EAC red for header background
        textColor: 255,
        fontStyle: "bold",
        fontSize: 7.5,
        halign: "center",
      },
      columnStyles: {
        // Fixed column widths: Event column wider, age columns equal
        0: { halign: "left", fontStyle: "bold", cellWidth: 28 }, // Event label
        1: { cellWidth: 22 }, // Age 8
        2: { cellWidth: 22 }, // Age 9
        3: { cellWidth: 22 }, // Age 10
        4: { cellWidth: 22 }, // Age 11
        5: { cellWidth: 22 }, // Age 12
        6: { cellWidth: 22 }, // Age 13
        7: { cellWidth: 22 }, // Age 14
        8: { cellWidth: 22 }, // Age 15
        9: { cellWidth: 22 }, // Age 16
        10: { cellWidth: 22 }, // Age 17
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250],
      },
      margin: { left: 8, right: 8 },
      didParseCell(data) {
        // Style the time line vs the name line differently
        if (data.section === "body" && data.column.index > 0 && data.cell.raw) {
          data.cell.styles.fontSize = 6.5;
        }
      },
    });
  }

  doc.save("records-club-eac.pdf");
}
