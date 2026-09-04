/**
 * Format de document iSkul.
 *
 * Un PDF est une mise en page, pas un contenu : on ne peut ni le chercher, ni
 * le relire sur un telephone, ni relier une epreuve a son corrige question par
 * question. Ce format remplace le fichier par une suite de blocs adressables.
 *
 * La liste est volontairement plate plutot qu'arborescente. Un bloc porte son
 * etiquette imprimee ("Exercice 2", "1.a") et son rattachement ; il reste donc
 * citable seul, affichable en liste virtualisee, et atteignable par un lien
 * direct. Une arborescence rendrait chacune de ces trois choses plus couteuse
 * sans rien apporter a la lecture.
 *
 * Les blocs proviennent d'un modele de langue qui lit le PDF : rien de ce qui
 * arrive ici n'est fiable. Toutes les fonctions de lecture sont donc
 * defensives et ne levent jamais -- un document a moitie valide se relit et se
 * corrige, un document rejete est perdu.
 */

export const DOCUMENT_FORMAT_VERSION = 1;

export type BlockKind =
  | "heading"
  | "paragraph"
  | "instruction"
  | "exercise"
  | "question"
  | "list"
  | "table"
  | "figure"
  | "formula";

export type DocumentBlock = {
  /** Stable : sert d'ancre de lien et de cle de rendu. */
  id: string;
  kind: BlockKind;
  /** Etiquette telle qu'imprimee sur le document : "Exercice 2", "1.a". */
  label?: string;
  text?: string;
  /** Bareme annonce par le document. */
  points?: number;
  /** Rattachement a l'exercice courant, par identifiant de bloc. */
  parentId?: string;
  /** heading : niveau de titre. */
  level?: 1 | 2 | 3;
  /** list */
  ordered?: boolean;
  items?: string[];
  /** table */
  rows?: string[][];
  headerRow?: boolean;
  /** formula : notation LaTeX. */
  latex?: string;
  /** figure */
  caption?: string;
  /** Ce que la figure represente, decrit par l'extraction. Sert aussi de texte
   *  alternatif tant que l'image n'est pas fournie. */
  description?: string;
  /** Chemin Storage de l'image. Absent tant qu'un humain ne l'a pas deposee. */
  assetPath?: string | null;
  /** Page du PDF d'origine, pour retrouver la figure a decouper. */
  pageIndex?: number;
};

export type LibraryDocument = {
  version: number;
  blocks: DocumentBlock[];
};

export type DocumentReference = {
  institution: { name: string | null; city: string | null } | null;
  /** "2023-2024" */
  schoolYear: string | null;
  /** "Session normale", "Juin", "Rattrapage". */
  session: string | null;
  /** Serie du lycee : A, C, D... Vide au college. */
  series: string | null;
  /** Auteur ou redacteur du document. */
  author: string | null;
};

export const EMPTY_REFERENCE: DocumentReference = {
  institution: null,
  schoolYear: null,
  session: null,
  series: null,
  author: null,
};

const KINDS: BlockKind[] = [
  "heading",
  "paragraph",
  "instruction",
  "exercise",
  "question",
  "list",
  "table",
  "figure",
  "formula",
];

/* -------------------------------------------------------------------------- */
/* Lecture defensive                                                          */
/* -------------------------------------------------------------------------- */

