import React from "react";
import { Crown, Medal } from "lucide-react";
import { HallOfFameValue } from "./HallOfFameValue";

export type PodiumEntry = {
  name: string;
  value: string;
  toneScore: number | null;
};

type PodiumProps = {
  entries: PodiumEntry[];
};

const PODIUM_CONFIG = [
  { rank: 1, height: "h-28", avatarSize: "h-12 w-12 text-lg", colOrder: "order-2" },
  { rank: 2, height: "h-20", avatarSize: "h-10 w-10 text-base", colOrder: "order-1" },
  { rank: 3, height: "h-14", avatarSize: "h-10 w-10 text-base", colOrder: "order-3" },
] as const;

const RANK_STYLES = {
  1: { icon: Crown, color: "text-rank-gold", bg: "bg-rank-gold/10", border: "border-rank-gold", pedestal: "from-rank-gold/30" },
  2: { icon: Medal, color: "text-rank-silver", bg: "bg-rank-silver/10", border: "border-rank-silver", pedestal: "from-rank-silver/30" },
  3: { icon: Medal, color: "text-rank-bronze", bg: "bg-rank-bronze/10", border: "border-rank-bronze", pedestal: "from-rank-bronze/30" },
} as const;

function PodiumColumn({ entry, config }: { entry: PodiumEntry; config: typeof PODIUM_CONFIG[number] }) {
  const style = RANK_STYLES[config.rank as 1 | 2 | 3];
  const IconComponent = style.icon;
  const initials = entry.name.slice(0, 2).toUpperCase();

  return (
    <div className={`flex flex-col items-center gap-1 ${config.colOrder} flex-1`}>
      <IconComponent className={`h-5 w-5 ${style.color} ${config.rank === 1 ? "fill-rank-gold" : config.rank === 2 ? "fill-rank-silver" : "fill-rank-bronze"}`} />
      <div className={`${config.avatarSize} rounded-full ${style.bg} border-2 ${style.border} flex items-center justify-center font-bold font-display`}>
        {initials}
      </div>
      <div className="font-bold uppercase tracking-tight text-xs text-center truncate max-w-full px-1">{entry.name}</div>
      <HallOfFameValue value={entry.value} toneScore={entry.toneScore} />
      <div className={`${config.height} w-full rounded-t-xl bg-gradient-to-b ${style.pedestal} to-muted/50 border-t-2 ${style.border}`} />
    </div>
  );
}

export function Podium({ entries }: PodiumProps) {
  if (entries.length === 0) {
    return <div className="text-center text-muted-foreground py-4">Aucune donnée</div>;
  }

  const podiumEntries = entries.slice(0, 3);

  if (podiumEntries.length === 1) {
    return (
      <div className="flex justify-center py-2">
        <div className="w-1/3">
          <PodiumColumn entry={podiumEntries[0]} config={PODIUM_CONFIG[0]} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-end justify-center gap-2 py-2">
      <PodiumColumn entry={podiumEntries[1]} config={PODIUM_CONFIG[1]} />
      <PodiumColumn entry={podiumEntries[0]} config={PODIUM_CONFIG[0]} />
      {podiumEntries[2] && (
        <PodiumColumn entry={podiumEntries[2]} config={PODIUM_CONFIG[2]} />
      )}
    </div>
  );
}
