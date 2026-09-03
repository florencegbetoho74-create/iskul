import { supabase, SUPABASE_READY } from "@/lib/supabase";
import { canonicalizeGradeLabel } from "@/constants/gradeLevels";
import { canonicalizeCourseSubject } from "@/constants/courseSubjects";
import { parseContentStatus, type ContentStatus } from "@/lib/contentStatus";
import {
  parseCorrection as mapCorrection,
  type QuizCorrectionEntry,
} from "@/lib/quizCorrection";

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
  countryCode?: string | null;
  gradeLevelId?: string | null;
  subjectId?: string | null;
  scope: "lesson" | "standalone";
  title: string;
  description?: string;
  questions: QuizQuestion[];
  published: boolean;
  status: ContentStatus;
  reviewNote?: string | null;
  ownerId: string;
  courseTitle?: string;
  lessonTitle?: string;
  createdAtMs: number;
  updatedAtMs: number;
};

export type { QuizCorrectionEntry };

export type QuizAttempt = {
  id: string;
  quizId: string;
  userId: string;
  answers: number[][];
  score: number;
  maxScore: number;
  attemptNo: number;
  durationMs?: number | null;
  detail: QuizCorrectionEntry[];
  createdAtMs: number;
};

export type QuizSubmission = {
  quizId: string;
  score: number;
  maxScore: number;
  attemptNo: number;
  detail: QuizCorrectionEntry[];
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
  const courseId = row.course_id ?? null;
  const lessonId = row.chapter_id ?? null;
  const level = canonicalizeGradeLabel(row.level ?? "");
  const subject = canonicalizeCourseSubject(row.subject ?? "");
  return {
    id: row.id,
    courseId,
    lessonId,
    level: level || undefined,
    subject: subject || undefined,
    countryCode: row.country_code ?? null,
    gradeLevelId: row.grade_level_id ?? null,
    subjectId: row.subject_id ?? null,
    scope: courseId && lessonId ? "lesson" : "standalone",
    title: row.title,
    description: row.description ?? undefined,
    questions: normalizeQuestions(row.questions),
    published: !!row.published,
    status: parseContentStatus(row.status),
    reviewNote: row.review_note ?? null,
    ownerId: row.owner_id,
    courseTitle: row.course_title ?? undefined,
    lessonTitle: row.chapter_title ?? undefined,
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
    quizId: row.quiz_id ?? "",
    userId: row.user_id ?? "",
    answers: normalizeAttemptAnswers(row.answers),
    score: Number(row.score || 0),
    maxScore: Number(row.max_score || 0),
    attemptNo: Number(row.attempt_no || 1),
    durationMs: row.duration_ms ?? null,
    detail: mapCorrection(row.detail),
    createdAtMs: row.created_at_ms ?? 0,
  };
}

export async function getQuizByLesson(courseId: string, lessonId: string): Promise<Quiz | null> {
  if (!SUPABASE_READY || !courseId || !lessonId) return null;
  const { data, error } = await supabase
    .from("quizzes_readable")
    .select("*")
    .eq("course_id", courseId)
    .eq("chapter_id", lessonId)
    .maybeSingle();
  if (error || !data) return null;
  return mapQuiz(data);
}

export async function getQuizById(quizId: string): Promise<Quiz | null> {
  if (!SUPABASE_READY || !quizId) return null;
  const { data, error } = await supabase
    .from("quizzes_readable")
    .select("*")
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
    .from("quizzes_readable")
    .select("*")
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
  countryCode?: string | null;
  gradeLevelId?: string | null;
  subjectId?: string | null;
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
    country_code: input.countryCode ?? null,
    grade_level_id: input.gradeLevelId ?? null,
    subject_id: input.subjectId ?? null,
    title: input.title,
    description: input.description ?? null,
    questions: cleanedQuestions,
    owner_id: input.ownerId,
  };
  if (isStandaloneTarget) {
    payload.level = level || null;
    payload.subject = subject || null;
  }
  // La colonne `questions` n'est plus selectionnable : on ecrit sans RETURNING
  // dessus, puis on relit la ligne par la vue.
  const RETURNING = "id";
  let data: any = null;
  let error: any = null;
  if (input.id) {
    ({ data, error } = await supabase
      .from("quizzes")
      .upsert(payload, { onConflict: "id" })
      .select(RETURNING)
      .single());
  } else if (input.courseId && input.lessonId) {
    ({ data, error } = await supabase
      .from("quizzes")
      .upsert(payload, { onConflict: "course_id,chapter_id" })
      .select(RETURNING)
      .single());
  } else {
    ({ data, error } = await supabase
      .from("quizzes")
      .insert(payload)
      .select(RETURNING)
      .single());
  }
  if (error || !data?.id) throw error || new Error("Quiz non enregistre.");

  const saved = await getQuizById(String(data.id));
  if (!saved) throw new Error("Quiz enregistre mais illisible.");
  return saved;
}

