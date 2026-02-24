export const GRADE_LEVELS = ["6e", "5e", "4e", "3e", "2nde", "1ere", "Terminale"] as const;

export type GradeLevel = (typeof GRADE_LEVELS)[number];

const aliasMap: Record<string, GradeLevel> = {
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
  "seconde": "2nde",
  "1ere": "1ere",
  "1re": "1ere",
  "premiere": "1ere",
  "terminale": "Terminale",
};

function normalizeToken(input: string) {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function canonicalizeGradeLabel(input?: string | null): string {
  const raw = (input || "").trim();
  if (!raw) return "";
  const token = normalizeToken(raw);
  return aliasMap[token] || raw;
}

export function isKnownGradeLevel(value?: string | null): value is GradeLevel {
  return GRADE_LEVELS.includes(value as GradeLevel);
}

export function normalizeCourseLevel(input?: string | null): string {
  const level = canonicalizeGradeLabel(input);
  return level || "Non precise";
}
