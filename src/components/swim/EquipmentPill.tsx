import { cn } from "@/lib/utils";

const equipmentIconMap: Record<string, { label: string; icon: string }> = {
  palmes: {
    label: "Palmes",
    icon: new URL("../../assets/icons/equipment/palmes.svg", import.meta.url).href,
  },
  tuba: {
    label: "Tuba",
    icon: new URL("../../assets/icons/equipment/tuba.svg", import.meta.url).href,
  },
  plaquettes: {
    label: "Plaquettes",
    icon: new URL("../../assets/icons/equipment/plaquettes.svg", import.meta.url).href,
  },
  pull: {
    label: "Pull",
    icon: new URL("../../assets/icons/equipment/pull.svg", import.meta.url).href,
  },
  elastique: {
    label: "Élastique",
    icon: new URL("../../assets/icons/equipment/elastique.svg", import.meta.url).href,
  },
};

const normalizeEquipmentKey = (value: string) => value.trim().toLowerCase();

export const getEquipmentIconUrl = (value: string) =>
  equipmentIconMap[normalizeEquipmentKey(value)]?.icon ?? null;

type EquipmentPillProps = {
  equipment: string;
  className?: string;
  showIcon?: boolean;
};

export function EquipmentPill({ equipment, className, showIcon = true }: EquipmentPillProps) {
  const config = equipmentIconMap[normalizeEquipmentKey(equipment)];

  return (
    <span
      className={cn(
        "flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs text-muted-foreground",
        className,
      )}
    >
      {showIcon && config?.icon ? (
        <img src={config.icon} alt="" className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
      ) : null}
      <span>{config?.label ?? equipment}</span>
    </span>
  );
}
