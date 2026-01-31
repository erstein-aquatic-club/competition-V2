const trimValue = (value?: string | null) => (value ? String(value).trim() : "");

const readWindowValue = (key: string) => {
  if (typeof window === "undefined") return "";
  const windowValues = window as unknown as Record<string, string | undefined>;
  return trimValue(windowValues[key]);
};

const readStorageValue = (key: string) => {
  if (typeof window === "undefined") return "";
  try {
    return trimValue(window.localStorage.getItem(key));
  } catch (error) {
    console.warn(`[config] Unable to read ${key} from storage`, error);
    return "";
  }
};

const readQueryValue = (key: string) => {
  if (typeof window === "undefined") return "";
  return trimValue(new URLSearchParams(window.location.search).get(key));
};

const readEnvValue = (key: string) => {
  const metaEnv =
    typeof import.meta === "undefined"
      ? undefined
      : (import.meta as ImportMeta).env;
  if (!metaEnv) return "";
  if (key === "VITE_SWIM_SYNC_ENDPOINT") {
    return trimValue(metaEnv?.VITE_SWIM_SYNC_ENDPOINT);
  }
  if (key === "VITE_SWIM_SYNC_TOKEN") {
    return trimValue(metaEnv?.VITE_SWIM_SYNC_TOKEN);
  }
  return trimValue(metaEnv?.[key as keyof ImportMetaEnv] as string | undefined);
};

const allowSameOriginApi =
  readQueryValue("allowSameOriginApi") === "1" ||
  (typeof import.meta !== "undefined" && (import.meta as ImportMeta).env?.DEV);

const defaultEndpoint =
  allowSameOriginApi && typeof window !== "undefined" && window.location?.origin
    ? `${window.location.origin}/`
    : "";

const endpoint =
  readQueryValue("swimSyncEndpoint") ||
  readEnvValue("VITE_SWIM_SYNC_ENDPOINT") ||
  readWindowValue("SWIM_SYNC_ENDPOINT") ||
  readStorageValue("SWIM_SYNC_ENDPOINT") ||
  defaultEndpoint;
const token =
  readQueryValue("swimSyncToken") ||
  readEnvValue("VITE_SWIM_SYNC_TOKEN") ||
  readWindowValue("SWIM_SYNC_TOKEN") ||
  readStorageValue("SWIM_SYNC_TOKEN");

export const syncConfig = {
  endpoint,
  token,
  hasCloudflareSync: Boolean(endpoint),
};

console.info("[syncConfig] hasCloudflareSync:", syncConfig.hasCloudflareSync);
