// src/lib/supabase.ts
import "react-native-url-polyfill/auto";          // ✅ URL, URLSearchParams pour RN
import "react-native-get-random-values";          // ✅ crypto.getRandomValues pour RN
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

// ⚠️ Mets bien ton REF et la clé publishable/anon via .env
const SUPABASE_URL = (
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  ""
).trim();
const SUPABASE_ANON_KEY = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  ""
).trim();

if (!SUPABASE_URL) {
  console.warn("[supabase] Missing EXPO_PUBLIC_SUPABASE_URL.");
} else if (!SUPABASE_URL.startsWith("https://")) {
  console.warn("[supabase] URL invalide. Il faut https://<ref>.supabase.co");
}
if (!SUPABASE_ANON_KEY) {
  console.warn("[supabase] Missing EXPO_PUBLIC_SUPABASE_ANON_KEY.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // RN: pas de deep-link callback
  },
  global: {
    headers: {
      // Si tu veux forcer un schema: "Accept-Profile": "public"
    },
  },
  realtime: {
    // marche par défaut en WSS; rien à changer
  },
});

export const SUPABASE_READY =
  !!SUPABASE_URL &&
  SUPABASE_URL.startsWith("https://") &&
  !!SUPABASE_ANON_KEY;
