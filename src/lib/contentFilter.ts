// Construction des filtres de contenu envoyes a PostgREST.
//
// Le parametre `or=` de PostgREST est une chaine dont la virgule et la
// parenthese sont des separateurs. Y concatener une valeur non validee permet
// d'injecter des conditions arbitraires -- et donc de lire du contenu hors
// perimetre. Toutes les valeurs passent donc par une validation stricte.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COUNTRY_RE = /^[A-Za-z]{2}$/;

/** Renvoie l'UUID normalise, ou null si l'entree n'est pas un UUID. */
export function safeUuid(input?: string | null): string | null {
  const raw = String(input ?? "").trim();
  return UUID_RE.test(raw) ? raw.toLowerCase() : null;
}

/** Renvoie le code pays ISO normalise, ou null si l'entree est invalide. */
export function safeCountryCode(input?: string | null): string | null {
  const raw = String(input ?? "").trim();
  return COUNTRY_RE.test(raw) ? raw.toUpperCase() : null;
}

/**
 * Filtre sur la classe.
 *
 * Regle produit : un contenu sans classe est "tous niveaux" et reste visible.
 * Renvoie null quand aucune classe n'est connue -- l'appelant n'applique alors
 * aucun filtre plutot que d'inventer un perimetre.
 */
export function gradeLevelFilter(gradeLevelId?: string | null): string | null {
  const id = safeUuid(gradeLevelId);
  if (!id) return null;
  return `grade_level_id.eq.${id},grade_level_id.is.null`;
}

/** Filtre sur le pays, avec la meme tolerance pour les contenus non rattaches. */
export function countryFilter(countryCode?: string | null): string | null {
  const code = safeCountryCode(countryCode);
  if (!code) return null;
  return `country_code.eq.${code},country_code.is.null`;
}

/** Echappe une recherche texte destinee a un `ilike` PostgREST. */
export function escapeSearchTerm(input: string): string {
  return String(input ?? "")
    .trim()
    .replace(/[\\%_,().*]/g, (m) => "\\" + m);
}

/**
 * Construit le filtre `or` d'une recherche plein texte sur plusieurs colonnes.
 * Renvoie null si le terme est vide apres nettoyage.
 */
export function searchFilter(term: string, columns: readonly string[]): string | null {
  const safe = escapeSearchTerm(term);
  if (!safe) return null;
  if (!columns.length) return null;
  return columns.map((col) => `${col}.ilike.*${safe}*`).join(",");
}

export type Page = { limit: number; offset: number };

const MAX_PAGE_SIZE = 100;

/** Borne une pagination pour qu'une valeur aberrante ne ramene pas toute la table. */
export function safePage(input?: { limit?: number; offset?: number }): Page {
  const rawLimit = Number(input?.limit);
  const rawOffset = Number(input?.offset);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.floor(rawLimit), 1), MAX_PAGE_SIZE)
    : 20;
  const offset = Number.isFinite(rawOffset) ? Math.max(Math.floor(rawOffset), 0) : 0;
  return { limit, offset };
}

/** Bornes inclusives attendues par `.range()` de supabase-js. */
export function pageRange(page: Page): [number, number] {
  return [page.offset, page.offset + page.limit - 1];
}
