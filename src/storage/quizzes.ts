import { supabase, SUPABASE_READY } from "@/lib/supabase";
import { canonicalizeGradeLabel } from "@/constants/gradeLevels";
import { canonicalizeCourseSubject } from "@/constants/courseSubjects";

export type QuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctIndices: number[];
};

export type Quiz = {
  id: string;
  courseId?: string | null;
  lessonId?: string | null;
  level?: string;
  subject?: string;
  scope: "lesson" | "standalone";
  title: string;
  description?: string;
  questions: QuizQuestion[];
  published: boolean;
  ownerId: string;
  courseTitle?: string;
  lessonTitle?: string;
  createdAtMs: number;
  updatedAtMs: number;
};

export type QuizAttempt = {
  id: string;
  quizId: string;
  userId: string;
  answers: number[][];
  score: number;
  maxScore: number;
  createdAtMs: number;
};

function normalizeIndices(input: any, max: number): number[] {
  if (!Array.isArray(input)) return [];
  const cleaned = input
    .map((v: any) => Number(v))
    .filter((v: number) => Number.isFinite(v))
    .map((v: number) => Math.floor(v))
    .filter((v: number) => v >= 0 && v < max);
  return Array.from(new Set(cleaned));
}

function normalizeQuestions(input: any): QuizQuestion[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((q) => {
      const options = Array.isArray(q?.options) ? q.options.map((o: any) => String(o)) : [];
      const fromArray = normalizeIndices(q?.correctIndices, options.length);
      const fromSingle = Number.isFinite(q?.correctIndex)
        ? normalizeIndices([q.correctIndex], options.length)
        : [];
      const correctIndices = (fromArray.length ? fromArray : fromSingle).slice(0, 1);
      return {
        id: String(q?.id || ""),
        prompt: String(q?.prompt || ""),
        options,
        correctIndices,
      } as QuizQuestion;
    })
    .filter((q) => q.id && q.prompt);
}

function mapQuiz(row: any): Quiz {
  const courseRel = Array.isArray(row?.courses) ? row.courses[0] : row?.courses;
  const chapterRel = Array.isArray(row?.chapters) ? row.chapters[0] : row?.chapters;
  const courseId = row.course_id ?? courseRel?.id ?? null;
  const lessonId = row.chapter_id ?? chapterRel?.id ?? null;
  const level = canonicalizeGradeLabel(row.level ?? courseRel?.level ?? "");
  const subject = canonicalizeCourseSubject(row.subject ?? courseRel?.subject ?? "");
  return {
    id: row.id,
    courseId,
    lessonId,
    level: level || undefined,
    subject: subject || undefined,
    scope: courseId && lessonId ? "lesson" : "standalone",
    title: row.title,
    description: row.description ?? undefined,
    questions: normalizeQuestions(row.questions),
    published: !!row.published,
    ownerId: row.owner_id,
    courseTitle: courseRel?.title ?? undefined,
    lessonTitle: chapterRel?.title ?? undefined,
    createdAtMs: row.created_at_ms ?? 0,
    updatedAtMs: row.updated_at_ms ?? 0,
  };
}

function normalizeAttemptAnswers(input: any): number[][] {
  if (!Array.isArray(input)) return [];
  return input.map((entry) => {
    if (Array.isArray(entry)) {
      return normalizeIndices(entry, Number.MAX_SAFE_INTEGER);
    }
    if (Number.isFinite(entry)) {
      return [Math.floor(Number(entry))];
    }
    return [];
  });
}

function mapAttempt(row: any): QuizAttempt {
  return {
    id: row.id,
    quizId: row.quiz_id,
    userId: row.user_id,
    answers: normalizeAttemptAnswers(row.answers),
    score: Number(row.score || 0),
    maxScore: Number(row.max_score || 0),
    createdAtMs: row.created_at_ms ?? 0,
  };
}

export async function getQuizByLesson(courseId: string, lessonId: string): Promise<Quiz | null> {
  if (!SUPABASE_READY || !courseId || !lessonId) return null;
  const { data, error } = await supabase
    .from("quizzes")
    .select("*, courses(id,title,level,subject), chapters(id,title)")
    .eq("course_id", courseId)
    .eq("chapter_id", lessonId)
    .maybeSingle();
  if (error || !data) return null;
  return mapQuiz(data);
}

