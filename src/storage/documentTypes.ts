import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase, SUPABASE_READY } from "@/lib/supabase";
import {
  FALLBACK_DOCUMENT_TYPE,
  parseDocumentTypes,
  type DocumentType,
} from "@/lib/documentTaxonomy";

export type { DocumentType };
export { FALLBACK_DOCUMENT_TYPE };

const CACHE_KEY = "referentials:v1:documentTypes";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let memory: { value: DocumentType[]; fetchedAtMs: number } | null = null;

async function readDisk(): Promise<DocumentType[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { value: unknown; fetchedAtMs: number };
    if (Date.now() - Number(parsed?.fetchedAtMs || 0) > CACHE_TTL_MS) return null;
    const types = parseDocumentTypes(parsed.value);
    return types.length ? types : null;
  } catch {
    return null;
  }
}

async function writeDisk(value: DocumentType[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ value, fetchedAtMs: Date.now() })
    );
  } catch {
    // Un cache indisponible ne doit pas empecher l'ecran de s'afficher.
  }
}

async function fetchTypes(): Promise<DocumentType[]> {
  const { data, error } = await supabase
    .from("document_types")
    .select("id,code,label,plural_label,is_exam,order_index")
    .order("order_index", { ascending: true });
  if (error) throw error;
  return parseDocumentTypes(data);
}

/**
 * Types de documents du referentiel.
 * Mis en cache comme les autres referentiels : ils ne changent qu'a la main,
 * depuis la console d'administration.
 */
export async function listDocumentTypes(): Promise<DocumentType[]> {
  if (!SUPABASE_READY) return [];
  if (memory) return memory.value;

  const cached = await readDisk();
  if (cached) {
    memory = { value: cached, fetchedAtMs: Date.now() };
    fetchTypes()
      .then((fresh) => {
        memory = { value: fresh, fetchedAtMs: Date.now() };
        return writeDisk(fresh);
      })
      .catch(() => {});
    return cached;
  }

  const fresh = await fetchTypes();
  memory = { value: fresh, fetchedAtMs: Date.now() };
  await writeDisk(fresh);
  return fresh;
}

export async function invalidateDocumentTypes(): Promise<void> {
  memory = null;
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch {
    // best effort
  }
}

/** Cree ou met a jour un type de document. Reserve aux administrateurs. */
export async function upsertDocumentType(input: {
  code: string;
  label: string;
  pluralLabel?: string | null;
  isExam?: boolean;
  orderIndex?: number;
}): Promise<void> {
  if (!SUPABASE_READY) throw new Error("Supabase non configure.");
  const { error } = await supabase.rpc("admin_upsert_document_type", {
    p_code: input.code,
    p_label: input.label,
    p_plural_label: input.pluralLabel ?? null,
    p_is_exam: input.isExam ?? false,
    p_order_index: input.orderIndex ?? 100,
  });
  if (error) throw new Error(error.message || "Type non enregistre.");
  await invalidateDocumentTypes();
}

/**
 * Supprime un type. Les documents rattaches repassent en "Autre document"
 * plutot que de disparaitre.
 */
export async function deleteDocumentType(code: string): Promise<void> {
  if (!SUPABASE_READY) throw new Error("Supabase non configure.");
  const { error } = await supabase.rpc("admin_delete_document_type", { p_code: code });
  if (error) {
    const message = String(error.message || "");
    if (message.includes("cannot_delete_fallback")) {
      throw new Error("Le type de repli ne peut pas etre supprime.");
    }
    if (message.includes("type_not_found")) throw new Error("Ce type n'existe plus.");
    throw new Error(message || "Suppression impossible.");
  }
  await invalidateDocumentTypes();
}
