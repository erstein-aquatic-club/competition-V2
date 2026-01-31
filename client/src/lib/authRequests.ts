import { syncConfig } from "./config";

export const AUTH_ENDPOINT_MISSING_MESSAGE = "VITE_SWIM_SYNC_ENDPOINT manquant (API Worker)";
export const AUTH_ENDPOINT_INVALID_MESSAGE = "VITE_SWIM_SYNC_ENDPOINT invalide (API Worker)";

export const buildAuthUrl = (action: string, endpoint = syncConfig.endpoint) => {
  if (!endpoint) {
    throw new Error(AUTH_ENDPOINT_MISSING_MESSAGE);
  }
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch (error) {
    throw new Error(AUTH_ENDPOINT_INVALID_MESSAGE);
  }
  url.searchParams.set("action", action);
  return url.toString();
};
