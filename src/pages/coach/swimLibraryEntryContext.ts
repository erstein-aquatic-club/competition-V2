export type SwimLibrarySlotContext = {
  trainingSlotId: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  location: string;
};

export type SwimLibraryEntryContext =
  | {
      mode: "create";
      slot: SwimLibrarySlotContext;
    }
  | {
      mode: "edit";
      slot: SwimLibrarySlotContext;
      swimCatalogId: number;
    };
