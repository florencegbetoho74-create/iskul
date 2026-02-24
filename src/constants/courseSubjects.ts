export const COURSE_SUBJECTS = [
  "Français",
  "Anglais",
  "Philosophie",
  "Histoire-Géographie",
  "SVT",
  "Physique-Chimie (PCT)",
  "Maths",
  "Informatique",
] as const;

export type CourseSubject = (typeof COURSE_SUBJECTS)[number];

const aliasMap: Record<string, CourseSubject> = {
  francais: "Français",
  french: "Français",
  anglais: "Anglais",
  english: "Anglais",
  philosophie: "Philosophie",
  "histoiregeographie": "Histoire-Géographie",
  hg: "Histoire-Géographie",
  svt: "SVT",
  "physiquechimie": "Physique-Chimie (PCT)",
  pct: "Physique-Chimie (PCT)",
  maths: "Maths",
  mathematiques: "Maths",
  informatique: "Informatique",
  info: "Informatique",
};

function normalizeToken(input: string) {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function canonicalizeCourseSubject(input?: string | null): string {
  const raw = (input || "").trim();
  if (!raw) return "";
  const token = normalizeToken(raw);
  return aliasMap[token] || raw;
}

export function isKnownCourseSubject(value?: string | null): value is CourseSubject {
  return COURSE_SUBJECTS.includes(value as CourseSubject);
}
