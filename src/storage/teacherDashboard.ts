import { SUPABASE_READY, supabase } from "@/lib/supabase";

type CourseRow = {
  id: string;
  title?: string | null;
  chapters?: Array<{ id?: string; title?: string; order?: number }> | null;
};

type ProgressRow = {
  user_id: string;
  course_id: string;
  chapter_id: string;
  watched_sec?: number | null;
  duration_sec?: number | null;
};

type QuizRow = {
  id: string;
  title?: string | null;
  questions?: any[] | null;
};

type AttemptRow = {
  quiz_id: string;
  user_id: string;
  answers?: any[] | null;
};

type ProfileRow = {
  id: string;
  name?: string | null;
};

export type TeacherWeakQuestion = {
  id: string;
  quizTitle: string;
  prompt: string;
  accuracy: number;
  attempts: number;
};

export type TeacherAtRiskLearner = {
  userId: string;
  name: string;
  completionRate: number;
  attempts: number;
};

export type TeacherDashboardSnapshot = {
  learnerCount: number;
  completionRate: number;
  quizAttempts: number;
  atRiskCount: number;
  weakQuestions: TeacherWeakQuestion[];
  atRiskLearners: TeacherAtRiskLearner[];
};

function clamp01(v: number) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function toNumber(v: unknown) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

function getAnswerIndex(value: unknown): number | null {
  if (Array.isArray(value)) {
    const first = value[0];
    const n = Number(first);
    if (!Number.isFinite(n)) return null;
    return Math.floor(n);
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.floor(n);
}

function normalizeCorrectIndices(question: any): number[] {
  const options = Array.isArray(question?.options) ? question.options : [];
  const max = options.length;
  const rawArray = Array.isArray(question?.correctIndices) ? question.correctIndices : [];
  const rawSingle = Number.isFinite(question?.correctIndex) ? [question.correctIndex] : [];
  const combined = [...rawArray, ...rawSingle];
  const cleaned = combined
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v))
    .map((v) => Math.floor(v))
    .filter((v) => v >= 0 && v < max);
  return Array.from(new Set(cleaned));
}

function progressRatio(row: ProgressRow) {
  const watched = Math.max(0, toNumber(row.watched_sec));
  const duration = Math.max(0, toNumber(row.duration_sec));
  if (duration > 0) return clamp01(watched / duration);
  // Approximation fallback when duration is unknown.
  return clamp01(watched / 600);
}