function str(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function nullableStr(value: unknown): string | null {
  return str(value) ?? null;
}

function num(value: unknown): number | undefined {
  // Number(null) vaut 0 et Number(true) vaut 1 : les deux passeraient pour un
  // bareme valide.
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  // Number("") vaut 0 : une chaine vide passerait pour un bareme de zero point
  // reellement annonce.
  const text = str(value);
  if (!text) return undefined;
  const parsed = Number(text.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function strList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.map(str).filter((v): v is string => !!v);
  return items.length ? items : undefined;
}

function strGrid(value: unknown): string[][] | undefined {
  if (!Array.isArray(value)) return undefined;
  const rows = value
    .map((row) => (Array.isArray(row) ? row.map((cell) => str(cell) ?? "") : null))
    .filter((row): row is string[] => !!row && row.some((cell) => cell.length > 0));
  return rows.length ? rows : undefined;
}

/**
 * Un bloc dont le type est inconnu ou dont le contenu est vide n'apporte rien
 * a la relecture : il est ecarte plutot que rendu vide.
 */
export function parseBlock(raw: unknown, index: number): DocumentBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Record<string, unknown>;

  const kindRaw = str(input.kind)?.toLowerCase();
  const kind = KINDS.find((k) => k === kindRaw);
  if (!kind) return null;

  const block: DocumentBlock = {
    id: str(input.id) ?? `b${index + 1}`,
    kind,
  };

  const label = str(input.label);
  if (label) block.label = label;
  const text = str(input.text);
  if (text) block.text = text;
  const points = num(input.points);
  if (points !== undefined && points >= 0) block.points = points;
  const parentId = str(input.parentId);
  if (parentId) block.parentId = parentId;

  switch (kind) {
    case "heading": {
      const level = num(input.level);
      block.level = level === 2 ? 2 : level === 3 ? 3 : 1;
      if (!block.text) return null;
      break;
    }
    case "list": {
      const items = strList(input.items);
      if (!items) return null;
      block.items = items;
      block.ordered = input.ordered === true;
      break;
    }
    case "table": {
      const rows = strGrid(input.rows);
      if (!rows) return null;
      block.rows = rows;
      block.headerRow = input.headerRow !== false;
      break;
    }
    case "figure": {
      const description = str(input.description);
      const caption = str(input.caption);
      // Une figure sans description ne peut ni etre relue ni servir de texte
      // alternatif : elle n'est pas exploitable.
      if (!description && !caption) return null;
      if (description) block.description = description;
      if (caption) block.caption = caption;
      block.assetPath = nullableStr(input.assetPath);
      const page = num(input.pageIndex);
      if (page !== undefined && page >= 0) block.pageIndex = Math.floor(page);
      break;
    }
    case "formula": {
      const latex = str(input.latex);
      if (!latex) return null;
      block.latex = latex;
      break;
    }
    case "exercise": {
      // Un exercice tient par son etiquette : "Exercice 2" sans enonce reste
      // un point d'entree valide.
      if (!block.label && !block.text) return null;
      break;
    }
    default: {
      if (!block.text) return null;
      break;
    }
  }

  return block;
}

/** Lit un document quel que soit son etat. Ne leve jamais. */
export function parseDocument(raw: unknown): LibraryDocument {
  let source: unknown = raw;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      return { version: DOCUMENT_FORMAT_VERSION, blocks: [] };
    }
  }
  if (!source || typeof source !== "object") {
    return { version: DOCUMENT_FORMAT_VERSION, blocks: [] };
  }

  const input = source as Record<string, unknown>;
  const rawBlocks = Array.isArray(input.blocks)
    ? input.blocks
    : Array.isArray(source)
    ? (source as unknown[])
    : [];

  const blocks: DocumentBlock[] = [];
  const seen = new Set<string>();
  rawBlocks.forEach((item, index) => {
    const block = parseBlock(item, index);
    if (!block) return;
    // Deux blocs de meme identifiant rendraient les ancres ambigues.
    let id = block.id;
    let suffix = 2;
    while (seen.has(id)) id = `${block.id}-${suffix++}`;
    seen.add(id);
    blocks.push({ ...block, id });
  });

  const version = num(input.version);
  return {
    version: version && version > 0 ? Math.floor(version) : DOCUMENT_FORMAT_VERSION,
    blocks,
  };
}

export function parseReference(raw: unknown): DocumentReference {
  let source: unknown = raw;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      return { ...EMPTY_REFERENCE };
    }
  }
  if (!source || typeof source !== "object") return { ...EMPTY_REFERENCE };
  const input = source as Record<string, unknown>;

  const rawInstitution = input.institution;
  let institution: DocumentReference["institution"] = null;
  if (rawInstitution && typeof rawInstitution === "object") {
    const inst = rawInstitution as Record<string, unknown>;
    const name = nullableStr(inst.name);
    const city = nullableStr(inst.city);
    if (name || city) institution = { name, city };
  }

  return {
    institution,
    schoolYear: normalizeSchoolYear(input.schoolYear),
    session: nullableStr(input.session),
    series: nullableStr(input.series)?.toUpperCase() ?? null,
    author: nullableStr(input.author),
  };
}

