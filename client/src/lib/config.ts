const trimValue = (value?: string | null) => (value ? String(value).trim() : "");

const readEnvValue = (key: string) => {
  const metaEnv =
    typeof import.meta === "undefined"
      ? undefined
      : (import.meta as ImportMeta).env;
  if (!metaEnv) return "";
  return trimValue(metaEnv?.[key as keyof ImportMetaEnv] as string | undefined);
};

// ---------------------------------------------------------------------------
// Supabase configuration
// ---------------------------------------------------------------------------

const supabaseUrl = readEnvValue("VITE_SUPABASE_URL");
const supabaseAnonKey = readEnvValue("VITE_SUPABASE_ANON_KEY");

export const supabaseConfig = {
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  hasSupabase: Boolean(supabaseUrl && supabaseAnonKey),
};

console.info("[config] supabase:", supabaseConfig.hasSupabase);
