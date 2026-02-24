import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || "").trim();
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
const HAS_SUPABASE_CONFIG = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const OFFICIAL_WEB_ENV_READY = HAS_SUPABASE_CONFIG;
export const OFFICIAL_WEB_ENV_ERROR = HAS_SUPABASE_CONFIG
  ? null
  : "Le service iSkul est temporairement indisponible.";

if (!HAS_SUPABASE_CONFIG && import.meta.env.DEV) {
  const missingEnv: string[] = [];
  if (!SUPABASE_URL) missingEnv.push("VITE_SUPABASE_URL");
  if (!SUPABASE_ANON_KEY) missingEnv.push("VITE_SUPABASE_ANON_KEY");
  console.warn(`[web-official] Missing env in development: ${missingEnv.join(", ")}`);
}

const FALLBACK_URL = "https://placeholder.supabase.co";
const FALLBACK_KEY = "placeholder-anon-key";

export const supabase = createClient(SUPABASE_URL || FALLBACK_URL, SUPABASE_ANON_KEY || FALLBACK_KEY);