/**
 * Ramene "2023 2024", "2023/2024" ou "2023-24" a la forme "2023-2024".
 * Une annee scolaire mal formee empeche de trier et de regrouper les epreuves.
 */
export function normalizeSchoolYear(raw: unknown): string | null {
  const value = str(raw);
  if (!value) return null;
  const match = /(\d{4})\s*[-/–]?\s*(\d{2,4})?/.exec(value);
  if (!match) return null;
  const start = Number(match[1]);
  if (!Number.isFinite(start) || start < 1960 || start > 2100) return null;
  if (!match[2]) return String(start);
  const tail = match[2];
  const end = tail.length === 2 ? Number(String(start).slice(0, 2) + tail) : Number(tail);
  if (!Number.isFinite(end) || end !== start + 1) return String(start);
  return `${start}-${end}`;
}

/* -------------------------------------------------------------------------- */
/* Lecture du contenu                                                         */
/* -------------------------------------------------------------------------- */

/** Texte brut du document, pour l'indexation et la recherche. */
export function documentPlainText(doc: LibraryDocument): string {
  const parts: string[] = [];
  for (const block of doc.blocks) {
    if (block.label) parts.push(block.label);
    if (block.text) parts.push(block.text);
    if (block.items) parts.push(block.items.join(" "));
    if (block.rows) parts.push(block.rows.map((r) => r.join(" ")).join(" "));
    if (block.caption) parts.push(block.caption);
    if (block.description) parts.push(block.description);
  }
  return parts.join("\n").trim();
}

export type OutlineEntry = {
  id: string;
  label: string;
  kind: "exercise" | "question";
  points?: number;
};

/** Sommaire : les exercices et leurs questions, dans l'ordre du document. */
export function documentOutline(doc: LibraryDocument): OutlineEntry[] {
  const entries: OutlineEntry[] = [];
  for (const block of doc.blocks) {
    if (block.kind !== "exercise" && block.kind !== "question") continue;
    const label = block.label || block.text?.slice(0, 60);
    if (!label) continue;
    entries.push({
      id: block.id,
      label,
      kind: block.kind,
      ...(block.points !== undefined ? { points: block.points } : {}),
    });
  }
  return entries;
}

/** Bareme total annonce, ou null si le document n'en porte pas. */
export function totalPoints(doc: LibraryDocument): number | null {
  const scored = doc.blocks.filter((b) => b.points !== undefined);
  if (!scored.length) return null;
  // Un exercice qui annonce son bareme le repartit entre ses questions :
  // additionner les deux le compterait deux fois.
  const exercises = scored.filter((b) => b.kind === "exercise");
  const source = exercises.length ? exercises : scored;
  return source.reduce((sum, b) => sum + (b.points ?? 0), 0);
}

/** Figures encore sans image : ce sont elles qui bloquent la publication. */
export function pendingFigures(doc: LibraryDocument): DocumentBlock[] {
  return doc.blocks.filter((b) => b.kind === "figure" && !b.assetPath);
}

/* -------------------------------------------------------------------------- */
/* Porte de publication                                                       */
/* -------------------------------------------------------------------------- */

export type PublishCheck = { ok: boolean; reasons: string[] };

/**
 * Ce qui empeche de publier, en toutes lettres.
 *
 * La reference porte la credibilite du document : une epreuve sans
 * etablissement ni annee ne vaut rien pour un eleve qui revise.
 */
export function checkPublishable(
  doc: LibraryDocument,
  reference: DocumentReference,
  options: { isExam: boolean }
): PublishCheck {
  const reasons: string[] = [];

  if (!doc.blocks.length) {
    reasons.push("Le document ne contient aucun bloc.");
  }

  const missing = pendingFigures(doc);
  if (missing.length) {
    reasons.push(
      missing.length === 1
        ? "Une figure attend encore son image."
        : `${missing.length} figures attendent encore leur image.`
    );
  }

  if (options.isExam) {
    if (!reference.institution?.name) {
      reasons.push("Renseignez l'etablissement qui a fait passer l'epreuve.");
    }
    if (!reference.schoolYear && !reference.session) {
      reasons.push("Renseignez l'annee scolaire ou la session.");
    }
  }

  return { ok: reasons.length === 0, reasons };
}
