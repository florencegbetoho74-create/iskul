import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase, SUPABASE_READY } from "@/lib/supabase";
import {
  DEFAULT_CONTENT_COUNTRY,
  countryFlagFromCode,
  resolveContentScope,
  sortCountriesForPicker,
  sortGradeLevels,
  type ContentScope,
  type Country,
  type GradeLevel,
  type Language,
  type Subject,
} from "@/lib/referentialSupport";

export type { ContentScope, Country, GradeLevel, Language, Subject };
export { DEFAULT_CONTENT_COUNTRY };

/**
 * Les referentiels changent au rythme des reformes scolaires, pas des sessions.
 * On les garde en memoire pour la session et sur disque pour les demarrages
 * suivants : le formulaire d'inscription s'affiche alors sans attendre le reseau.
 */
const DISK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DISK_PREFIX = "referentials:v1:";

type CacheEntry<T> = { value: T; fetchedAtMs: number };

const memory = new Map<string, CacheEntry<unknown>>();

async function readDisk<T>(key: string): Promise<{ hit: true; value: T } | { hit: false }> {
  try {
    const raw = await AsyncStorage.getItem(DISK_PREFIX + key);
    if (!raw) return { hit: false };
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (!parsed || typeof parsed.fetchedAtMs !== "number") return { hit: false };
    if (Date.now() - parsed.fetchedAtMs > DISK_TTL_MS) return { hit: false };
    return { hit: true, value: parsed.value };
  } catch {
    return { hit: false };
  }
}

async function writeDisk<T>(key: string, value: T): Promise<void> {
  try {
    const entry: CacheEntry<T> = { value, fetchedAtMs: Date.now() };
    await AsyncStorage.setItem(DISK_PREFIX + key, JSON.stringify(entry));
  } catch {
    // Un cache indisponible ne doit jamais empecher l'ecran de s'afficher.
  }
}

async function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const hit = memory.get(key) as CacheEntry<T> | undefined;
  if (hit) return hit.value;

  const fromDisk = await readDisk<T>(key);
  if (fromDisk.hit) {
    memory.set(key, { value: fromDisk.value, fetchedAtMs: Date.now() });
    // Rafraichissement silencieux : l'ecran affiche le cache, la base corrige apres.
    loader()
      .then((fresh) => {
        memory.set(key, { value: fresh, fetchedAtMs: Date.now() });
        return writeDisk(key, fresh);
      })
      .catch(() => {});
    return fromDisk.value;
  }

  const fresh = await loader();
  memory.set(key, { value: fresh, fetchedAtMs: Date.now() });
  await writeDisk(key, fresh);
  return fresh;
}

/** Vide le cache : a appeler apres une modification du referentiel cote admin. */
export async function invalidateReferentials(): Promise<void> {
  memory.clear();
  try {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter((k) => k.startsWith(DISK_PREFIX));
    if (mine.length) await AsyncStorage.multiRemove(mine);
  } catch {
    // idem : best effort
  }
}

function mapCountry(row: any): Country {
  const code = String(row?.code ?? "").toUpperCase();
  return {
    code,
    nameFr: String(row?.name_fr ?? code),
    flag: String(row?.flag ?? "") || countryFlagFromCode(code),
    hasContent: !!row?.has_content,
  };
}

function mapGradeLevel(row: any): GradeLevel {
  const cycle = String(row?.cycle ?? "college");
  return {
    id: String(row?.id ?? ""),
    code: String(row?.code ?? ""),
    label: String(row?.label ?? row?.code ?? ""),
    cycle: cycle === "primaire" || cycle === "lycee" ? cycle : "college",
    orderIndex: Number(row?.order_index ?? 0),
  };
}

function mapSubject(row: any): Subject {
  return {
    id: String(row?.id ?? ""),
    code: String(row?.code ?? ""),
    label: String(row?.label ?? row?.code ?? ""),
    orderIndex: Number(row?.order_index ?? 0),
  };
}

