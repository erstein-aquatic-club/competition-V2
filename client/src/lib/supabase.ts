import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const hasCredentials = Boolean(supabaseUrl && supabaseAnonKey);

if (!hasCredentials) {
  console.warn(
    "[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing. " +
      "Supabase features will not work.",
  );
}

export const supabase: SupabaseClient = hasCredentials
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (new Proxy({} as SupabaseClient, {
      get: (_target, prop) => {
        if (prop === "auth") {
          return {
            getSession: async () => ({ data: { session: null }, error: null }),
            refreshSession: async () => ({ data: { session: null }, error: null }),
            signInWithPassword: async () => ({
              data: { session: null, user: null },
              error: { message: "Supabase not configured" },
            }),
            signUp: async () => ({
              data: { session: null, user: null },
              error: { message: "Supabase not configured" },
            }),
            signOut: async () => ({ error: null }),
            onAuthStateChange: () => ({
              data: { subscription: { unsubscribe: () => {} } },
            }),
            updateUser: async () => ({
              data: { user: null },
              error: { message: "Supabase not configured" },
            }),
            getUser: async () => ({ data: { user: null }, error: null }),
          };
        }
        if (prop === "from") {
          return () =>
            new Proxy(
              {},
              {
                get: () => () =>
                  Promise.resolve({
                    data: null,
                    error: { message: "Supabase not configured" },
                  }),
              },
            );
        }
        if (prop === "rpc") {
          return () =>
            Promise.resolve({
              data: null,
              error: { message: "Supabase not configured" },
            });
        }
        if (prop === "functions") {
          return {
            invoke: async () => ({
              data: null,
              error: { message: "Supabase not configured" },
            }),
          };
        }
        return undefined;
      },
    }) as unknown as SupabaseClient);
