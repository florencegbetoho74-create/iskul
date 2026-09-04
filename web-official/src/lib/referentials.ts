import { supabase } from "./supabase";

/**
 * Referentiel scolaire.
 *
 * L'espace professeur du web enregistrait la classe et la matiere en texte
 * libre, la ou l'application ecrit des identifiants du referentiel. Un cours
 * cree depuis le web n'avait donc pas de `grade_level_id` -- et n'apparaissait
 * jamais dans la portee "Ma classe" d'un eleve, qui filtre sur ce champ. Ce
 * n'etait pas un manque d'interface mais une panne silencieuse.
 *
 * Les requetes sont identiques a celles de src/storage/referentials.ts cote
 * application. Le cache tient pour la session : un programme scolaire change au
 * rythme des reformes, pas des visites.
 */

export const DEFAULT_CONTENT_COUNTRY = "BJ";

export type GradeLevel = {
  id: string;
  code: string;
  label: string;
  cycle: "primaire" | "college" | "lycee";
  orderIndex: number;
};

export type Subject = {
  id: string;
  code: string;
  label: string;
  orderIndex: number;
};

const cache = new Map<string, unknown>();

async function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  if (cache.has(key)) return cache.get(key) as T;
  const value = await loader();
  cache.set(key, value);
  return value;
}

async function getSystemId(countryCode: string): Promise<string | null> {
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
    const row = data as { id?: string } | null;
    return row?.id ? String(row.id) : null;
  });
}

const CYCLE_ORDER: Record<GradeLevel["cycle"], number> = {
  primaire: 0,
  college: 1,
  lycee: 2,
};

export async function listGradeLevels(
  countryCode: string = DEFAULT_CONTENT_COUNTRY
): Promise<GradeLevel[]> {
  const systemId = await getSystemId(countryCode);
  if (!systemId) return [];
  return cached(`grades:${systemId}`, async () => {
    const { data, error } = await supabase
      .from("grade_levels")
      .select("id,code,label,cycle,order_index")
      .eq("system_id", systemId)
      .order("order_index", { ascending: true });
    if (error) throw error;
    const rows = ((data as Record<string, unknown>[]) || []).map((row) => ({
      id: String(row.id),
      code: String(row.code ?? ""),
      label: String(row.label ?? ""),
      cycle: (row.cycle as GradeLevel["cycle"]) ?? "college",
      orderIndex: Number(row.order_index ?? 0),
    }));
    // La 6e du college doit preceder la 2nde du lycee, meme si les index sont
    // numerotes independamment dans chaque cycle.
    return rows.sort(
      (a, b) => CYCLE_ORDER[a.cycle] - CYCLE_ORDER[b.cycle] || a.orderIndex - b.orderIndex
    );
  });
}

export async function listSubjects(
  countryCode: string = DEFAULT_CONTENT_COUNTRY
): Promise<Subject[]> {
  const systemId = await getSystemId(countryCode);
  if (!systemId) return [];
  return cached(`subjects:${systemId}`, async () => {
    const { data, error } = await supabase
      .from("subjects")
      .select("id,code,label,order_index")
      .eq("system_id", systemId)
      .order("order_index", { ascending: true });
    if (error) throw error;
    return ((data as Record<string, unknown>[]) || []).map((row) => ({
      id: String(row.id),
      code: String(row.code ?? ""),
      label: String(row.label ?? ""),
      orderIndex: Number(row.order_index ?? 0),
    }));
  });
}

/* -------------------------------------------------------------------------- */
/* Langues d'enseignement                                                     */
/* -------------------------------------------------------------------------- */

export type LocalLanguage = { key: string; label: string };

/**
 * Les quatre langues dans lesquelles un chapitre peut exister en plus du
 * francais. La liste est figee cote application ; elle l'est ici aussi pour que
 * les deux formulaires proposent exactement les memes champs.
 */
export const LOCAL_LANGUAGES: LocalLanguage[] = [
  { key: "fon", label: "Fon" },
  { key: "adja", label: "Adja" },
  { key: "yoruba", label: "Yoruba" },
  { key: "dendi", label: "Dendi" },
];

export type VideoByLang = Record<string, string>;

/** Ne garde que les langues reellement renseignees. */
export function cleanVideoByLang(input: VideoByLang): VideoByLang | null {
  const out: VideoByLang = {};
  for (const { key } of LOCAL_LANGUAGES) {
    const value = (input[key] || "").trim();
    if (value) out[key] = value;
  }
  return Object.keys(out).length ? out : null;
}

export function readVideoByLang(raw: unknown): VideoByLang {
  const out: VideoByLang = {};
  if (!raw || typeof raw !== "object") return out;
  const source = raw as Record<string, unknown>;
  for (const { key } of LOCAL_LANGUAGES) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) out[key] = value.trim();
  }
  return out;
}

/**
 * Les memes refus que l'editeur de l'application : un lien YouTube n'est pas
 * lisible par le lecteur, un lien indirect s'ouvre hors de l'application.
 */
export function checkVideoUrl(url: string): { ok: boolean; reason?: string } {
  const value = (url || "").trim();
  if (!value) return { ok: true };
  if (/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(value)) {
    return {
      ok: false,
      reason: "Les liens YouTube ne sont pas lisibles dans l'application.",
    };
  }
  return { ok: true };
}

export function isDirectMediaUrl(url: string): boolean {
  const value = (url || "").trim();
  return (
    /\.(mp4|m4v|mov|webm)(\?|$)/i.test(value) ||
    /\.m3u8(\?|$)/i.test(value) ||
    /\.mpd(\?|$)/i.test(value)
  );
}
