// Lecture du tableau de bord eleve.
//
// Le serveur renvoie un jsonb agrege ou l'absence est frequente : pas de
// reprise en cours, aucun live prevu, une semaine sans activite. Chaque cas
// doit produire un ecran juste, pas un NaN ni une carte vide.

export type ResumeItem = {
  courseId: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
  watchedSec: number;
  durationSec: number;
  /** Avancement entre 0 et 1. */
  percent: number;
  updatedAtMs: number;
};

export type WeeklyPoint = { day: string; minutes: number; lessons: number };

export type PendingQuiz = {
  quizId: string;
  title: string;
  subject?: string | null;
  courseId?: string | null;
};

export type NextLive = {
  liveId: string;
  title: string;
  startAtMs: number;
  status: "scheduled" | "live";
  ownerName?: string | null;
};

export type FreshCourse = {
  courseId: string;
  title: string;
  subject?: string | null;
  coverUrl?: string | null;
};

export type StudentTotals = {
  minutesThisPeriod: number;
  lessonsCompleted: number;
  quizAttempts: number;
  quizAvgScorePct: number;
  coursesAvailable: number;
};

export type StudentDashboard = {
  periodDays: number;
  totals: StudentTotals;
  resume: ResumeItem | null;
  weekly: WeeklyPoint[];
  pendingQuizzes: PendingQuiz[];
  nextLive: NextLive | null;
  freshCourses: FreshCourse[];
};

export const EMPTY_STUDENT_DASHBOARD: StudentDashboard = {
  periodDays: 7,
  totals: {
    minutesThisPeriod: 0,
    lessonsCompleted: 0,
    quizAttempts: 0,
    quizAvgScorePct: 0,
    coursesAvailable: 0,
  },
  resume: null,
  weekly: [],
  pendingQuizzes: [],
  nextLive: null,
  freshCourses: [],
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

export function parseStudentDashboard(input: unknown): StudentDashboard {
  if (!input || typeof input !== "object") return EMPTY_STUDENT_DASHBOARD;
  const root = input as Record<string, unknown>;
  const totals = (root.totals || {}) as Record<string, unknown>;

  const rawResume = root.resume;
  const resume =
    rawResume && typeof rawResume === "object"
      ? (() => {
          const r = rawResume as Record<string, unknown>;
          const courseId = String(r.courseId ?? "");
          const lessonId = String(r.lessonId ?? "");
          // Sans les deux identifiants, la carte ne menerait nulle part.
          if (!courseId || !lessonId) return null;
          return {
            courseId,
            courseTitle: String(r.courseTitle ?? "Cours"),
            lessonId,
            lessonTitle: String(r.lessonTitle ?? "Chapitre"),
            watchedSec: num(r.watchedSec),
            durationSec: num(r.durationSec),
            percent: clamp01(num(r.percent)),
            updatedAtMs: num(r.updatedAtMs),
          } as ResumeItem;
        })()
      : null;

  const rawLive = root.nextLive;
  const nextLive =
    rawLive && typeof rawLive === "object"
      ? (() => {
          const l = rawLive as Record<string, unknown>;
          const liveId = String(l.liveId ?? "");
          if (!liveId) return null;
          return {
            liveId,
            title: String(l.title ?? "Seance en direct"),
            startAtMs: num(l.startAtMs),
            status: l.status === "live" ? "live" : "scheduled",
            ownerName: (l.ownerName as string) ?? null,
          } as NextLive;
        })()
      : null;

  return {
    periodDays: num(root.periodDays, 7),
    totals: {
      minutesThisPeriod: num(totals.minutesThisPeriod),
      lessonsCompleted: num(totals.lessonsCompleted),
      quizAttempts: num(totals.quizAttempts),
      quizAvgScorePct: num(totals.quizAvgScorePct),
      coursesAvailable: num(totals.coursesAvailable),
    },
    resume,
    weekly: list(root.weekly).map((d) => ({
      day: String(d?.day ?? ""),
      minutes: num(d?.minutes),
      lessons: num(d?.lessons),
    })),
    pendingQuizzes: list(root.pendingQuizzes).map((q) => ({
      quizId: String(q?.quizId ?? ""),
      title: String(q?.title ?? "Quiz"),
      subject: q?.subject ?? null,
      courseId: q?.courseId ?? null,
    })),
    nextLive,
    freshCourses: list(root.freshCourses).map((c) => ({
      courseId: String(c?.courseId ?? ""),
      title: String(c?.title ?? "Cours"),
      subject: c?.subject ?? null,
      coverUrl: c?.coverUrl ?? null,
    })),
  };
}

/**
 * Salutation selon l'heure locale.
 * Un "Bonjour" a 21 h sonne faux et trahit une interface qui ne regarde pas
 * qui elle a en face.
 */
export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return "Bonne nuit";
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon apres-midi";
  return "Bonsoir";
}

/** Temps restant avant un live, en clair. */
export function liveCountdown(startAtMs: number, now = Date.now()): string {
  const diff = startAtMs - now;
  if (diff <= 0) return "En direct maintenant";
  const minutes = Math.round(diff / 60000);
  if (minutes < 60) return `Dans ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Dans ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "Demain" : `Dans ${days} jours`;
}

/**
 * Serie de jours consecutifs avec au moins une minute d'activite, en
 * remontant depuis aujourd'hui. La regularite est deja mesuree en base ; elle
 * n'etait simplement jamais montree a l'eleve.
 */
export function currentStreak(weekly: readonly WeeklyPoint[]): number {
  let streak = 0;
  for (let i = weekly.length - 1; i >= 0; i -= 1) {
    if (weekly[i].minutes > 0) streak += 1;
    else break;
  }
  return streak;
}