/** Historique des tentatives de l'eleve, de la plus recente a la plus ancienne. */
export async function listMyQuizAttempts(quizId: string): Promise<QuizAttempt[]> {
  if (!SUPABASE_READY || !quizId) return [];
  const { data, error } = await supabase.rpc("my_quiz_attempts", { p_quiz_id: quizId });
  if (error || !Array.isArray(data)) return [];
  return (data as any[]).map((row) => mapAttempt({ ...row, quiz_id: quizId }));
}

/** Derniere tentative de l'eleve, ou null s'il n'a jamais passe ce quiz. */
export async function getQuizAttempt(quizId: string): Promise<QuizAttempt | null> {
  const rows = await listMyQuizAttempts(quizId);
  return rows[0] ?? null;
}

/**
 * Soumet les reponses et recupere la correction.
 *
 * La note est calculee par le serveur : le client ne connait pas le corrige
 * avant d'avoir repondu, et ne peut plus ecrire de score arbitraire.
 */
export type QuizAttemptSession = {
  attemptId: string;
  attemptNo: number;
  questionCount: number;
};

/**
 * Ouvre une tentative cote serveur.
 *
 * Une tentative laissee ouverte est reprise plutot que dupliquee : fermer
 * l'application au milieu d'un quiz ne cree pas une tentative fantome.
 */
export async function startQuizAttempt(quizId: string): Promise<QuizAttemptSession> {
  if (!SUPABASE_READY) throw new Error("Supabase non configure.");
  const { data, error } = await supabase.rpc("start_quiz_attempt", { p_quiz_id: quizId });
  if (error) throw new Error(mapAttemptError(error));
  const row = (data || {}) as any;
  if (!row.attemptId) throw new Error("Tentative non ouverte.");
  return {
    attemptId: String(row.attemptId),
    attemptNo: Number(row.attemptNo || 1),
    questionCount: Number(row.questionCount || 0),
  };
}

/**
 * Envoie une reponse et recupere sa correction.
 *
 * Le serveur fige la reponse au premier envoi : rappeler cette fonction pour la
 * meme question renvoie le meme resultat sans rien modifier. Sans cela, quatre
 * appels suffiraient a trouver la bonne reponse avant de repondre.
 */
export async function answerQuizQuestion(input: {
  attemptId: string;
  questionIndex: number;
  chosenIndex: number | null;
}): Promise<QuizCorrectionEntry> {
  if (!SUPABASE_READY) throw new Error("Supabase non configure.");
  const { data, error } = await supabase.rpc("answer_quiz_question", {
    p_attempt_id: input.attemptId,
    p_question_index: input.questionIndex,
    p_chosen_index: input.chosenIndex,
  });
  if (error) throw new Error(mapAttemptError(error));
  const entry = mapCorrection([data])[0];
  if (!entry) throw new Error("Correction indisponible.");
  return entry;
}

/** Cloture la tentative et renvoie le resultat calcule par le serveur. */
export async function finishQuizAttempt(attemptId: string): Promise<QuizSubmission> {
  if (!SUPABASE_READY) throw new Error("Supabase non configure.");
  const { data, error } = await supabase.rpc("finish_quiz_attempt", {
    p_attempt_id: attemptId,
  });
  if (error) throw new Error(mapAttemptError(error));
  const row = (data || {}) as any;
  return {
    quizId: String(row.quizId ?? ""),
    score: Number(row.score || 0),
    maxScore: Number(row.maxScore || 0),
    attemptNo: Number(row.attemptNo || 1),
    detail: mapCorrection(row.detail),
  };
}

function mapAttemptError(error: any): string {
  const message = String(error?.message || "");
  if (message.includes("quiz_not_found")) return "Ce quiz n'existe plus.";
  if (message.includes("quiz_not_published")) return "Ce quiz n'est pas encore publie.";
  if (message.includes("attempt_not_found")) return "Tentative introuvable.";
  if (message.includes("attempt_closed")) return "Cette tentative est deja terminee.";
  if (message.includes("question_out_of_range")) return "Question inconnue pour ce quiz.";
  if (message.includes("auth_required")) return "Connectez-vous pour repondre.";
  return message || "Resultat non enregistre.";
}
