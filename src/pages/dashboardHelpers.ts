export const defaultStableValues = {
  slot: "Soir",
  distance: 2500,
  duration: 120,
};

export type SwimFormData = {
  date: string;
  slot: string;
  distance: number;
  duration: number;
  effort: number;
  feeling: number;
  performance: number;
  engagement: number;
  comments: string;
};

export const buildDefaultFormData = (dateIso: string): SwimFormData => ({
  date: dateIso,
  slot: defaultStableValues.slot,
  distance: defaultStableValues.distance,
  duration: defaultStableValues.duration,
  effort: 3,
  feeling: 3,
  performance: 3,
  engagement: 3,
  comments: "",
});

export const getEditModeLabels = (label?: string | null) => {
  const suffix = label ? ` ${label}` : "";
  return {
    banner: `Modification de la séance${suffix}`,
    primaryAction: "Enregistrer les modifications",
    cancelAction: "Annuler la modification",
  };
};

export const resetSwimEditState = (
  setters: {
    setEditingSessionId: (value: number | null) => void;
    setFormData: (value: SwimFormData) => void;
    setSlotDraft: (value: string) => void;
    setDurationDraft: (value: number) => void;
    setDistanceDraft: (value: number) => void;
    setEditingSessionLabel: (value: string | null) => void;
  },
  dateIso: string,
) => {
  setters.setEditingSessionId(null);
  setters.setEditingSessionLabel(null);
  setters.setFormData(buildDefaultFormData(dateIso));
  setters.setSlotDraft(defaultStableValues.slot);
  setters.setDurationDraft(defaultStableValues.duration);
  setters.setDistanceDraft(defaultStableValues.distance);
};
