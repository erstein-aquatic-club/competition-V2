import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EquipmentPill } from "@/components/swim/EquipmentPill";
import {
  formatIntensityLabel,
  IntensityDots,
  intensityScale,
  intensityTone,
} from "@/components/swim/IntensityDots";
import { SwimBadgeRow } from "@/components/swim/SwimBadgeRow";
import { Repeat, Ruler, Timer, Waves } from "lucide-react";
import type { SwimSessionItem } from "@/lib/api";
import type { SwimPayloadFields } from "@/lib/types";
import { splitModalitiesLines } from "@/lib/swimSessionUtils";

interface SwimSessionConsultationProps {
  title: string;
  description?: string;
  items?: SwimSessionItem[];
  showHeader?: boolean;
  compactMode?: boolean;
  onExerciseSelect?: (detail: SwimExerciseDetail) => void;
}

interface BlockGroup {
  key: string;
  title: string;
  description?: string | null;
  modalities?: string | null;
  equipment?: string[] | null;
  order: number;
  repetitions?: number | null;
  items: SwimSessionItem[];
}

const intensityTextTone: Record<string, string> = {
  V0: "text-emerald-800",
  V1: "text-green-800",
  V2: "text-yellow-800",
  V3: "text-orange-800",
  Max: "text-red-800",
};

const intensityRingTone: Record<string, string> = {
  V0: "ring-emerald-200",
  V1: "ring-green-200",
  V2: "ring-yellow-200",
  V3: "ring-orange-200",
  Max: "ring-red-200",
};

const legacyIntensityMap: Record<string, (typeof intensityScale)[number]> = {
  souple: "V0",
  facile: "V0",
  relache: "V0",
  "relâché": "V0",
};

const strokeLabelMap: Record<string, string> = {
  pap: "Pap",
  papillon: "Pap",
  crawl: "Crawl",
  dos: "Dos",
  brasse: "Brasse",
  "4n": "4 nages",
  "4 nages": "4 nages",
  spe: "Spé",
  "spé": "Spé",
};

const strokeTypeLabels: Record<string, string> = {
  nc: "NC",
  educ: "Éducatif",
  jambes: "Jambes",
};

const strokeTypeTone: Record<string, string> = {
  nc: "bg-sky-100 text-sky-900 ring-sky-200",
  educ: "bg-violet-100 text-violet-900 ring-violet-200",
  jambes: "bg-teal-100 text-teal-900 ring-teal-200",
};

const getStrokeLabel = (stroke?: string | null) => {
  if (!stroke) {
    return null;
  }
  return strokeLabelMap[stroke] ?? stroke;
};

const normalizeIntensity = (intensity?: string | null) => {
  if (!intensity) {
    return null;
  }
  const trimmed = intensity.trim();
  if (!trimmed) {
    return null;
  }
  const lower = trimmed.toLowerCase();
  if (legacyIntensityMap[lower]) {
    return legacyIntensityMap[lower];
  }
  const upper = trimmed.toUpperCase();
  if (upper === "MAX") {
    return "Max";
  }
  if (upper.startsWith("V")) {
    const levelValue = Number.parseInt(upper.slice(1), 10);
    if (Number.isFinite(levelValue) && levelValue >= 4) {
      return "Max";
    }
    if (intensityScale.includes(upper as (typeof intensityScale)[number])) {
      return upper;
    }
  }
  return trimmed;
};

const groupItemsByBlock = (items: SwimSessionItem[] = []): BlockGroup[] => {
  const blocks = new Map<string, BlockGroup>();
  items.forEach((item, index) => {
    const payload = item.raw_payload ?? {};
    const payloadObject = typeof payload === "object" ? payload : {};
    const blockTitle =
      (payloadObject as SwimPayloadFields).block_title ||
      (payloadObject as SwimPayloadFields).section ||
      "Bloc";
    const blockOrder = Number((payloadObject as SwimPayloadFields).block_order ?? 0);
    const key = `${blockOrder}-${blockTitle}`;
    const blockEquipmentRaw =
      (payloadObject as SwimPayloadFields).block_equipment ??
      (payloadObject as SwimPayloadFields).equipment;
    const blockModalities =
      (payloadObject as SwimPayloadFields).block_modalities ??
      (payloadObject as SwimPayloadFields).modalities ??
      null;
    const blockEquipment = Array.isArray(blockEquipmentRaw)
      ? blockEquipmentRaw
      : blockEquipmentRaw
        ? String(blockEquipmentRaw).split(",").map((entry) => entry.trim()).filter(Boolean)
        : [];
    if (!blocks.has(key)) {
      blocks.set(key, {
        key,
        title: blockTitle,
        description: (payloadObject as SwimPayloadFields).block_description ?? null,
        modalities: blockModalities,
        equipment: blockEquipment.length ? blockEquipment : null,
        order: Number.isFinite(blockOrder) ? blockOrder : 0,
        repetitions: (payloadObject as SwimPayloadFields).block_repetitions ?? null,
        items: [],
      });
    }
    const block = blocks.get(key)!;
    const exerciseRepetitions = (payloadObject as SwimPayloadFields).exercise_repetitions ?? null;
    const exerciseDistance = item.distance ?? null;
    const exerciseLabel =
      item.label ||
      (exerciseRepetitions && exerciseDistance ? `${exerciseRepetitions}x${exerciseDistance}m` : null) ||
      (exerciseDistance ? `${exerciseDistance}m` : null);
    const exerciseModalities = (payloadObject as SwimPayloadFields).exercise_modalities ?? item.notes ?? null;
    const exerciseEquipmentRaw =
      (payloadObject as SwimPayloadFields).exercise_equipment ??
      (payloadObject as SwimPayloadFields).equipment;
    const exerciseEquipment = Array.isArray(exerciseEquipmentRaw)
      ? exerciseEquipmentRaw
      : exerciseEquipmentRaw
        ? String(exerciseEquipmentRaw).split(",").map((entry) => entry.trim()).filter(Boolean)
        : [];
    block.items.push({
      ...item,
      label:
        exerciseLabel ||
        (payloadObject as SwimPayloadFields).exercise_label ||
        `Exercice ${index + 1}`,
      notes: exerciseModalities,
      raw_payload: {
        ...payloadObject,
        exercise_modalities: exerciseModalities,
        exercise_equipment: exerciseEquipment,
      },
    });
  });

  return Array.from(blocks.values()).sort((a, b) => {
    if (a.order !== b.order) {
      return a.order - b.order;
    }
    return a.title.localeCompare(b.title);
  });
};