export async function getTeacherDashboard(ownerId: string): Promise<TeacherDashboardSnapshot> {
  const empty: TeacherDashboardSnapshot = {
    learnerCount: 0,
    completionRate: 0,
    quizAttempts: 0,
    atRiskCount: 0,
    weakQuestions: [],
    atRiskLearners: [],
  };
  if (!ownerId || !SUPABASE_READY) return empty;

  const { data: courseData, error: courseErr } = await supabase
    .from("courses")
    .select("id,title,chapters")
    .eq("owner_id", ownerId);
  if (courseErr) return empty;

  const courses = (courseData as CourseRow[]) || [];
  const courseIds = courses.map((c) => c.id).filter(Boolean);

  const [{ data: progressData }, { data: quizData }] = await Promise.all([
    courseIds.length
      ? supabase
          .from("lesson_progress")
          .select("user_id,course_id,chapter_id,watched_sec,duration_sec")
          .in("course_id", courseIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("quizzes")
      .select("id,title,questions")
      .eq("owner_id", ownerId),
  ]);

  const progressRows = (progressData as ProgressRow[] | null) || [];
  const quizzes = (quizData as QuizRow[] | null) || [];
  const quizIds = quizzes.map((q) => q.id).filter(Boolean);

  const { data: attemptData } = quizIds.length
    ? await supabase
        .from("quiz_attempts")
        .select("quiz_id,user_id,answers")
        .in("quiz_id", quizIds)
    : { data: [] };
  const attempts = (attemptData as AttemptRow[] | null) || [];

  const learnerIds = new Set<string>();
  const learnerAgg = new Map<string, { sum: number; count: number }>();

  let completedRows = 0;
  for (const row of progressRows) {
    if (!row?.user_id) continue;
    learnerIds.add(row.user_id);
    const ratio = progressRatio(row);
    if (ratio >= 0.9) completedRows += 1;
    const prev = learnerAgg.get(row.user_id) || { sum: 0, count: 0 };
    learnerAgg.set(row.user_id, { sum: prev.sum + ratio, count: prev.count + 1 });
  }

  const completionRate = progressRows.length ? completedRows / progressRows.length : 0;
  const quizAttempts = attempts.length;

  const attemptsByUser = new Map<string, number>();
  for (const a of attempts) {
    if (!a?.user_id) continue;
    attemptsByUser.set(a.user_id, (attemptsByUser.get(a.user_id) || 0) + 1);
  }

  const atRiskRaw = Array.from(learnerAgg.entries())
    .map(([userId, agg]) => ({
      userId,
      completionRate: agg.count ? agg.sum / agg.count : 0,
      attempts: attemptsByUser.get(userId) || 0,
      count: agg.count,
    }))
    .filter((x) => x.count >= 2 && x.completionRate < 0.4)
    .sort((a, b) => a.completionRate - b.completionRate)
    .slice(0, 8);

  const atRiskIds = atRiskRaw.map((x) => x.userId);
  const { data: profileData } = atRiskIds.length
    ? await supabase.from("profiles").select("id,name").in("id", atRiskIds)
    : { data: [] };
  const profileMap = new Map<string, string>();
  ((profileData as ProfileRow[] | null) || []).forEach((p) => {
    profileMap.set(p.id, p.name || "Eleve");
  });

  const atRiskLearners: TeacherAtRiskLearner[] = atRiskRaw.map((x) => ({
    userId: x.userId,
    name: profileMap.get(x.userId) || "Eleve",
    completionRate: clamp01(x.completionRate),
    attempts: x.attempts,
  }));

  const weakStat = new Map<string, { quizTitle: string; prompt: string; attempts: number; correct: number }>();
  const quizMap = new Map<string, QuizRow>(quizzes.map((q) => [q.id, q]));

  for (const attempt of attempts) {
    const quiz = quizMap.get(attempt.quiz_id);
    if (!quiz) continue;
    const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
    const answers = Array.isArray(attempt.answers) ? attempt.answers : [];
    for (let idx = 0; idx < questions.length; idx += 1) {
      const q = questions[idx];
      const key = `${quiz.id}:${idx}`;
      const prev = weakStat.get(key) || {
        quizTitle: quiz.title || "Quiz",
        prompt: String(q?.prompt || `Question ${idx + 1}`),
        attempts: 0,
        correct: 0,
      };
      const chosen = getAnswerIndex(answers[idx]);
      const correctSet = normalizeCorrectIndices(q);
      if (chosen !== null) {
        prev.attempts += 1;
        if (correctSet.includes(chosen)) prev.correct += 1;
      }
      weakStat.set(key, prev);
    }
  }

  const weakQuestions: TeacherWeakQuestion[] = Array.from(weakStat.entries())
    .map(([id, stat]) => {
      const accuracy = stat.attempts ? stat.correct / stat.attempts : 0;
      return {
        id,
        quizTitle: stat.quizTitle,
        prompt: stat.prompt,
        accuracy: clamp01(accuracy),
        attempts: stat.attempts,
      };
    })
    .filter((q) => q.attempts >= 3)
    .sort((a, b) => {
      if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
      return b.attempts - a.attempts;
    })
    .slice(0, 5);

  return {
    learnerCount: learnerIds.size,
    completionRate: clamp01(completionRate),
    quizAttempts,
    atRiskCount: atRiskLearners.length,
    weakQuestions,
    atRiskLearners,
  };
}
