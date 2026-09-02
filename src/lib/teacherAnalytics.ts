// Lecture du payload renvoye par teacher_dashboard().
//
// Le serveur renvoie un jsonb agrege : arrondis numeriques, agregats vides
// remplaces par des tableaux, valeurs nulles quand un eleve n'a jamais repondu.
// Un tableau de bord qui affiche NaN vaut moins qu'un tableau de bord a zero.

export type TeacherWeakQuestion = {
  id: string;
  quizTitle: string;
  prompt: string;
  /** Taux de reussite entre 0 et 1. */
  accuracy: number;
  attempts: number;
};

export type TeacherAtRiskLearner = {
  userId: string;
  name: string;
  completionRate: number;
  attempts: number;
};

export type TeacherCourseStat = {
  courseId: string;
  title: string;
  published: boolean;
  learners: number;
  completionRate: number;
};

export type TeacherChapterStat = {
  chapterId: string;
  courseId: string;
  title: string;
  learners: number;
  completionRate: number;
};

export type TeacherQuizStat = {
  quizId: string;
  title: string;
  attempts: number;
  avgScorePct: number;
};

export type TeacherDailyStat = {
  day: string;
  attempts: number;
  learners: number;
  avgScorePct: number;
};

export type TeacherDashboardSnapshot = {
  learnerCount: number;
  completionRate: number;
  lessonsCompleted: number;
  quizAttempts: number;
  quizAttemptsRecent: number;
  atRiskCount: number;
  courseCount: number;
  coursesPublished: number;
  chapterCount: number;
  quizCount: number;
  periodDays: number;
  weakQuestions: TeacherWeakQuestion[];
  atRiskLearners: TeacherAtRiskLearner[];
  courses: TeacherCourseStat[];
  chapters: TeacherChapterStat[];
  quizzes: TeacherQuizStat[];
  daily: TeacherDailyStat[];
};

export const EMPTY_TEACHER_DASHBOARD: TeacherDashboardSnapshot = {
  learnerCount: 0,
  completionRate: 0,
  lessonsCompleted: 0,
  quizAttempts: 0,
  quizAttemptsRecent: 0,
  atRiskCount: 0,
  courseCount: 0,
  coursesPublished: 0,
  chapterCount: 0,
  quizCount: 0,
  periodDays: 30,
  weakQuestions: [],
  atRiskLearners: [],
  courses: [],
  chapters: [],
  quizzes: [],
  daily: [],
};

function num(value: unknown, fallback = 0): number {
  // Number(null) vaut 0 et Number("") aussi : on veut le repli explicite.
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function list(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

/** Convertit le payload serveur en instantane exploitable par l'interface. */
export function parseTeacherDashboard(input: unknown): TeacherDashboardSnapshot {
  if (!input || typeof input !== "object") return EMPTY_TEACHER_DASHBOARD;
  const root = input as Record<string, unknown>;
  const totals = (root.totals || {}) as Record<string, unknown>;

  return {
    learnerCount: num(totals.learners),
    completionRate: clamp01(num(totals.completionRate)),
    lessonsCompleted: num(totals.lessonsCompleted),
    quizAttempts: num(totals.quizAttempts),
    quizAttemptsRecent: num(totals.quizAttemptsRecent),
    atRiskCount: num(totals.atRiskCount),
    courseCount: num(totals.courses),
    coursesPublished: num(totals.coursesPublished),
    chapterCount: num(totals.chapters),
    quizCount: num(totals.quizzes),
    periodDays: num(root.periodDays, 30),

    weakQuestions: list(root.weakQuestions).map((q) => ({
      id: `${q?.quizId ?? ""}:${num(q?.questionIndex)}`,
      quizTitle: String(q?.quizTitle ?? "Quiz"),
      prompt: String(q?.prompt ?? "Question"),
      accuracy: clamp01(num(q?.successRate)),
      attempts: num(q?.answers),
    })),

    atRiskLearners: list(root.atRiskLearners).map((l) => ({
      userId: String(l?.userId ?? ""),
      name: String(l?.name ?? "Eleve"),
      completionRate: clamp01(num(l?.completionRate)),
      attempts: num(l?.attempts),
    })),

    courses: list(root.courses).map((c) => ({
      courseId: String(c?.courseId ?? ""),
      title: String(c?.title ?? "Cours"),
      published: c?.published === true,
      learners: num(c?.learners),
      completionRate: clamp01(num(c?.completionRate)),
    })),

    chapters: list(root.chapters).map((c) => ({
      chapterId: String(c?.chapterId ?? ""),
      courseId: String(c?.courseId ?? ""),
      title: String(c?.title ?? "Chapitre"),
      learners: num(c?.learners),
      completionRate: clamp01(num(c?.completionRate)),
    })),

    quizzes: list(root.quizzes).map((q) => ({
      quizId: String(q?.quizId ?? ""),
      title: String(q?.title ?? "Quiz"),
      attempts: num(q?.attempts),
      avgScorePct: num(q?.avgScorePct),
    })),

    daily: list(root.daily).map((d) => ({
      day: String(d?.day ?? ""),
      attempts: num(d?.attempts),
      learners: num(d?.learners),
      avgScorePct: num(d?.avgScorePct),
    })),
  };
}
