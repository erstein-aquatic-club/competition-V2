import { format } from "date-fns";

export function formatSwimSessionDefaultTitle(date: Date) {
  return `Séance du ${format(date, "dd/MM/yyyy")} - Soir - Matin`;
}
