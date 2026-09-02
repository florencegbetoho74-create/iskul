// Taxonomie des documents de la bibliotheque.
//
// Une epreuve de BEPC, une oeuvre au programme et une fiche de revision ne se
// cherchent pas de la meme facon : le type porte les metadonnees qui comptent.

export type DocumentType = {
  id: string;
  code: string;
  label: string;
  pluralLabel: string;
  /** Un type d'examen porte un nom d'examen, une annee et une session. */
  isExam: boolean;
  orderIndex: number;
};

export type DocumentExamInfo = {
  examName?: string | null;
  examYear?: number | null;
  examSession?: string | null;
};

/** Code de repli pour tout document non classe. */
export const FALLBACK_DOCUMENT_TYPE = "autre";

export function parseDocumentType(input: unknown): DocumentType | null {
  if (!input || typeof input !== "object") return null;
  const row = input as Record<string, unknown>;
  const code = String(row.code ?? "").trim();
  if (!code) return null;
  const label = String(row.label ?? code);
  return {
    id: String(row.id ?? ""),
    code,
    label,
    pluralLabel: String(row.plural_label ?? row.pluralLabel ?? label),
    isExam: (row.is_exam ?? row.isExam) === true,
    orderIndex: Number.isFinite(Number(row.order_index ?? row.orderIndex))
      ? Number(row.order_index ?? row.orderIndex)
      : 100,
  };
}

export function parseDocumentTypes(input: unknown): DocumentType[] {
  if (!Array.isArray(input)) return [];
  return input
    .map(parseDocumentType)
    .filter((t): t is DocumentType => t !== null)
    .sort((a, b) => a.orderIndex - b.orderIndex || a.label.localeCompare(b.label, "fr"));
}

/**
 * Libelle d'examen affichable.
 * Renvoie une chaine vide plutot qu'un libelle bancal quand rien n'est connu :
 * mieux vaut ne rien afficher qu'afficher "undefined 0".
 */
export function formatExamLabel(info: DocumentExamInfo): string {
  const parts: string[] = [];
  const name = String(info.examName ?? "").trim();
  const session = String(info.examSession ?? "").trim();
  const year = Number(info.examYear);

  if (name) parts.push(name);
  if (session) parts.push(session);
  if (Number.isFinite(year) && year > 0) parts.push(String(Math.floor(year)));

  return parts.join(" · ");
}

/** Une annee d'examen plausible : ni faute de frappe, ni date lointaine. */
export function isValidExamYear(value: unknown): boolean {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1960 && year <= 2100;
}

export type DocumentGroup<T> = {
  type: DocumentType;
  items: T[];
};

/**
 * Regroupe des documents par type, en respectant l'ordre du referentiel.
 * Les types sans document ne sont pas renvoyes : une section vide n'apprend
 * rien a l'eleve.
 */
export function groupByDocumentType<T extends { documentTypeId?: string | null }>(
  items: readonly T[],
  types: readonly DocumentType[]
): DocumentGroup<T>[] {
  const byId = new Map<string, T[]>();
  items.forEach((item) => {
    const key = String(item.documentTypeId ?? "");
    const bucket = byId.get(key);
    if (bucket) bucket.push(item);
    else byId.set(key, [item]);
  });

  const groups: DocumentGroup<T>[] = [];
  types.forEach((type) => {
    const bucket = byId.get(type.id);
    if (bucket?.length) groups.push({ type, items: bucket });
  });
  return groups;
}
