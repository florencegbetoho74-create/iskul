import type { ContentStatus } from "@/lib/contentStatus";

export type Book = {
  id: string;
  title: string;
  subject?: string;
  level?: string;
  countryCode?: string | null;
  gradeLevelId?: string | null;
  subjectId?: string | null;
  documentTypeId?: string | null;
  examName?: string | null;
  examYear?: number | null;
  examSession?: string | null;
  author?: string | null;
  /** Serie du lycee (A, C, D). Vide au college. */
  series?: string | null;
  /** Un corrige pointe vers son epreuve. */
  linkedDocumentId?: string | null;
  /** Blocs structures produits par la chaine de traitement. */
  content?: unknown;
  /** Fiche de reference : etablissement, annee scolaire, session. */
  reference?: unknown;
  sourcePageCount?: number | null;

  price?: number;           // 0 ou undefined => Gratuit
  coverUrl?: string | null; // miniature
  /**
   * Lien Storage du fichier d'origine, pour les documents anterieurs a la
   * chaine de traitement. Vide des lors que le document porte son contenu.
   */
  fileUrl: string;
  ownerId: string;
  ownerName?: string;
  published?: boolean;
  status?: ContentStatus;
  reviewNote?: string | null;

  createdAtMs?: number;
  updatedAtMs?: number;
};
