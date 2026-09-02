// Lecture des corrections renvoyees par le serveur.
//
// Ces objets viennent d'un jsonb construit en base : on ne suppose rien de leur
// forme, une correction mal lue afficherait une mauvaise reponse a l'eleve.

export type QuizCorrectionEntry = {
  questionIndex: number;
  chosenIndex: number | null;
  correctIndices: number[];
  isCorrect: boolean;
};

function toInt(value: unknown): number | null {
  // Number(null) vaut 0 : sans ce garde-fou, une question sans reponse
  // s'afficherait comme si l'eleve avait choisi la premiere option.
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.floor(n) : null;
}

function toIndexList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const cleaned = value
    .map(toInt)
    .filter((v): v is number => v !== null && v >= 0);
  return Array.from(new Set(cleaned)).sort((a, b) => a - b);
}

/** Normalise une entree de correction ; renvoie null si elle est inexploitable. */
export function parseCorrectionEntry(
  input: unknown,
  fallbackIndex = 0
): QuizCorrectionEntry | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;

  const questionIndex = toInt(raw.questionIndex);
  const chosenIndex = toInt(raw.chosenIndex);

  return {
    questionIndex: questionIndex !== null && questionIndex >= 0 ? questionIndex : fallbackIndex,
    chosenIndex: chosenIndex !== null && chosenIndex >= 0 ? chosenIndex : null,
    correctIndices: toIndexList(raw.correctIndices),
    isCorrect: raw.isCorrect === true,
  };
}

/** Normalise la liste complete, dans l'ordre des questions. */
export function parseCorrection(input: unknown): QuizCorrectionEntry[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((entry, i) => parseCorrectionEntry(entry, i))
    .filter((entry): entry is QuizCorrectionEntry => entry !== null)
    .sort((a, b) => a.questionIndex - b.questionIndex);
}

/**
 * Nombre de bonnes reponses d'apres la correction serveur.
 * Sert uniquement a l'affichage : la note de reference reste celle calculee et
 * stockee en base.
 */
export function countCorrect(entries: readonly QuizCorrectionEntry[]): number {
  return entries.reduce((acc, e) => acc + (e.isCorrect ? 1 : 0), 0);
}