export async function getQuizById(quizId: string): Promise<Quiz | null> {
  if (!SUPABASE_READY || !quizId) return null;
  const { data, error } = await supabase
    .from("quizzes")
    .select("*, courses(id,title,level,subject), chapters(id,title)")
    .eq("id", quizId)
    .maybeSingle();
  if (error || !data) return null;
  return mapQuiz(data);
}

export async function listQuizzes(input?: {
  ownerId?: string;
  publishedOnly?: boolean;
  scope?: "lesson" | "standalone" | "all";
  limit?: number;
}): Promise<Quiz[]> {
  if (!SUPABASE_READY) return [];
  let q = supabase
    .from("quizzes")
    .select("*, courses(id,title,level,subject,published), chapters(id,title)")
    .order("updated_at_ms", { ascending: false });

  if (input?.ownerId) q = q.eq("owner_id", input.ownerId);
  if (input?.publishedOnly) q = q.eq("published", true);

  const scope = input?.scope || "all";
  if (scope === "lesson") {
    q = q.not("course_id", "is", null).not("chapter_id", "is", null);
  } else if (scope === "standalone") {
    q = q.is("course_id", null).is("chapter_id", null);
  }

  if (input?.limit && input.limit > 0) q = q.limit(input.limit);

  const { data, error } = await q;
  if (error || !data) return [];
  return (data as any[]).map(mapQuiz);
}

export async function saveQuiz(input: {
  id?: string | null;
  courseId?: string | null;
  lessonId?: string | null;
  level?: string | null;
  subject?: string | null;
  title: string;
  description?: string | null;
  questions: QuizQuestion[];
  published?: boolean;
  ownerId: string;
}): Promise<Quiz> {
  if (!SUPABASE_READY) throw new Error("Supabase non configure.");
  const level = canonicalizeGradeLabel(input.level || "");
  const subject = canonicalizeCourseSubject(input.subject || "");
  const isStandaloneTarget = !input.courseId && !input.lessonId;
  const cleanedQuestions = (input.questions || []).map((q) => {
    const options = Array.isArray(q.options) ? q.options.map((o) => String(o)) : [];
    return {
      ...q,
      options,
      correctIndices: normalizeIndices(q.correctIndices, options.length).slice(0, 1),
    };
  });
  const payload: any = {
    id: input.id ?? undefined,
    course_id: input.courseId ?? null,
    chapter_id: input.lessonId ?? null,
    title: input.title,
    description: input.description ?? null,
    questions: cleanedQuestions,
    published: !!input.published,
    owner_id: input.ownerId,
  };
  if (isStandaloneTarget) {
    payload.level = level || null;
    payload.subject = subject || null;
  }
  let data: any = null;
  let error: any = null;
  if (input.id) {
    ({ data, error } = await supabase
      .from("quizzes")
      .upsert(payload, { onConflict: "id" })
      .select("*, courses(id,title,level,subject), chapters(id,title)")
      .single());
  } else if (input.courseId && input.lessonId) {
    ({ data, error } = await supabase
      .from("quizzes")
      .upsert(payload, { onConflict: "course_id,chapter_id" })
      .select("*, courses(id,title,level,subject), chapters(id,title)")
      .single());
  } else {
    ({ data, error } = await supabase
      .from("quizzes")
      .insert(payload)
      .select("*, courses(id,title,level,subject), chapters(id,title)")
      .single());
  }
  if (error || !data) throw error || new Error("Quiz non enregistre.");
  return mapQuiz(data);
}

export async function getQuizAttempt(quizId: string, userId: string): Promise<QuizAttempt | null> {
  if (!SUPABASE_READY || !quizId || !userId) return null;
  const { data, error } = await supabase
    .from("quiz_attempts")
    .select("*")
    .eq("quiz_id", quizId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return mapAttempt(data);
}

export async function submitQuizAttempt(input: {
  quizId: string;
  userId: string;
  answers: number[][];
  score: number;
  maxScore: number;
}): Promise<QuizAttempt> {
  if (!SUPABASE_READY) throw new Error("Supabase non configure.");
  const payload = {
    quiz_id: input.quizId,
    user_id: input.userId,
    answers: Array.isArray(input.answers) ? input.answers : [],
    score: Math.max(0, Math.floor(input.score || 0)),
    max_score: Math.max(0, Math.floor(input.maxScore || 0)),
  };
  const { data, error } = await supabase
    .from("quiz_attempts")
    .upsert(payload, { onConflict: "quiz_id,user_id" })
    .select("*")
    .single();
  if (error || !data) throw error || new Error("Resultat non enregistre.");
  return mapAttempt(data);
}