const intensityBadgeClass = (value: string) =>
  `inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 bg-card ${
    intensityTextTone[value] ?? "text-foreground"
  } ${intensityRingTone[value] ?? "ring-border"}`;

export type SwimExerciseDetail = {
  label: string;
  distance?: number | null;
  repetitions?: number | null;
  rest?: number | null;
  stroke?: string | null;
  strokeType?: string | null;
  intensity?: string | null;
  modalities?: string | null;
  equipment?: string[];
  blockTitle?: string;
  blockIndex?: number;
};

export function SwimSessionConsultation({
  title,
  description,
  items = [],
  showHeader = true,
  compactMode = false,
  onExerciseSelect,
}: SwimSessionConsultationProps) {
  const blocks = groupItemsByBlock(items);
  const isClickable = Boolean(onExerciseSelect);

  return (
    <div className="space-y-6">
      {showHeader ? (
        <div className="space-y-2">
          <div className="space-y-1">
            <h2 className="text-2xl font-display font-semibold uppercase tracking-wide">{title}</h2>
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          <Separator />
        </div>
      ) : null}
      {blocks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-muted/70 bg-muted/30 p-6 text-sm text-muted-foreground">
          Aucun contenu détaillé pour cette séance.
        </div>
      ) : (
        blocks.map((block, blockIndex) => (
          <Card key={block.key} className="overflow-hidden border border-border shadow-sm">
            <CardHeader className="space-y-3 bg-muted/80 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Bloc {blockIndex + 1}
                  </div>
                  <div className="text-lg font-semibold tracking-tight text-foreground">{block.title}</div>
                  {block.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">{block.description}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {block.repetitions ? (
                    <Badge variant="secondary" className="text-xs">
                      <Repeat className="mr-1 h-3 w-3" /> {block.repetitions}x
                    </Badge>
                  ) : null}
                  <Badge variant="outline" className="text-xs">
                    {block.items.length} exercices
                  </Badge>
                </div>
              </div>
              <SwimBadgeRow className="text-muted-foreground">
                {block.modalities ? (
                  <span
                    className="inline-flex max-w-[280px] items-center rounded-full bg-card px-2.5 py-1 ring-1 ring-border"
                    title={block.modalities}
                  >
                    <span className="truncate">Modalités : {block.modalities}</span>
                  </span>
                ) : null}
                {block.equipment?.length ? (
                  <SwimBadgeRow>
                    {block.equipment.map((equipment) => {
                      return (
                        <EquipmentPill key={equipment} equipment={equipment} />
                      );
                    })}
                  </SwimBadgeRow>
                ) : null}
              </SwimBadgeRow>
            </CardHeader>
            <CardContent className="space-y-4 bg-card px-5 py-4">
              {block.items.map((item, itemIndex) => {
                const payload = (item.raw_payload as SwimPayloadFields) ?? {};
                const normalizedIntensity = normalizeIntensity(payload.exercise_intensity ?? item.intensity ?? null);
                const strokeLabel = getStrokeLabel(payload.exercise_stroke);
                const strokeTypeLabel = payload.exercise_stroke_type
                  ? strokeTypeLabels[payload.exercise_stroke_type] ?? payload.exercise_stroke_type
                  : null;
                const equipmentList = Array.isArray(payload.exercise_equipment) ? payload.exercise_equipment : [];
                const exerciseLabel = item.label || `Exercice ${itemIndex + 1}`;
                const exerciseDetail: SwimExerciseDetail = {
                  label: exerciseLabel,
                  distance: item.distance ?? null,
                  repetitions: payload.exercise_repetitions ?? null,
                  rest: payload.exercise_rest ?? null,
                  stroke: strokeLabel,
                  strokeType: strokeTypeLabel,
                  intensity: normalizedIntensity,
                  modalities: item.notes ?? null,
                  equipment: equipmentList,
                  blockTitle: block.title,
                  blockIndex,
                };
                const modalitiesLines = splitModalitiesLines(item.notes);
                const content = (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="text-sm font-semibold tracking-tight text-foreground">
                          {exerciseLabel}
                        </div>
                        {!compactMode ? (
                          <SwimBadgeRow className="text-muted-foreground">
                            {payload.exercise_repetitions ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 ring-1 ring-border">
                                {payload.exercise_repetitions}x
                              </span>
                            ) : null}
                            {item.distance ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 ring-1 ring-border">
                                <Ruler className="h-3 w-3" /> {item.distance}m
                              </span>
                            ) : null}
                            {payload.exercise_rest ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 ring-1 ring-border">
                                <Timer className="h-3 w-3" /> {payload.exercise_rest}s
                              </span>
                            ) : null}
                            {payload.exercise_stroke ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 ring-1 ring-border">
                                <Waves className="h-3 w-3" /> {strokeLabel}
                              </span>
                            ) : null}
                          </SwimBadgeRow>
                        ) : (
                          <SwimBadgeRow className="text-muted-foreground">
                            {payload.exercise_repetitions ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 ring-1 ring-border">
                                {payload.exercise_repetitions}x
                              </span>
                            ) : null}
                            {item.distance ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 ring-1 ring-border">
                                <Ruler className="h-3 w-3" /> {item.distance}m
                              </span>
                            ) : null}
                            {payload.exercise_rest ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 ring-1 ring-border">
                                <Timer className="h-3 w-3" /> {payload.exercise_rest}s
                              </span>
                            ) : null}
                            {strokeLabel ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 ring-1 ring-border">
                                <Waves className="h-3 w-3" /> {strokeLabel}
                              </span>
                            ) : null}
                            {normalizedIntensity ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 ring-1 ring-border">
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    intensityTone[normalizedIntensity] ?? "bg-primary"
                                  }`}
                                />
                                {formatIntensityLabel(normalizedIntensity)}
                              </span>
                            ) : null}
                          </SwimBadgeRow>
                        )}
                      </div>
                      {!compactMode ? (
                        <div className="flex items-center gap-2 self-center">
                          {normalizedIntensity ? (
                            <span className={intensityBadgeClass(normalizedIntensity)}>
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  intensityTone[normalizedIntensity] ?? "bg-primary"
                                }`}
                              />
                              {formatIntensityLabel(normalizedIntensity)}
                            </span>
                          ) : null}
                          {normalizedIntensity ? <IntensityDots value={normalizedIntensity} className="self-center" /> : null}
                        </div>
                      ) : null}
                    </div>
                    {!compactMode && (strokeLabel || strokeTypeLabel) ? (
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
                        {strokeLabel ? (
                          <Badge className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-900 ring-1 ring-blue-200">
                            Nage : {strokeLabel}
                          </Badge>
                        ) : null}
                        {strokeTypeLabel ? (
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 ring-1 ${
                              strokeTypeTone[payload.exercise_stroke_type ?? ""] ??
                              "bg-muted text-foreground ring-border"
                            }`}
                          >
                            Type : {strokeTypeLabel}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    {!compactMode && modalitiesLines.length ? (
                      <div className="mt-3 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
                        <ul className="list-disc space-y-1 pl-4">
                          {modalitiesLines.map((line, lineIndex) => (
                            <li key={`${block.key}-${itemIndex}-line-${lineIndex}`}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {compactMode && modalitiesLines.length ? (
                      <div className="mt-2 text-xs text-muted-foreground">
                        <ul className="list-disc space-y-1 pl-4">
                          {modalitiesLines.map((line, lineIndex) => (
                            <li key={`${block.key}-${itemIndex}-compact-${lineIndex}`}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {equipmentList.length ? (
                      <SwimBadgeRow className="mt-3">
                        {equipmentList.map((equipment: string) => (
                          <EquipmentPill key={equipment} equipment={equipment} />
                        ))}
                      </SwimBadgeRow>
                    ) : null}
                  </>
                );

                return isClickable ? (
                  <button
                    key={`${block.key}-${itemIndex}`}
                    type="button"
                    onClick={() => onExerciseSelect?.(exerciseDetail)}
                    className="w-full rounded-2xl border border-border bg-muted p-4 text-left transition hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label={`Voir les détails de ${exerciseLabel}`}
                  >
                    {content}
                  </button>
                ) : (
                  <div
                    key={`${block.key}-${itemIndex}`}
                    className="w-full rounded-2xl border border-border bg-muted p-4 text-left"
                  >
                    {content}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