function mapLanguage(row: any): Language {
  return {
    code: String(row?.code ?? ""),
    label: String(row?.label ?? row?.code ?? ""),
    isLocal: !!row?.is_local,
    orderIndex: Number(row?.order_index ?? 0),
  };
}

/** Liste ISO complete, pays disposant de contenu en tete. */
export async function listCountries(): Promise<Country[]> {
  if (!SUPABASE_READY) return [];
  return cached("countries", async () => {
    const { data, error } = await supabase
      .from("countries")
      .select("code,name_fr,flag,has_content")
      .order("name_fr", { ascending: true });
    if (error) throw error;
    return sortCountriesForPicker(((data as any[]) || []).map(mapCountry));
  });
}

/** Codes ISO des pays pour lesquels du contenu existe reellement. */
export async function listCountriesWithContent(): Promise<string[]> {
  const countries = await listCountries().catch(() => [] as Country[]);
  return countries.filter((c) => c.hasContent).map((c) => c.code);
}

async function getSystemId(countryCode: string): Promise<string | null> {
  if (!SUPABASE_READY) return null;
  const code = String(countryCode || "").toUpperCase();
  if (!code) return null;
  return cached(`system:${code}`, async () => {
    const { data, error } = await supabase
      .from("education_systems")
      .select("id")
      .eq("country_code", code)
      .eq("is_default", true)
      .maybeSingle();
    if (error) throw error;
    return (data as any)?.id ? String((data as any).id) : null;
  });
}

/**
 * Programme effectivement servi a un eleve : le sien s'il existe, celui du
 * pays de repli sinon. L'appelant doit afficher `isFallback` a l'utilisateur.
 */
export async function resolveScopeForCountry(countryCode?: string | null): Promise<ContentScope> {
  const withContent = await listCountriesWithContent();
  return resolveContentScope({
    requestedCountryCode: countryCode,
    countriesWithContent: withContent,
    fallbackCountryCode: DEFAULT_CONTENT_COUNTRY,
  });
}

/** Niveaux scolaires du programme servi pour ce pays (repli compris). */
export async function listGradeLevels(countryCode?: string | null): Promise<GradeLevel[]> {
  if (!SUPABASE_READY) return [];
  const scope = await resolveScopeForCountry(countryCode);
  const systemId = await getSystemId(scope.countryCode);
  if (!systemId) return [];
  return cached(`grades:${systemId}`, async () => {
    const { data, error } = await supabase
      .from("grade_levels")
      .select("id,code,label,cycle,order_index")
      .eq("system_id", systemId)
      .order("order_index", { ascending: true });
    if (error) throw error;
    return sortGradeLevels(((data as any[]) || []).map(mapGradeLevel));
  });
}

/** Matieres du programme servi pour ce pays (repli compris). */
export async function listSubjects(countryCode?: string | null): Promise<Subject[]> {
  if (!SUPABASE_READY) return [];
  const scope = await resolveScopeForCountry(countryCode);
  const systemId = await getSystemId(scope.countryCode);
  if (!systemId) return [];
  return cached(`subjects:${systemId}`, async () => {
    const { data, error } = await supabase
      .from("subjects")
      .select("id,code,label,order_index")
      .eq("system_id", systemId)
      .order("order_index", { ascending: true });
    if (error) throw error;
    return ((data as any[]) || []).map(mapSubject);
  });
}

/** Langues d'enseignement disponibles pour ce pays (repli compris). */
export async function listLanguages(countryCode?: string | null): Promise<Language[]> {
  if (!SUPABASE_READY) return [];
  const scope = await resolveScopeForCountry(countryCode);
  return cached(`languages:${scope.countryCode}`, async () => {
    const { data, error } = await supabase
      .from("country_languages")
      .select("languages(code,label,is_local,order_index)")
      .eq("country_code", scope.countryCode);
    if (error) throw error;
    const rows = ((data as any[]) || [])
      .map((row) => (Array.isArray(row?.languages) ? row.languages[0] : row?.languages))
      .filter(Boolean)
      .map(mapLanguage);
    return rows.sort((a, b) => a.orderIndex - b.orderIndex);
  });
}
