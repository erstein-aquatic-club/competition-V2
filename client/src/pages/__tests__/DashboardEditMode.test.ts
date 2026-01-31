import assert from "node:assert/strict";
import { test } from "node:test";
import { getEditModeLabels, resetSwimEditState } from "@/pages/dashboardHelpers";

test("getEditModeLabels returns explicit banner and actions", () => {
  const labels = getEditModeLabels("12 mars");
  assert.equal(labels.banner, "Modification de la séance 12 mars");
  assert.equal(labels.primaryAction, "Enregistrer les modifications");
  assert.equal(labels.cancelAction, "Annuler la modification");
});

test("resetSwimEditState resets edit mode back to creation defaults", () => {
  let editingSessionId: number | null = 42;
  let editingSessionLabel: string | null = "12 mars";
  let formData: any = { date: "2024-05-02" };
  let slotDraft = "Matin";
  let durationDraft = 60;
  let distanceDraft = 1200;

  resetSwimEditState(
    {
      setEditingSessionId: (value) => {
        editingSessionId = value;
      },
      setEditingSessionLabel: (value) => {
        editingSessionLabel = value;
      },
      setFormData: (value) => {
        formData = value;
      },
      setSlotDraft: (value) => {
        slotDraft = value;
      },
      setDurationDraft: (value) => {
        durationDraft = value;
      },
      setDistanceDraft: (value) => {
        distanceDraft = value;
      },
    },
    "2024-05-01",
  );

  assert.equal(editingSessionId, null);
  assert.equal(editingSessionLabel, null);
  assert.equal(formData.date, "2024-05-01");
  assert.equal(slotDraft, "Soir");
  assert.equal(durationDraft, 120);
  assert.equal(distanceDraft, 2500);
});
