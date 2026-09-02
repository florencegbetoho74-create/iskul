// Logique pure des referentiels : aucune dependance React Native ni Supabase,
// afin de rester testable et reutilisable cote web.

export type Country = {
  code: string;
  nameFr: string;
  flag: string;
  hasContent: boolean;
};

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

export type Language = {
  code: string;
  label: string;
  isLocal: boolean;
  orderIndex: number;
};

/** Pays dont le programme sert de repli tant qu'un pays n'a pas son contenu. */
export const DEFAULT_CONTENT_COUNTRY = "BJ";

const GRADE_ALIASES: Record<string, string> = {
  "6e": "6e",
  "6eme": "6e",
  "5e": "5e",
  "5eme": "5e",
  "4e": "4e",
  "4eme": "4e",
  "3e": "3e",
  "3eme": "3e",
  "2nde": "2nde",
  "2de": "2nde",
  "2nd": "2nde",
  seconde: "2nde",
  "1ere": "1ere",
  "1re": "1ere",
  premiere: "1ere",
  tle: "Terminale",
  terminale: "Terminale",
};

function fold(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Ramene un libelle de classe saisi librement vers un code du referentiel.
 * Renvoie null si aucun alias connu ne correspond.
 */
export function normalizeGradeCode(input?: string | null): string | null {
  const folded = fold(String(input ?? ""));
  if (!folded) return null;
  return GRADE_ALIASES[folded] ?? null;
}

/** Derive le drapeau emoji depuis un code ISO 3166-1 alpha-2. */
export function countryFlagFromCode(code?: string | null): string {
  const raw = String(code ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(raw)) return "";
  const base = 0x1f1e6;
  return (
    String.fromCodePoint(base + raw.charCodeAt(0) - 65) +
    String.fromCodePoint(base + raw.charCodeAt(1) - 65)
  );
}

export type ContentScope = {
  /** Pays dont le programme sera effectivement servi. */
  countryCode: string;
  /** Vrai quand on sert le programme d'un autre pays que celui de l'eleve. */
  isFallback: boolean;
  /** Pays declare par l'eleve, conserve meme en repli. */
  requestedCountryCode: string | null;
};

/**
 * Decide quel programme servir a un eleve.
 *
 * Regle produit : l'eleve voit le contenu de son pays des qu'il existe. Tant
 * qu'il n'existe pas, il recoit le programme du pays de repli plutot qu'un
 * ecran vide -- et l'interface doit le dire explicitement.
 */
export function resolveContentScope(input: {
  requestedCountryCode?: string | null;
  countriesWithContent: readonly string[];
  fallbackCountryCode?: string;
}): ContentScope {
  const fallback = (input.fallbackCountryCode || DEFAULT_CONTENT_COUNTRY).toUpperCase();
  const requested = String(input.requestedCountryCode ?? "").trim().toUpperCase() || null;
  const available = new Set(input.countriesWithContent.map((c) => String(c).toUpperCase()));

  if (requested && available.has(requested)) {
    return { countryCode: requested, isFallback: false, requestedCountryCode: requested };
  }
  return { countryCode: fallback, isFallback: true, requestedCountryCode: requested };
}

/**
 * Classe les pays pour un selecteur : ceux qui ont du contenu d'abord, puis
 * l'ordre alphabetique francais.
 */
export function sortCountriesForPicker(countries: readonly Country[]): Country[] {
  return [...countries].sort((a, b) => {
    if (a.hasContent !== b.hasContent) return a.hasContent ? -1 : 1;
    return a.nameFr.localeCompare(b.nameFr, "fr", { sensitivity: "base" });
  });
}

/** Recherche insensible aux accents et a la casse dans une liste de pays. */
export function filterCountries(countries: readonly Country[], query: string): Country[] {
  const needle = fold(query);
  if (!needle) return [...countries];
  return countries.filter(
    (c) => fold(c.nameFr).includes(needle) || fold(c.code).includes(needle)
  );
}

/** Trie les niveaux du plus bas au plus eleve. */
export function sortGradeLevels(levels: readonly GradeLevel[]): GradeLevel[] {
  return [...levels].sort((a, b) => a.orderIndex - b.orderIndex);
}

/** Retrouve un niveau par son identifiant ou, a defaut, par son code. */
export function findGradeLevel(
  levels: readonly GradeLevel[],
  ref: { id?: string | null; code?: string | null }
): GradeLevel | null {
  const id = String(ref.id ?? "").trim();
  if (id) {
    const byId = levels.find((l) => l.id === id);
    if (byId) return byId;
  }
  const code = normalizeGradeCode(ref.code) ?? String(ref.code ?? "").trim();
  if (!code) return null;
  return levels.find((l) => l.code === code) ?? null;
}
