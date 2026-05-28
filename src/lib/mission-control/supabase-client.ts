import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const supabaseClient =
  isValidSupabaseBrowserConfig(supabaseUrl, supabaseAnonKey)
    ? createClient(supabaseUrl, supabaseAnonKey!)
    : null;

export function isSupabaseRealtimeConfigured() {
  return Boolean(supabaseClient);
}

function isValidSupabaseBrowserConfig(
  url: string | undefined,
  anonKey: string | undefined,
): url is string {
  if (!url || !anonKey) return false;
  if (url.includes("replace-with") || anonKey.includes("replace-with")) return false;
  if (!url.startsWith("https://") || !url.endsWith(".supabase.co")) return false;
  if (anonKey.startsWith("sb_secret_")) return false;
  if (anonKey.length < 40) return false;
  return anonKey.startsWith("sb_publishable_") || anonKey.split(".").length === 3;
}
