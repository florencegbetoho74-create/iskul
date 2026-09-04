import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Link } from "react-router-dom";

import { supabase } from "../lib/supabase";
import {
  DEFAULT_CONTENT_COUNTRY,
  LOCAL_LANGUAGES,
  checkVideoUrl,
  cleanVideoByLang,
  isDirectMediaUrl,
  listGradeLevels,
  listSubjects,
  readVideoByLang,
  type GradeLevel,
  type Subject,
  type VideoByLang,
} from "../lib/referentials";

type TabKey = "overview" | "courses" | "books" | "lives" | "quizzes";
type QuizScope = "standalone" | "lesson";

type ProfileRow = {
  id: string;
  name: string | null;
  role: string | null;
  school: string | null;
  email: string | null;
  is_admin: boolean | null;
};

type CourseRow = {
  id: string;
  title: string;
  description: string | null;
  level: string;
  subject: string;
  grade_level_id: string | null;
  subject_id: string | null;
  cover_url: string | null;
  published: boolean;
  owner_id: string;
  owner_name: string | null;
  updated_at_ms: number | null;
};

type ChapterRow = {
  id: string;
  course_id: string;
  title: string;
  order_index: number;
  video_url: string | null;
  video_by_lang: Record<string, string> | null;
  updated_at_ms: number | null;
};

type BookRow = {
  id: string;
  title: string;
  level: string | null;
  subject: string | null;
  price: number | null;
  cover_url: string | null;
  file_url: string;
  published: boolean;
  updated_at_ms: number | null;
};

type LiveStatus = "scheduled" | "live" | "ended";

type LiveRow = {
  id: string;
  title: string;
  description: string | null;
  status: LiveStatus;
  start_at_ms: number;
  streaming_url: string | null;
  updated_at_ms: number | null;
};

type QuizRawQuestion = {
  id?: string;
  prompt?: string;
  options?: unknown;
  correctIndices?: unknown;
  correctIndex?: unknown;
};

type QuizRow = {
  id: string;
  title: string;
  description: string | null;
  level: string | null;
  subject: string | null;
  course_id: string | null;
  chapter_id: string | null;
  published: boolean;
  questions: unknown;
  updated_at_ms: number | null;
};

type QuizMetrics = {
  attempts: number;
  avgScorePct: number;
  bestScorePct: number;
};

type OverviewMetrics = {
  learners: number;
  completionRatePct: number;
  quizAttempts: number;
  quizAvgScorePct: number;
  atRiskLearners: number;
};

type DailyInsight = {
  day: string;
  completionRatePct: number;
  quizAttempts: number;
  quizAvgScorePct: number;
  activeLearners: number;
};

type CourseInsight = {
  courseId: string;
  title: string;
  learners: number;
  completionRatePct: number;
  quizAttempts: number;
  quizAvgScorePct: number;
};

type ChapterInsight = {
  chapterId: string;
  courseId: string;
  title: string;
  courseTitle: string;
  learners: number;
  completionRatePct: number;
  quizAttempts: number;
  quizAvgScorePct: number;
};

type WeakQuestionInsight = {
  key: string;
  quizId: string;
  quizTitle: string;
  courseTitle: string;
  chapterTitle: string;
  prompt: string;
  attempts: number;
  accuracyPct: number;
};

type PeriodDays = 7 | 30 | 90;

type CourseForm = {
  id: string | null;
  title: string;
  /** Libelles derives du referentiel, conserves pour les colonnes non nulles. */
  level: string;
  subject: string;
  gradeLevelId: string;
  subjectId: string;
  description: string;
  coverUrl: string;
  published: boolean;
};

type ChapterForm = {
  id: string | null;
  title: string;
  order: string;
  videoUrl: string;
  videoByLang: VideoByLang;
};

type BookForm = {
  id: string | null;
  title: string;
  level: string;
  subject: string;
  price: string;
  coverUrl: string;
  fileUrl: string;
  published: boolean;
};

type LiveForm = {
  id: string | null;
  title: string;
  description: string;
  startAt: string;
  streamingUrl: string;
  status: LiveStatus;
};

type QuizEditorQuestion = {
  localId: string;
  prompt: string;
  options: string[];
  correctIndex: number;
};

type QuizForm = {
  id: string | null;
  scope: QuizScope;
  courseId: string;
  chapterId: string;
  title: string;
  description: string;
  level: string;
  subject: string;
  published: boolean;
  questions: QuizEditorQuestion[];
};

type Notice = {
  kind: "success" | "error";
  text: string;
} | null;

const TAB_LABELS: Record<TabKey, string> = {
  overview: "Vue d'ensemble",
  courses: "Cours",
  books: "Bibliotheque",
  lives: "Lives",
  quizzes: "Quiz",
};

const EMPTY_OVERVIEW: OverviewMetrics = {
  learners: 0,
  completionRatePct: 0,
  quizAttempts: 0,
  quizAvgScorePct: 0,
  atRiskLearners: 0,
};

const EMPTY_COURSE_FORM: CourseForm = {
  gradeLevelId: "",
  subjectId: "",
  id: null,
  title: "",
  level: "",
  subject: "",
  description: "",
  coverUrl: "",
  published: false,
};

const EMPTY_CHAPTER_FORM: ChapterForm = {
  videoByLang: {},
  id: null,
  title: "",
  order: "",
  videoUrl: "",
};

const EMPTY_BOOK_FORM: BookForm = {
  id: null,
  title: "",
  level: "",
  subject: "",
  price: "0",
  coverUrl: "",
  fileUrl: "",
  published: false,
};

const EMPTY_LIVE_FORM: LiveForm = {
  id: null,
  title: "",
  description: "",
  startAt: "",
  streamingUrl: "",
  status: "scheduled",
};

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function safeNumber(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function createLocalId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeEmptyQuestion(): QuizEditorQuestion {
  return {
    localId: createLocalId("q"),
    prompt: "",
    options: ["", ""],
    correctIndex: 0,
  };
}

function makeEmptyQuizForm(): QuizForm {
  return {
    id: null,
    scope: "standalone",
    courseId: "",
    chapterId: "",
    title: "",
    description: "",
    level: "",
    subject: "",
    published: false,
    questions: [makeEmptyQuestion()],
  };
}

function toErrorMessage(error: unknown): string {
  const anyError = error as { message?: string; code?: string };
  const code = String(anyError?.code || "");
  const message = String(anyError?.message || "");
  const lower = message.toLowerCase();

  if (code === "PGRST202") return "Backend indisponible. Verifiez les migrations Supabase.";
  if (code === "23505") return "Un quiz existe deja pour cette lecon.";
  if (lower.includes("invalid login credentials")) return "Identifiants invalides.";
  if (lower.includes("row-level security")) return "Action refusee par la politique de securite.";
  if (lower.includes("networkerror") || lower.includes("failed to fetch")) {
    return "Connexion reseau impossible. Verifiez votre connexion puis reessayez.";
  }
  return message || "Une erreur est survenue.";
}

function toDateLabel(ms?: number | null) {
  if (!ms || !Number.isFinite(ms)) return "-";
  return new Date(ms).toLocaleString();
}

function toDatetimeLocalInput(ms?: number | null) {
  if (!ms || !Number.isFinite(ms)) return "";
  const offsetMs = new Date(ms).getTimezoneOffset() * 60000;
  return new Date(ms - offsetMs).toISOString().slice(0, 16);
}

function parseDatetimeLocalInput(value: string) {
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : Number.NaN;
}

function normalizeQuizQuestions(raw: unknown): QuizEditorQuestion[] {
  if (!Array.isArray(raw)) return [makeEmptyQuestion()];

  const result = raw
    .map((item) => {
      const q = (item || {}) as QuizRawQuestion;
      const prompt = String(q.prompt || "").trim();
      const baseOptions = Array.isArray(q.options)
        ? q.options.map((opt) => String(opt || ""))
        : [];
      const options = baseOptions.length >= 2 ? baseOptions : [...baseOptions, "", ""].slice(0, 2);

      const correctFromArray = Array.isArray(q.correctIndices)
        ? q.correctIndices
            .map((idx) => Number(idx))
            .filter((idx) => Number.isFinite(idx))
            .map((idx) => Math.floor(idx))
            .filter((idx) => idx >= 0 && idx < options.length)
        : [];

      const singleRaw = Number(q.correctIndex);
      const correctFromSingle =
        Number.isFinite(singleRaw) && singleRaw >= 0 && singleRaw < options.length
          ? Math.floor(singleRaw)
          : null;

      const correctIndex = correctFromArray[0] ?? correctFromSingle ?? 0;

      return {
        localId: q.id ? String(q.id) : createLocalId("q"),
        prompt,
        options,
        correctIndex,
      } as QuizEditorQuestion;
    })
    .filter((question) => question.prompt || question.options.some((option) => option.trim().length > 0));

  return result.length ? result : [makeEmptyQuestion()];
}

function prepareQuizQuestions(
  questions: QuizEditorQuestion[]
): { ok: true; value: Array<{ id: string; prompt: string; options: string[]; correctIndices: number[] }> } | { ok: false; error: string } {
  const prepared: Array<{ id: string; prompt: string; options: string[]; correctIndices: number[] }> = [];

  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index];
    const prompt = question.prompt.trim();

    if (!prompt) {
      return { ok: false, error: `La question ${index + 1} n'a pas d'intitule.` };
    }

    const optionMap = new Map<number, number>();
    const cleanedOptions: string[] = [];

    question.options.forEach((option, optionIndex) => {
      const trimmed = option.trim();
      if (!trimmed) return;
      optionMap.set(optionIndex, cleanedOptions.length);
      cleanedOptions.push(trimmed);
    });

    if (cleanedOptions.length < 2) {
      return { ok: false, error: `La question ${index + 1} doit avoir au moins 2 options.` };
    }

    const mappedCorrect = optionMap.get(question.correctIndex);
    if (mappedCorrect === undefined) {
      return { ok: false, error: `La reponse correcte de la question ${index + 1} est invalide.` };
    }

    prepared.push({
      id: question.localId || createLocalId("q"),
      prompt,
      options: cleanedOptions,
      correctIndices: [mappedCorrect],
    });
  }

  return { ok: true, value: prepared };
}

function dayLabel(dayKey: string) {
  const parsed = new Date(`${dayKey}T00:00:00`);
  return parsed.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function polylinePoints(values: number[], maxValue: number, width: number, height: number) {
  if (!values.length || maxValue <= 0) return "";
  if (values.length === 1) return `0,${height / 2}`;
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - (Math.max(0, value) / maxValue) * height;
      return `${x},${y}`;
    })
    .join(" ");
}

function LineChart({
  values,
  maxValue,
  colorClass,
}: {
  values: number[];
  maxValue: number;
  colorClass: string;
}) {
  const width = 280;
  const height = 84;
  const points = polylinePoints(values, maxValue, width, height);
  return (
    <svg className={`teacher-line-chart ${colorClass}`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <line x1="0" y1={height} x2={width} y2={height} />
      {points ? <polyline points={points} /> : null}
    </svg>
  );
}

function BarChart({
  values,
  maxValue,
}: {
  values: number[];
  maxValue: number;
}) {
  return (
    <div className="teacher-bar-chart">
      {values.map((value, index) => {
        const heightPct = maxValue > 0 ? (Math.max(0, value) / maxValue) * 100 : 0;
        return (
          <span key={`${index}-${value}`} className="teacher-bar-chart-col">
            <i style={{ height: `${heightPct}%` }} />
          </span>
        );
      })}
    </div>
  );
}

export default function TeacherWorkspacePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [notice, setNotice] = useState<Notice>(null);
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [tab, setTab] = useState<TabKey>("overview");

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [isTeacher, setIsTeacher] = useState(false);

  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [allChapters, setAllChapters] = useState<ChapterRow[]>([]);
  const [books, setBooks] = useState<BookRow[]>([]);
  const [lives, setLives] = useState<LiveRow[]>([]);
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [overview, setOverview] = useState<OverviewMetrics>(EMPTY_OVERVIEW);
  const [quizMetrics, setQuizMetrics] = useState<Record<string, QuizMetrics>>({});
  const [courseInsights, setCourseInsights] = useState<CourseInsight[]>([]);
  const [chapterInsights, setChapterInsights] = useState<ChapterInsight[]>([]);
  const [weakQuestions, setWeakQuestions] = useState<WeakQuestionInsight[]>([]);
  const [dailyInsights, setDailyInsights] = useState<DailyInsight[]>([]);
  const [analyticsDays, setAnalyticsDays] = useState<PeriodDays>(30);

  const [courseSearch, setCourseSearch] = useState("");
  const [bookSearch, setBookSearch] = useState("");
  const [liveSearch, setLiveSearch] = useState("");
  const [quizSearch, setQuizSearch] = useState("");

  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [courseForm, setCourseForm] = useState<CourseForm>(EMPTY_COURSE_FORM);
  const [chapterForm, setChapterForm] = useState<ChapterForm>(EMPTY_CHAPTER_FORM);
  const [bookForm, setBookForm] = useState<BookForm>(EMPTY_BOOK_FORM);
  const [liveForm, setLiveForm] = useState<LiveForm>(EMPTY_LIVE_FORM);
  const [quizForm, setQuizForm] = useState<QuizForm>(() => makeEmptyQuizForm());

  const userId = session?.user?.id || "";
  const busy = loadingWorkspace || actionBusy;

  const courseMap = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses]);
  const chapterMap = useMemo(() => new Map(allChapters.map((chapter) => [chapter.id, chapter])), [allChapters]);

  const chapterRows = useMemo(
    () => allChapters.filter((chapter) => chapter.course_id === selectedCourseId),
    [allChapters, selectedCourseId]
  );

  const quizCourseChapters = useMemo(
    () => allChapters.filter((chapter) => chapter.course_id === quizForm.courseId),
    [allChapters, quizForm.courseId]
  );

  const filteredCourses = useMemo(() => {
    const search = courseSearch.trim().toLowerCase();
    if (!search) return courses;
    return courses.filter((course) =>
      `${course.title} ${course.level} ${course.subject} ${course.description || ""}`.toLowerCase().includes(search)
    );
  }, [courses, courseSearch]);

  const filteredBooks = useMemo(() => {
    const search = bookSearch.trim().toLowerCase();
    if (!search) return books;
    return books.filter((book) =>
      `${book.title} ${book.level || ""} ${book.subject || ""}`.toLowerCase().includes(search)
    );
  }, [books, bookSearch]);

  const filteredLives = useMemo(() => {
    const search = liveSearch.trim().toLowerCase();
    if (!search) return lives;
    return lives.filter((live) =>
      `${live.title} ${live.status} ${live.description || ""}`.toLowerCase().includes(search)
    );
  }, [lives, liveSearch]);

  const filteredQuizzes = useMemo(() => {
    const search = quizSearch.trim().toLowerCase();
    if (!search) return quizzes;
    return quizzes.filter((quiz) =>
      `${quiz.title} ${quiz.level || ""} ${quiz.subject || ""} ${quiz.description || ""}`
        .toLowerCase()
        .includes(search)
    );
  }, [quizzes, quizSearch]);

  const publishedCourses = useMemo(() => courses.filter((course) => course.published).length, [courses]);
  const publishedBooks = useMemo(() => books.filter((book) => book.published).length, [books]);
  const publishedQuizzes = useMemo(() => quizzes.filter((quiz) => quiz.published).length, [quizzes]);
  const activeLives = useMemo(
    () => lives.filter((live) => live.status === "scheduled" || live.status === "live").length,
    [lives]
  );

  const completionSeries = useMemo(
    () => dailyInsights.map((item) => item.completionRatePct),
    [dailyInsights]
  );
  const quizScoreSeries = useMemo(
    () => dailyInsights.map((item) => item.quizAvgScorePct),
    [dailyInsights]
  );
  const quizAttemptsSeries = useMemo(
    () => dailyInsights.map((item) => item.quizAttempts),
    [dailyInsights]
  );
  const chartMaxPct = useMemo(
    () => Math.max(100, ...completionSeries, ...quizScoreSeries),
    [completionSeries, quizScoreSeries]
  );
  const chartMaxAttempts = useMemo(() => Math.max(1, ...quizAttemptsSeries), [quizAttemptsSeries]);

  const loadTeacherAnalytics = useCallback(
    async (chapterRows: ChapterRow[], periodDays: PeriodDays) => {
      // Les agregats ne peuvent pas etre calcules ici : les politiques RLS de
      // lesson_progress et quiz_attempts ne rendent que les lignes de
      // l'appelant. La fonction teacher_dashboard verifie la propriete des
      // contenus puis agrege cote serveur.
      const { data, error } = await supabase.rpc("teacher_dashboard", {
        p_days: periodDays,
      });
      if (error) throw error;

      const root = (data || {}) as Record<string, unknown>;
      const totals = (root.totals || {}) as Record<string, unknown>;
      const rows = (key: string): Record<string, unknown>[] =>
        Array.isArray(root[key]) ? (root[key] as Record<string, unknown>[]) : [];

      const courseTitleById = new Map<string, string>();
      const nextCourseInsights: CourseInsight[] = rows("courses").map((row) => {
        const courseId = String(row.courseId ?? "");
        const title = String(row.title ?? "Cours");
        courseTitleById.set(courseId, title);
        return {
          courseId,
          title,
          learners: safeNumber(row.learners),
          completionRatePct: clamp01(safeNumber(row.completionRate)) * 100,
          quizAttempts: 0,
          quizAvgScorePct: 0,
        };
      });

      const chapterCourseById = new Map(
        chapterRows.map((chapter) => [chapter.id, chapter.course_id])
      );

      const nextChapterInsights: ChapterInsight[] = rows("chapters").map((row) => {
        const chapterId = String(row.chapterId ?? "");
        const courseId = String(row.courseId ?? chapterCourseById.get(chapterId) ?? "");
        return {
          chapterId,
          courseId,
          title: String(row.title ?? "Chapitre"),
          courseTitle: courseTitleById.get(courseId) || "Cours",
          learners: safeNumber(row.learners),
          completionRatePct: clamp01(safeNumber(row.completionRate)) * 100,
          quizAttempts: 0,
          quizAvgScorePct: 0,
        };
      });

      const metricsByQuiz: Record<string, QuizMetrics> = {};
      rows("quizzes").forEach((row) => {
        const quizId = String(row.quizId ?? "");
        if (!quizId) return;
        const avg = safeNumber(row.avgScorePct);
        metricsByQuiz[quizId] = {
          attempts: safeNumber(row.attempts),
          avgScorePct: avg,
          bestScorePct: avg,
        };
      });

      const nextWeakQuestions: WeakQuestionInsight[] = rows("weakQuestions").map((row) => {
        const quizId = String(row.quizId ?? "");
        return {
          key: `${quizId}:${safeNumber(row.questionIndex)}`,
          quizId,
          quizTitle: String(row.quizTitle ?? "Quiz"),
          courseTitle: "",
          chapterTitle: "",
          prompt: String(row.prompt ?? "Question"),
          attempts: safeNumber(row.answers),
          accuracyPct: clamp01(safeNumber(row.successRate)) * 100,
        };
      });

      const nextDailyInsights: DailyInsight[] = rows("daily").map((row) => ({
        day: String(row.day ?? ""),
        completionRatePct: 0,
        quizAttempts: safeNumber(row.attempts),
        quizAvgScorePct: safeNumber(row.avgScorePct),
        activeLearners: safeNumber(row.learners),
      }));

      setQuizMetrics(metricsByQuiz);
      setCourseInsights(nextCourseInsights);
      setChapterInsights(nextChapterInsights);
      setWeakQuestions(nextWeakQuestions);
      setDailyInsights(nextDailyInsights);
      setOverview({
        learners: safeNumber(totals.learners),
        completionRatePct: clamp01(safeNumber(totals.completionRate)) * 100,
        quizAttempts: safeNumber(totals.quizAttempts),
        quizAvgScorePct: nextDailyInsights.length
          ? nextDailyInsights.reduce((acc, d) => acc + d.quizAvgScorePct, 0) /
            Math.max(nextDailyInsights.filter((d) => d.quizAttempts > 0).length, 1)
          : 0,
        atRiskLearners: safeNumber(totals.atRiskCount),
      });
    },
    []
  );

  const loadWorkspace = useCallback(async () => {
    if (!userId) return;

    setLoadingWorkspace(true);
    try {
      const [profileRes, coursesRes, booksRes, livesRes, quizzesRes] = await Promise.all([
        supabase.from("profiles").select("id,name,role,school,email,is_admin").eq("id", userId).maybeSingle(),
        supabase
          .from("courses")
          .select("id,title,description,level,subject,grade_level_id,subject_id,cover_url,published,owner_id,owner_name,updated_at_ms")
          .eq("owner_id", userId)
          .order("updated_at_ms", { ascending: false }),
        supabase
          .from("books")
          .select("id,title,level,subject,price,cover_url,file_url,published,updated_at_ms")
          .eq("owner_id", userId)
          .order("updated_at_ms", { ascending: false }),
        supabase
          .from("lives")
          .select("id,title,description,status,start_at_ms,streaming_url,updated_at_ms")
          .eq("owner_id", userId)
          .order("start_at_ms", { ascending: false }),
        supabase
          .from("quizzes_readable")
          .select("id,title,description,level,subject,course_id,chapter_id,published,questions,updated_at_ms")
          .eq("owner_id", userId)
          .order("updated_at_ms", { ascending: false }),
      ]);

      if (profileRes.error) throw profileRes.error;
      if (coursesRes.error) throw coursesRes.error;
      if (booksRes.error) throw booksRes.error;
      if (livesRes.error) throw livesRes.error;
      if (quizzesRes.error) throw quizzesRes.error;

      const nextProfile = (profileRes.data || null) as ProfileRow | null;
      setProfile(nextProfile);

      const role = String(nextProfile?.role || "").toLowerCase();
      const localTeacher = role === "teacher" || role === "admin" || nextProfile?.is_admin === true;
      let teacherAccess = localTeacher;

      if (!teacherAccess) {
        const teacherGateRes = await supabase.rpc("is_teacher", { p_user_id: userId });
        if (!teacherGateRes.error) {
          teacherAccess = Boolean(teacherGateRes.data);
        }
      }
      setIsTeacher(teacherAccess);

      if (!teacherAccess) {
        setCourses([]);
        setAllChapters([]);
        setBooks([]);
        setLives([]);
        setQuizzes([]);
        setOverview(EMPTY_OVERVIEW);
        setQuizMetrics({});
        setCourseInsights([]);
        setChapterInsights([]);
        setWeakQuestions([]);
        setDailyInsights([]);
        return;
      }

      const nextCourses = (coursesRes.data || []) as CourseRow[];
      const nextBooks = (booksRes.data || []) as BookRow[];
      const nextLives = (livesRes.data || []) as LiveRow[];
      const nextQuizzes = (quizzesRes.data || []) as QuizRow[];

      setCourses(nextCourses);
      setBooks(nextBooks);
      setLives(nextLives);
      setQuizzes(nextQuizzes);

      const nextCourseIds = nextCourses.map((course) => course.id);
      let nextChapters: ChapterRow[] = [];
      if (nextCourseIds.length) {
        const chaptersRes = await supabase
          .from("chapters")
          .select("id,course_id,title,order_index,video_url,video_by_lang,updated_at_ms")
          .in("course_id", nextCourseIds)
          .order("order_index", { ascending: true });
        if (chaptersRes.error) throw chaptersRes.error;
        nextChapters = (chaptersRes.data || []) as ChapterRow[];
        setAllChapters(nextChapters);
      } else {
        setAllChapters([]);
      }

      const preferredCourse =
        selectedCourseId && nextCourses.some((course) => course.id === selectedCourseId)
          ? selectedCourseId
          : nextCourses[0]?.id || "";
      setSelectedCourseId(preferredCourse);

      await loadTeacherAnalytics(nextChapters, analyticsDays);
    } catch (error) {
      setNotice({ kind: "error", text: toErrorMessage(error) });
    } finally {
      setLoadingWorkspace(false);
    }
  }, [analyticsDays, loadTeacherAnalytics, selectedCourseId, userId]);

  // Le referentiel est charge une fois : il change au rythme des reformes
  // scolaires, pas des visites. Son echec n'empeche pas le reste de l'espace
  // de fonctionner, mais l'enregistrement d'un cours restera refuse.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [levels, matters] = await Promise.all([listGradeLevels(), listSubjects()]);
        if (!active) return;
        setGradeLevels(levels);
        setSubjects(matters);
      } catch {
        if (active) {
          setNotice({
            kind: "error",
            text: "Le programme scolaire n'a pas pu etre charge. Rechargez la page avant de creer un cours.",
          });
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let alive = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!alive) return;
        setSession(data.session || null);
      })
      .finally(() => {
        if (!alive) return;
        setBooting(false);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    void loadWorkspace();
  }, [loadWorkspace, session?.user?.id]);

  useEffect(() => {
    if (!selectedCourseId && courses.length > 0) {
      setSelectedCourseId(courses[0].id);
      return;
    }
    if (selectedCourseId && !courses.some((course) => course.id === selectedCourseId)) {
      setSelectedCourseId(courses[0]?.id || "");
    }
  }, [courses, selectedCourseId]);

  useEffect(() => {
    if (quizForm.scope !== "lesson") return;
    if (!courses.length) return;

    const hasCourse = courses.some((course) => course.id === quizForm.courseId);
    if (!hasCourse) {
      const fallbackCourseId = courses[0]?.id || "";
      const fallbackChapterId =
        allChapters.find((chapter) => chapter.course_id === fallbackCourseId)?.id || "";
      setQuizForm((previous) => ({
        ...previous,
        courseId: fallbackCourseId,
        chapterId: fallbackChapterId,
      }));
      return;
    }

    const hasChapter = allChapters.some(
      (chapter) => chapter.course_id === quizForm.courseId && chapter.id === quizForm.chapterId
    );
    if (!hasChapter) {
      const fallbackChapterId =
        allChapters.find((chapter) => chapter.course_id === quizForm.courseId)?.id || "";
      setQuizForm((previous) => ({ ...previous, chapterId: fallbackChapterId }));
    }
  }, [allChapters, courses, quizForm.chapterId, quizForm.courseId, quizForm.scope]);

  const runAction = useCallback(
    async (fn: () => Promise<void>, successMessage: string, reload = true) => {
      setActionBusy(true);
      setNotice(null);
      try {
        await fn();
        if (reload) {
          await loadWorkspace();
        }
        setNotice({ kind: "success", text: successMessage });
      } catch (error) {
        setNotice({ kind: "error", text: toErrorMessage(error) });
      } finally {
        setActionBusy(false);
      }
    },
    [loadWorkspace]
  );

  const handleSignOut = async () => {
    setActionBusy(true);
    setNotice(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      setNotice({ kind: "error", text: toErrorMessage(error) });
    } finally {
      setActionBusy(false);
    }
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      if (error) throw error;
      setLoginPassword("");
    } catch (error) {
      setAuthError(toErrorMessage(error));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleCourseSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!courseForm.title.trim()) {
      setNotice({ kind: "error", text: "Le titre du cours est obligatoire." });
      return;
    }
    // Sans classe ni matiere du referentiel, le cours n'apparaitrait dans la
    // portee d'aucun eleve : l'enregistrement est refuse plutot que de creer
    // un cours introuvable.
    if (!courseForm.gradeLevelId || !courseForm.subjectId) {
      setNotice({ kind: "error", text: "Choisissez la classe et la matiere." });
      return;
    }

    const grade = gradeLevels.find((item) => item.id === courseForm.gradeLevelId);
    const subject = subjects.find((item) => item.id === courseForm.subjectId);

    const payload = {
      title: courseForm.title.trim(),
      // level et subject sont derives du referentiel par un declencheur : on
      // les envoie quand meme pour satisfaire les colonnes non nulles.
      level: grade?.code || courseForm.level.trim(),
      subject: subject?.label || courseForm.subject.trim(),
      country_code: DEFAULT_CONTENT_COUNTRY,
      grade_level_id: courseForm.gradeLevelId,
      subject_id: courseForm.subjectId,
      description: courseForm.description.trim() || null,
      cover_url: courseForm.coverUrl.trim() || null,
      owner_id: userId,
      owner_name: profile?.name || session?.user?.email || null,
      updated_at_ms: Date.now(),
    };

    void runAction(
      async () => {
        if (courseForm.id) {
          const { error } = await supabase.from("courses").update(payload).eq("id", courseForm.id);
          if (error) throw error;
          return;
        }
        const { error } = await supabase.from("courses").insert({
          ...payload,
          created_at_ms: Date.now(),
        });
        if (error) throw error;
        setCourseForm(EMPTY_COURSE_FORM);
      },
      courseForm.id ? "Cours mis a jour." : "Cours cree."
    );
  };

  const handleChapterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCourseId) {
      setNotice({ kind: "error", text: "Selectionnez un cours avant d'ajouter un chapitre." });
      return;
    }
    if (!chapterForm.title.trim()) {
      setNotice({ kind: "error", text: "Le titre du chapitre est obligatoire." });
      return;
    }

    const parsedOrder = Number(chapterForm.order);
    const nextOrder =
      Number.isFinite(parsedOrder) && parsedOrder > 0
        ? Math.floor(parsedOrder)
        : Math.max(0, ...chapterRows.map((chapter) => safeNumber(chapter.order_index))) + 1;

    const byLang = cleanVideoByLang(chapterForm.videoByLang);
    const allUrls = [chapterForm.videoUrl, ...Object.values(byLang || {})]
      .map((value) => (value || "").trim())
      .filter(Boolean);

    const refused = allUrls.map(checkVideoUrl).find((check) => !check.ok);
    if (refused) {
      setNotice({ kind: "error", text: refused.reason || "Lien video refuse." });
      return;
    }

    const payload = {
      course_id: selectedCourseId,
      title: chapterForm.title.trim(),
      order_index: nextOrder,
      video_url: chapterForm.videoUrl.trim() || null,
      video_by_lang: byLang,
      updated_at_ms: Date.now(),
    };

    void runAction(
      async () => {
        if (chapterForm.id) {
          const { error } = await supabase.from("chapters").update(payload).eq("id", chapterForm.id);
          if (error) throw error;
          return;
        }
        const { error } = await supabase.from("chapters").insert({
          ...payload,
          created_at_ms: Date.now(),
        });
        if (error) throw error;
        setChapterForm(EMPTY_CHAPTER_FORM);
      },
      chapterForm.id ? "Chapitre mis a jour." : "Chapitre ajoute."
    );
  };

  const handleBookSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!bookForm.title.trim() || !bookForm.fileUrl.trim()) {
      setNotice({ kind: "error", text: "Titre et URL du fichier sont obligatoires." });
      return;
    }

    const payload = {
      title: bookForm.title.trim(),
      level: bookForm.level.trim() || null,
      subject: bookForm.subject.trim() || null,
      price: Math.max(0, safeNumber(bookForm.price)),
      cover_url: bookForm.coverUrl.trim() || null,
      file_url: bookForm.fileUrl.trim(),
      owner_id: userId,
      owner_name: profile?.name || session?.user?.email || null,
      updated_at_ms: Date.now(),
    };

    void runAction(
      async () => {
        if (bookForm.id) {
          const { error } = await supabase.from("books").update(payload).eq("id", bookForm.id);
          if (error) throw error;
          return;
        }
        const { error } = await supabase.from("books").insert({
          ...payload,
          created_at_ms: Date.now(),
        });
        if (error) throw error;
        setBookForm(EMPTY_BOOK_FORM);
      },
      bookForm.id ? "Document mis a jour." : "Document ajoute."
    );
  };

  const handleLiveSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!liveForm.title.trim()) {
      setNotice({ kind: "error", text: "Le titre du live est obligatoire." });
      return;
    }

    const startAtMs = parseDatetimeLocalInput(liveForm.startAt);
    if (!Number.isFinite(startAtMs)) {
      setNotice({ kind: "error", text: "Date/heure invalide pour le live." });
      return;
    }

    const payload = {
      title: liveForm.title.trim(),
      description: liveForm.description.trim() || null,
      start_at_ms: Math.floor(startAtMs),
      streaming_url: liveForm.streamingUrl.trim() || null,
      status: liveForm.status,
      owner_id: userId,
      owner_name: profile?.name || session?.user?.email || null,
      updated_at_ms: Date.now(),
    };

    void runAction(
      async () => {
        if (liveForm.id) {
          const { error } = await supabase.from("lives").update(payload).eq("id", liveForm.id);
          if (error) throw error;
          return;
        }
        const { error } = await supabase.from("lives").insert({
          ...payload,
          created_at_ms: Date.now(),
        });
        if (error) throw error;
        setLiveForm(EMPTY_LIVE_FORM);
      },
      liveForm.id ? "Live mis a jour." : "Live planifie."
    );
  };

  const handleQuizScopeChange = (scope: QuizScope) => {
    if (scope === "standalone") {
      setQuizForm((previous) => ({
        ...previous,
        scope: "standalone",
        courseId: "",
        chapterId: "",
      }));
      return;
    }

    const defaultCourseId = quizForm.courseId || courses[0]?.id || "";
    const defaultChapterId = allChapters.find((chapter) => chapter.course_id === defaultCourseId)?.id || "";
    setQuizForm((previous) => ({
      ...previous,
      scope: "lesson",
      courseId: defaultCourseId,
      chapterId: defaultChapterId,
    }));
  };

  const handleQuizSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!quizForm.title.trim()) {
      setNotice({ kind: "error", text: "Le titre du quiz est obligatoire." });
      return;
    }

    if (quizForm.scope === "standalone") {
      if (!quizForm.level.trim() || !quizForm.subject.trim()) {
        setNotice({ kind: "error", text: "Niveau et matiere sont obligatoires pour un quiz standalone." });
        return;
      }
    } else {
      if (!quizForm.courseId || !quizForm.chapterId) {
        setNotice({ kind: "error", text: "Selectionnez un cours et un chapitre pour un quiz de lecon." });
        return;
      }
    }

    const preparedQuestions = prepareQuizQuestions(quizForm.questions);
    if (!preparedQuestions.ok) {
      setNotice({ kind: "error", text: preparedQuestions.error });
      return;
    }

    const payload = {
      title: quizForm.title.trim(),
      description: quizForm.description.trim() || null,
      course_id: quizForm.scope === "lesson" ? quizForm.courseId : null,
      chapter_id: quizForm.scope === "lesson" ? quizForm.chapterId : null,
      level: quizForm.scope === "standalone" ? quizForm.level.trim() : null,
      subject: quizForm.scope === "standalone" ? quizForm.subject.trim() : null,
      questions: preparedQuestions.value,
      owner_id: userId,
      updated_at_ms: Date.now(),
    };

    void runAction(
      async () => {
        if (quizForm.id) {
          const { error } = await supabase.from("quizzes").update(payload).eq("id", quizForm.id);
          if (error) throw error;
          return;
        }
        const { error } = await supabase.from("quizzes").insert({
          ...payload,
          created_at_ms: Date.now(),
        });
        if (error) throw error;
        setQuizForm(makeEmptyQuizForm());
      },
      quizForm.id ? "Quiz mis a jour." : "Quiz cree."
    );
  };

  const updateQuizQuestion = (localId: string, patch: Partial<QuizEditorQuestion>) => {
    setQuizForm((previous) => ({
      ...previous,
      questions: previous.questions.map((question) =>
        question.localId === localId ? { ...question, ...patch } : question
      ),
    }));
  };

  const removeQuizQuestion = (localId: string) => {
    setQuizForm((previous) => {
      if (previous.questions.length <= 1) return previous;
      return {
        ...previous,
        questions: previous.questions.filter((question) => question.localId !== localId),
      };
    });
  };

  const addQuizQuestion = () => {
    setQuizForm((previous) => ({
      ...previous,
      questions: [...previous.questions, makeEmptyQuestion()],
    }));
  };

  const addQuizOption = (localId: string) => {
    setQuizForm((previous) => ({
      ...previous,
      questions: previous.questions.map((question) => {
        if (question.localId !== localId) return question;
        return { ...question, options: [...question.options, ""] };
      }),
    }));
  };

  const removeQuizOption = (localId: string, optionIndex: number) => {
    setQuizForm((previous) => ({
      ...previous,
      questions: previous.questions.map((question) => {
        if (question.localId !== localId) return question;
        if (question.options.length <= 2) return question;
        const nextOptions = question.options.filter((_, idx) => idx !== optionIndex);
        const nextCorrect =
          question.correctIndex === optionIndex
            ? 0
            : question.correctIndex > optionIndex
            ? question.correctIndex - 1
            : question.correctIndex;
        return {
          ...question,
          options: nextOptions,
          correctIndex: Math.max(0, Math.min(nextCorrect, nextOptions.length - 1)),
        };
      }),
    }));
  };

  const editCourse = (course: CourseRow) => {
    setCourseForm({
      id: course.id,
      title: course.title,
      level: course.level,
      subject: course.subject,
      gradeLevelId: course.grade_level_id || "",
      subjectId: course.subject_id || "",
      description: course.description || "",
      coverUrl: course.cover_url || "",
      published: course.published,
    });
    setTab("courses");
  };

  const editChapter = (chapter: ChapterRow) => {
    setSelectedCourseId(chapter.course_id);
    setChapterForm({
      id: chapter.id,
      title: chapter.title,
      order: String(chapter.order_index),
      videoUrl: chapter.video_url || "",
      videoByLang: readVideoByLang(chapter.video_by_lang),
    });
    setTab("courses");
  };

  const editBook = (book: BookRow) => {
    setBookForm({
      id: book.id,
      title: book.title,
      level: book.level || "",
      subject: book.subject || "",
      price: String(book.price ?? 0),
      coverUrl: book.cover_url || "",
      fileUrl: book.file_url,
      published: book.published,
    });
    setTab("books");
  };

  const editLive = (live: LiveRow) => {
    setLiveForm({
      id: live.id,
      title: live.title,
      description: live.description || "",
      startAt: toDatetimeLocalInput(live.start_at_ms),
      streamingUrl: live.streaming_url || "",
      status: live.status,
    });
    setTab("lives");
  };

  const editQuiz = (quiz: QuizRow) => {
    const scope: QuizScope = quiz.course_id && quiz.chapter_id ? "lesson" : "standalone";
    setQuizForm({
      id: quiz.id,
      scope,
      courseId: quiz.course_id || "",
      chapterId: quiz.chapter_id || "",
      title: quiz.title,
      description: quiz.description || "",
      level: quiz.level || "",
      subject: quiz.subject || "",
      published: quiz.published,
      questions: normalizeQuizQuestions(quiz.questions),
    });
    setTab("quizzes");
  };

  const onDelete = (label: string, action: () => Promise<void>, successMessage: string) => {
    const confirmed = window.confirm(`Confirmer la suppression: ${label} ?`);
    if (!confirmed) return;
    void runAction(action, successMessage);
  };

  if (booting) {
    return (
      <div className="page-wrap container teacher-workspace">
        <div className="teacher-auth-card">Chargement...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="page-wrap container teacher-workspace">
        <header className="page-head">
          <span className="kicker">Espace Professeur</span>
          <h1>Connexion enseignant</h1>
          <p>Accedez a vos contenus, statistiques et outils de publication web.</p>
        </header>

        <form className="teacher-auth-card" onSubmit={handleLogin}>
          <label className="teacher-field">
            Email
            <input
              type="email"
              value={loginEmail}
              onChange={(event) => setLoginEmail(event.target.value)}
              autoComplete="email"
            />
          </label>
          <label className="teacher-field">
            Mot de passe
            <input
              type="password"
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          {authError ? <p className="notice error">{authError}</p> : null}
          <div className="teacher-inline-actions">
            <button className="btn primary" type="submit" disabled={authBusy}>
              {authBusy ? "Connexion..." : "Se connecter"}
            </button>
            <Link className="btn ghost" to="/inscription-professeur">
              Creer un compte professeur
            </Link>
          </div>
        </form>
      </div>
    );
  }

  if (!isTeacher && !loadingWorkspace) {
    return (
      <div className="page-wrap container teacher-workspace">
        <header className="page-head">
          <span className="kicker">Espace Professeur</span>
          <h1>Compte non enseignant</h1>
          <p>Ce compte n'a pas encore le role enseignant.</p>
        </header>

        <div className="teacher-auth-card">
          <p>
            Compte connecte: <strong>{session.user.email}</strong>
          </p>
          <div className="teacher-inline-actions">
            <Link className="btn ghost" to="/inscription-professeur">
              Demander l'activation
            </Link>
            <button className="btn secondary" onClick={() => void handleSignOut()} disabled={busy}>
              Se deconnecter
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrap container teacher-workspace">
      <header className="teacher-topbar">
        <div>
          <span className="kicker">Espace Professeur</span>
          <h1>Dashboard enseignant</h1>
          <p>
            Pilotage complet de vos cours, quiz, lives et contenus documentaires depuis le web.
          </p>
        </div>
        <div className="teacher-inline-actions">
          <button className="btn ghost" onClick={() => void loadWorkspace()} disabled={busy}>
            Actualiser
          </button>
          <button className="btn secondary" onClick={() => void handleSignOut()} disabled={busy}>
            Deconnexion
          </button>
        </div>
      </header>

      <section className="teacher-identity">
        <p>
          <strong>{profile?.name || session.user.email}</strong>
        </p>
        <p className="muted">{profile?.school || "Etablissement non renseigne"}</p>
      </section>

      {notice ? <p className={`notice ${notice.kind === "success" ? "success" : "error"}`}>{notice.text}</p> : null}

      <nav className="teacher-tab-row" aria-label="Sections espace professeur">
        {(Object.keys(TAB_LABELS) as TabKey[]).map((key) => (
          <button
            key={key}
            type="button"
            className={tab === key ? "teacher-tab active" : "teacher-tab"}
            onClick={() => setTab(key)}
          >
            {TAB_LABELS[key]}
          </button>
        ))}
      </nav>

      {tab === "overview" ? (
        <>
          <section className="teacher-panel">
            <div className="teacher-panel-head">
              <h2>Synthese sur {analyticsDays} jours</h2>
              <div className="teacher-period-switch" role="group" aria-label="Periode d'analyse">
                {([7, 30, 90] as PeriodDays[]).map((days) => (
                  <button
                    key={days}
                    type="button"
                    className={analyticsDays === days ? "teacher-period-btn active" : "teacher-period-btn"}
                    onClick={() => setAnalyticsDays(days)}
                    disabled={busy}
                  >
                    {days}j
                  </button>
                ))}
              </div>
            </div>
            <div className="teacher-kpi-grid">
              <article className="teacher-kpi-card">
                <span>Cours</span>
                <strong>{courses.length}</strong>
                <small>{publishedCourses} publies</small>
              </article>
              <article className="teacher-kpi-card">
                <span>Documents</span>
                <strong>{books.length}</strong>
                <small>{publishedBooks} publies</small>
              </article>
              <article className="teacher-kpi-card">
                <span>Lives</span>
                <strong>{lives.length}</strong>
                <small>{activeLives} actifs/programmes</small>
              </article>
              <article className="teacher-kpi-card">
                <span>Quiz</span>
                <strong>{quizzes.length}</strong>
                <small>{publishedQuizzes} publies</small>
              </article>
              <article className="teacher-kpi-card">
                <span>Eleves engages</span>
                <strong>{overview.learners}</strong>
                <small>Sur vos contenus</small>
              </article>
              <article className="teacher-kpi-card">
                <span>Completion moyenne</span>
                <strong>{overview.completionRatePct.toFixed(1)}%</strong>
                <small>{overview.atRiskLearners} eleves a risque</small>
              </article>
              <article className="teacher-kpi-card">
                <span>Tentatives quiz</span>
                <strong>{overview.quizAttempts}</strong>
                <small>Historique cumule</small>
              </article>
              <article className="teacher-kpi-card">
                <span>Score quiz moyen</span>
                <strong>{overview.quizAvgScorePct.toFixed(1)}%</strong>
                <small>Base sur max_score</small>
              </article>
            </div>
          </section>

          <section className="teacher-panel teacher-overview-grid">
            <article className="teacher-mini-card">
              <h3>Actions rapides</h3>
              <div className="teacher-inline-actions">
                <button className="btn ghost" type="button" onClick={() => setTab("courses")}>Ajouter un cours</button>
                <button className="btn ghost" type="button" onClick={() => setTab("quizzes")}>Creer un quiz</button>
                <button className="btn ghost" type="button" onClick={() => setTab("lives")}>Programmer un live</button>
              </div>
            </article>
            <article className="teacher-mini-card">
              <h3>Qualite de suivi</h3>
              <p>Cible recommandee: completion &gt; 65% et score quiz moyen &gt; 60%.</p>
            </article>
            <article className="teacher-mini-card">
              <h3>Prochaines etapes</h3>
              <p>Publiez vos contenus finalises puis suivez les performances pour renforcer les chapitres faibles.</p>
            </article>
          </section>

          <section className="teacher-charts-grid">
            <article className="teacher-panel teacher-chart-card">
              <div className="teacher-panel-head">
                <h3>Evolution quotidienne</h3>
                <small>Completion vs score quiz moyen</small>
              </div>
              {dailyInsights.length ? (
                <>
                  <div className="teacher-line-stack">
                    <LineChart values={completionSeries} maxValue={chartMaxPct} colorClass="completion" />
                    <LineChart values={quizScoreSeries} maxValue={chartMaxPct} colorClass="score" />
                  </div>
                  <div className="teacher-chart-legend">
                    <span className="completion">Completion</span>
                    <span className="score">Score quiz moyen</span>
                  </div>
                  <div className="teacher-chart-foot">
                    <span>{dayLabel(dailyInsights[0].day)}</span>
                    <span>{dayLabel(dailyInsights[dailyInsights.length - 1].day)}</span>
                  </div>
                </>
              ) : (
                <p className="teacher-empty">Pas encore de donnees quotidiennes.</p>
              )}
            </article>

            <article className="teacher-panel teacher-chart-card">
              <div className="teacher-panel-head">
                <h3>Tentatives quiz par jour</h3>
                <small>Activite sur la periode</small>
              </div>
              {dailyInsights.length ? (
                <>
                  <BarChart values={quizAttemptsSeries} maxValue={chartMaxAttempts} />
                  <div className="teacher-chart-foot">
                    <span>{dayLabel(dailyInsights[0].day)}</span>
                    <span>{dayLabel(dailyInsights[dailyInsights.length - 1].day)}</span>
                  </div>
                </>
              ) : (
                <p className="teacher-empty">Pas encore de donnees de tentatives.</p>
              )}
            </article>
          </section>

          <section className="teacher-analytics-grid">
            <article className="teacher-panel teacher-insight-card">
              <div className="teacher-panel-head">
                <h3>Performance par cours</h3>
                <small>{courseInsights.length} cours analyses</small>
              </div>
              {courseInsights.length ? (
                <div className="teacher-insight-list">
                  {courseInsights.slice(0, 8).map((insight) => (
                    <article key={insight.courseId} className="teacher-insight-row">
                      <div className="teacher-insight-head">
                        <strong>{insight.title}</strong>
                        <span>{insight.completionRatePct.toFixed(1)}% completion</span>
                      </div>
                      <div className="teacher-insight-meta">
                        <span>{insight.learners} eleves</span>
                        <span>{insight.quizAttempts} tentatives quiz</span>
                        <span>Score moyen {insight.quizAvgScorePct.toFixed(1)}%</span>
                      </div>
                      <div className="teacher-insight-bar">
                        <span style={{ width: `${Math.max(0, Math.min(insight.completionRatePct, 100))}%` }} />
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="teacher-empty">Pas encore assez de donnees pour cette section.</p>
              )}
            </article>

            <article className="teacher-panel teacher-insight-card">
              <div className="teacher-panel-head">
                <h3>Performance par chapitre</h3>
                <small>Top 10 chapitres</small>
              </div>
              {chapterInsights.length ? (
                <div className="teacher-insight-list">
                  {chapterInsights.map((insight) => (
                    <article key={insight.chapterId} className="teacher-insight-row">
                      <div className="teacher-insight-head">
                        <strong>{insight.title}</strong>
                        <span>{insight.completionRatePct.toFixed(1)}%</span>
                      </div>
                      <p className="teacher-insight-sub">{insight.courseTitle}</p>
                      <div className="teacher-insight-meta">
                        <span>{insight.learners} eleves</span>
                        <span>{insight.quizAttempts} tentatives</span>
                        <span>Score {insight.quizAvgScorePct.toFixed(1)}%</span>
                      </div>
                      <div className="teacher-insight-bar">
                        <span style={{ width: `${Math.max(0, Math.min(insight.completionRatePct, 100))}%` }} />
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="teacher-empty">Pas encore assez de donnees pour cette section.</p>
              )}
            </article>

            <article className="teacher-panel teacher-insight-card">
              <div className="teacher-panel-head">
                <h3>Questions a renforcer</h3>
                <small>Faible taux de reussite</small>
              </div>
              {weakQuestions.length ? (
                <div className="teacher-insight-list">
                  {weakQuestions.map((insight) => (
                    <article key={insight.key} className="teacher-insight-row">
                      <div className="teacher-insight-head">
                        <strong>{insight.quizTitle}</strong>
                        <span>{insight.accuracyPct.toFixed(1)}% justes</span>
                      </div>
                      <p className="teacher-insight-sub">
                        {insight.courseTitle} {insight.chapterTitle ? `- ${insight.chapterTitle}` : ""}
                      </p>
                      <p className="teacher-insight-question" title={insight.prompt}>
                        {insight.prompt}
                      </p>
                      <div className="teacher-insight-meta">
                        <span>{insight.attempts} tentatives</span>
                      </div>
                      <div className="teacher-insight-bar weak">
                        <span style={{ width: `${Math.max(0, Math.min(insight.accuracyPct, 100))}%` }} />
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="teacher-empty">Aucune question faible detectee pour le moment.</p>
              )}
            </article>
          </section>
        </>
      ) : null}

      {tab === "courses" ? (
        <>
          <section className="teacher-layout-grid">
            <article className="teacher-panel">
              <div className="teacher-panel-head">
                <h2>{courseForm.id ? "Modifier le cours" : "Nouveau cours"}</h2>
                {courseForm.id ? (
                  <button className="btn ghost" type="button" onClick={() => setCourseForm(EMPTY_COURSE_FORM)} disabled={busy}>Annuler</button>
                ) : null}
              </div>

              <form className="teacher-form-grid" onSubmit={handleCourseSubmit}>
                <label className="teacher-field">Titre
                  <input value={courseForm.title} onChange={(event) => setCourseForm((prev) => ({ ...prev, title: event.target.value }))} />
                </label>
                <label className="teacher-field">Classe
                  <select
                    value={courseForm.gradeLevelId}
                    onChange={(event) => setCourseForm((prev) => ({ ...prev, gradeLevelId: event.target.value }))}
                  >
                    <option value="">Choisir une classe</option>
                    {gradeLevels.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </select>
                </label>
                <label className="teacher-field">Matiere
                  <select
                    value={courseForm.subjectId}
                    onChange={(event) => setCourseForm((prev) => ({ ...prev, subjectId: event.target.value }))}
                  >
                    <option value="">Choisir une matiere</option>
                    {subjects.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </select>
                </label>
                <label className="teacher-field teacher-field-wide">Description
                  <textarea rows={3} value={courseForm.description} onChange={(event) => setCourseForm((prev) => ({ ...prev, description: event.target.value }))} />
                </label>
                <label className="teacher-field teacher-field-wide">URL image de couverture (optionnel)
                  <input value={courseForm.coverUrl} onChange={(event) => setCourseForm((prev) => ({ ...prev, coverUrl: event.target.value }))} placeholder="https://..." />
                </label>
                <button className="btn primary" type="submit" disabled={busy}>{courseForm.id ? "Mettre a jour" : "Ajouter le cours"}</button>
              </form>
            </article>

            <article className="teacher-panel">
              <div className="teacher-panel-head">
                <h2>Mes cours</h2>
                <input className="teacher-search-input" placeholder="Rechercher un cours..." value={courseSearch} onChange={(event) => setCourseSearch(event.target.value)} />
              </div>

              {filteredCourses.length ? (
                <div className="teacher-list">
                  {filteredCourses.map((course) => (
                    <article key={course.id} className="teacher-item-card">
                      <div className="teacher-item-title">
                        <h3>{course.title}</h3>
                        <p>{course.level} - {course.subject}</p>
                        <div className="teacher-meta-row">
                          <span className="teacher-pill">{course.published ? "Publie" : "Brouillon"}</span>
                          <span>Mise a jour: {toDateLabel(course.updated_at_ms)}</span>
                        </div>
                      </div>
                      <div className="teacher-item-actions">
                        <button className="btn ghost" type="button" onClick={() => editCourse(course)} disabled={busy}>Modifier</button>
                        <button className="btn ghost" type="button" onClick={() =>
                          void runAction(async () => {
                            const { error } = course.published
                              ? await supabase.rpc("review_content", {
                                  p_kind: "course",
                                  p_content_id: course.id,
                                  p_decision: "rejected",
                                  p_note: "Depublie depuis l'espace professeur.",
                                })
                              : await supabase.rpc("submit_content_for_review", {
                                  p_kind: "course",
                                  p_content_id: course.id,
                                });
                            if (error) throw error;
                          }, "Publication du cours mise a jour.")
                        } disabled={busy}>{course.published ? "Depublier" : "Publier"}</button>
                        <button className="btn ghost" type="button" onClick={() => { setSelectedCourseId(course.id); setTab("courses"); }} disabled={busy}>Chapitres</button>
                        <button className="btn ghost danger-outline" type="button" onClick={() =>
                          onDelete(`le cours "${course.title}"`, async () => {
                            const { error } = await supabase.from("courses").delete().eq("id", course.id);
                            if (error) throw error;
                          }, "Cours supprime.")
                        } disabled={busy}>Supprimer</button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="teacher-empty">Aucun cours correspondant.</p>
              )}
            </article>
          </section>

          <section className="teacher-panel">
            <div className="teacher-panel-head">
              <h3>Gestion des chapitres</h3>
              <select value={selectedCourseId} onChange={(event) => { setSelectedCourseId(event.target.value); setChapterForm(EMPTY_CHAPTER_FORM); }}>
                <option value="">Selectionner un cours</option>
                {courses.map((course) => (<option key={course.id} value={course.id}>{course.title}</option>))}
              </select>
            </div>

            <form className="teacher-form-grid" onSubmit={handleChapterSubmit}>
              <label className="teacher-field">Titre du chapitre
                <input value={chapterForm.title} onChange={(event) => setChapterForm((prev) => ({ ...prev, title: event.target.value }))} />
              </label>
              <label className="teacher-field">Ordre
                <input type="number" min="1" value={chapterForm.order} onChange={(event) => setChapterForm((prev) => ({ ...prev, order: event.target.value }))} />
              </label>
              <label className="teacher-field">Video en francais
                <input
                  value={chapterForm.videoUrl}
                  onChange={(event) => setChapterForm((prev) => ({ ...prev, videoUrl: event.target.value }))}
                  placeholder="https://... (.mp4, .m3u8, .mpd)"
                />
                {chapterForm.videoUrl.trim() &&
                /^https?:\/\//i.test(chapterForm.videoUrl.trim()) &&
                !isDirectMediaUrl(chapterForm.videoUrl.trim()) ? (
                  <small className="teacher-field-warning">
                    Ce lien ne ressemble pas a un flux direct : il s'ouvrira hors de l'application
                    au lieu d'etre lu dans le lecteur.
                  </small>
                ) : null}
              </label>

              {/* La lecon en langue locale est la raison d'etre d'iSkul : le web
                  ne pouvait pas la renseigner, l'application si. */}
              <fieldset className="teacher-field teacher-field-wide teacher-langs">
                <legend>Versions en langue locale (optionnel)</legend>
                {LOCAL_LANGUAGES.map((lang) => (
                  <label key={lang.key} className="teacher-lang-row">
                    <span>{lang.label}</span>
                    <input
                      value={chapterForm.videoByLang[lang.key] || ""}
                      onChange={(event) =>
                        setChapterForm((prev) => ({
                          ...prev,
                          videoByLang: { ...prev.videoByLang, [lang.key]: event.target.value },
                        }))
                      }
                      placeholder="https://..."
                    />
                  </label>
                ))}
              </fieldset>
              <div className="teacher-inline-actions">
                {chapterForm.id ? (<button className="btn ghost" type="button" onClick={() => setChapterForm(EMPTY_CHAPTER_FORM)} disabled={busy}>Annuler</button>) : null}
                <button className="btn primary" type="submit" disabled={busy}>{chapterForm.id ? "Mettre a jour chapitre" : "Ajouter chapitre"}</button>
              </div>
            </form>

            {selectedCourseId ? (
              chapterRows.length ? (
                <div className="teacher-list">
                  {chapterRows.map((chapter) => (
                    <article key={chapter.id} className="teacher-item-card">
                      <div className="teacher-item-title">
                        <h3>{chapter.title}</h3>
                        <p>Ordre: {chapter.order_index}</p>
                        <div className="teacher-meta-row">
                          <span>Maj: {toDateLabel(chapter.updated_at_ms)}</span>
                          {chapter.video_url ? (
                            <a className="teacher-link" href={chapter.video_url} target="_blank" rel="noreferrer">Ouvrir la video</a>
                          ) : (
                            <span className="muted">Aucune video</span>
                          )}
                        </div>
                      </div>
                      <div className="teacher-item-actions">
                        <button className="btn ghost" type="button" onClick={() => editChapter(chapter)} disabled={busy}>Modifier</button>
                        <button className="btn ghost danger-outline" type="button" onClick={() =>
                          onDelete(`le chapitre "${chapter.title}"`, async () => {
                            const { error } = await supabase.from("chapters").delete().eq("id", chapter.id);
                            if (error) throw error;
                          }, "Chapitre supprime.")
                        } disabled={busy}>Supprimer</button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="teacher-empty">Aucun chapitre pour ce cours.</p>
              )
            ) : (
              <p className="teacher-empty">Selectionnez un cours pour gerer ses chapitres.</p>
            )}
          </section>
        </>
      ) : null}

      {tab === "books" ? (
        <section className="teacher-layout-grid">
          <article className="teacher-panel">
            <div className="teacher-panel-head">
              <h2>{bookForm.id ? "Modifier le document" : "Nouveau document"}</h2>
              {bookForm.id ? (<button className="btn ghost" type="button" onClick={() => setBookForm(EMPTY_BOOK_FORM)} disabled={busy}>Annuler</button>) : null}
            </div>

            <form className="teacher-form-grid" onSubmit={handleBookSubmit}>
              <label className="teacher-field">Titre
                <input value={bookForm.title} onChange={(event) => setBookForm((prev) => ({ ...prev, title: event.target.value }))} />
              </label>
              <label className="teacher-field">Niveau
                <input value={bookForm.level} onChange={(event) => setBookForm((prev) => ({ ...prev, level: event.target.value }))} />
              </label>
              <label className="teacher-field">Matiere
                <input value={bookForm.subject} onChange={(event) => setBookForm((prev) => ({ ...prev, subject: event.target.value }))} />
              </label>
              <label className="teacher-field">Prix (FCFA)
                <input type="number" min="0" value={bookForm.price} onChange={(event) => setBookForm((prev) => ({ ...prev, price: event.target.value }))} />
              </label>
              <label className="teacher-field teacher-field-wide">URL couverture (optionnel)
                <input value={bookForm.coverUrl} onChange={(event) => setBookForm((prev) => ({ ...prev, coverUrl: event.target.value }))} placeholder="https://..." />
              </label>
              <label className="teacher-field teacher-field-wide">URL du fichier
                <input value={bookForm.fileUrl} onChange={(event) => setBookForm((prev) => ({ ...prev, fileUrl: event.target.value }))} placeholder="https://..." />
              </label>
              <button className="btn primary" type="submit" disabled={busy}>{bookForm.id ? "Mettre a jour" : "Ajouter le document"}</button>
            </form>
          </article>

          <article className="teacher-panel">
            <div className="teacher-panel-head">
              <h2>Mes documents</h2>
              <input className="teacher-search-input" placeholder="Rechercher un document..." value={bookSearch} onChange={(event) => setBookSearch(event.target.value)} />
            </div>

            {filteredBooks.length ? (
              <div className="teacher-list">
                {filteredBooks.map((book) => (
                  <article key={book.id} className="teacher-item-card">
                    <div className="teacher-item-title">
                      <h3>{book.title}</h3>
                      <p>{book.level || "-"} - {book.subject || "-"}</p>
                      <div className="teacher-meta-row">
                        <span className="teacher-pill">{book.published ? "Publie" : "Brouillon"}</span>
                        <span>{safeNumber(book.price).toLocaleString("fr-FR")} FCFA</span>
                        <a className="teacher-link" href={book.file_url} target="_blank" rel="noreferrer">Ouvrir le fichier</a>
                      </div>
                    </div>
                    <div className="teacher-item-actions">
                      <button className="btn ghost" type="button" onClick={() => editBook(book)} disabled={busy}>Modifier</button>
                      <button className="btn ghost" type="button" onClick={() =>
                        void runAction(async () => {
                          const { error } = book.published
                              ? await supabase.rpc("review_content", {
                                  p_kind: "book",
                                  p_content_id: book.id,
                                  p_decision: "rejected",
                                  p_note: "Depublie depuis l'espace professeur.",
                                })
                              : await supabase.rpc("submit_content_for_review", {
                                  p_kind: "book",
                                  p_content_id: book.id,
                                });
                          if (error) throw error;
                        }, "Publication du document mise a jour.")
                      } disabled={busy}>{book.published ? "Depublier" : "Publier"}</button>
                      <button className="btn ghost danger-outline" type="button" onClick={() =>
                        onDelete(`le document "${book.title}"`, async () => {
                          const { error } = await supabase.from("books").delete().eq("id", book.id);
                          if (error) throw error;
                        }, "Document supprime.")
                      } disabled={busy}>Supprimer</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="teacher-empty">Aucun document correspondant.</p>
            )}
          </article>
        </section>
      ) : null}

      {tab === "lives" ? (
        <section className="teacher-layout-grid">
          <article className="teacher-panel">
            <div className="teacher-panel-head">
              <h2>{liveForm.id ? "Modifier le live" : "Programmer un live"}</h2>
              {liveForm.id ? (<button className="btn ghost" type="button" onClick={() => setLiveForm(EMPTY_LIVE_FORM)} disabled={busy}>Annuler</button>) : null}
            </div>

            <form className="teacher-form-grid" onSubmit={handleLiveSubmit}>
              <label className="teacher-field">Titre
                <input value={liveForm.title} onChange={(event) => setLiveForm((prev) => ({ ...prev, title: event.target.value }))} />
              </label>
              <label className="teacher-field">Date / heure
                <input type="datetime-local" value={liveForm.startAt} onChange={(event) => setLiveForm((prev) => ({ ...prev, startAt: event.target.value }))} />
              </label>
              <label className="teacher-field">Statut
                <select value={liveForm.status} onChange={(event) => setLiveForm((prev) => ({ ...prev, status: event.target.value as LiveStatus }))}>
                  <option value="scheduled">Programmee</option>
                  <option value="live">En direct</option>
                  <option value="ended">Terminee</option>
                </select>
              </label>
              <label className="teacher-field teacher-field-wide">Description (optionnel)
                <textarea rows={3} value={liveForm.description} onChange={(event) => setLiveForm((prev) => ({ ...prev, description: event.target.value }))} />
              </label>
              <label className="teacher-field teacher-field-wide">URL streaming (optionnel)
                <input value={liveForm.streamingUrl} onChange={(event) => setLiveForm((prev) => ({ ...prev, streamingUrl: event.target.value }))} placeholder="https://..." />
              </label>
              <button className="btn primary" type="submit" disabled={busy}>{liveForm.id ? "Mettre a jour" : "Planifier le live"}</button>
            </form>
          </article>

          <article className="teacher-panel">
            <div className="teacher-panel-head">
              <h2>Mes lives</h2>
              <input className="teacher-search-input" placeholder="Rechercher un live..." value={liveSearch} onChange={(event) => setLiveSearch(event.target.value)} />
            </div>

            {filteredLives.length ? (
              <div className="teacher-list">
                {filteredLives.map((live) => (
                  <article key={live.id} className="teacher-item-card">
                    <div className="teacher-item-title">
                      <h3>{live.title}</h3>
                      <p>{toDateLabel(live.start_at_ms)}</p>
                      <div className="teacher-meta-row">
                        <span className="teacher-pill">{live.status}</span>
                        {live.streaming_url ? (
                          <a className="teacher-link" href={live.streaming_url} target="_blank" rel="noreferrer">Ouvrir le stream</a>
                        ) : (
                          <span className="muted">Pas de lien de streaming</span>
                        )}
                      </div>
                    </div>
                    <div className="teacher-item-actions">
                      <button className="btn ghost" type="button" onClick={() => editLive(live)} disabled={busy}>Modifier</button>
                      <button className="btn ghost" type="button" onClick={() => {
                        const nextStatus: LiveStatus = live.status === "scheduled" ? "live" : live.status === "live" ? "ended" : "scheduled";
                        void runAction(async () => {
                          const { error } = await supabase.from("lives").update({ status: nextStatus, updated_at_ms: Date.now() }).eq("id", live.id);
                          if (error) throw error;
                        }, "Statut du live mis a jour.");
                      }} disabled={busy}>Changer statut</button>
                      <button className="btn ghost danger-outline" type="button" onClick={() =>
                        onDelete(`le live "${live.title}"`, async () => {
                          const { error } = await supabase.from("lives").delete().eq("id", live.id);
                          if (error) throw error;
                        }, "Live supprime.")
                      } disabled={busy}>Supprimer</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="teacher-empty">Aucun live correspondant.</p>
            )}
          </article>
        </section>
      ) : null}

      {tab === "quizzes" ? (
        <section className="teacher-layout-grid">
          <article className="teacher-panel">
            <div className="teacher-panel-head">
              <h2>{quizForm.id ? "Modifier le quiz" : "Nouveau quiz"}</h2>
              {quizForm.id ? (<button className="btn ghost" type="button" onClick={() => setQuizForm(makeEmptyQuizForm())} disabled={busy}>Annuler</button>) : null}
            </div>

            <form className="teacher-form-grid" onSubmit={handleQuizSubmit}>
              <label className="teacher-field">Portee
                <select value={quizForm.scope} onChange={(event) => handleQuizScopeChange(event.target.value as QuizScope)}>
                  <option value="standalone">Standalone</option>
                  <option value="lesson">Quiz de lecon</option>
                </select>
              </label>

              {quizForm.scope === "lesson" ? (
                <>
                  <label className="teacher-field">Cours
                    <select value={quizForm.courseId} onChange={(event) => {
                      const nextCourseId = event.target.value;
                      const nextChapterId = allChapters.find((chapter) => chapter.course_id === nextCourseId)?.id || "";
                      setQuizForm((previous) => ({ ...previous, courseId: nextCourseId, chapterId: nextChapterId }));
                    }}>
                      <option value="">Selectionner un cours</option>
                      {courses.map((course) => (<option key={course.id} value={course.id}>{course.title}</option>))}
                    </select>
                  </label>
                  <label className="teacher-field">Chapitre
                    <select value={quizForm.chapterId} onChange={(event) => setQuizForm((previous) => ({ ...previous, chapterId: event.target.value }))}>
                      <option value="">Selectionner un chapitre</option>
                      {quizCourseChapters.map((chapter) => (<option key={chapter.id} value={chapter.id}>{chapter.title}</option>))}
                    </select>
                  </label>
                </>
              ) : (
                <>
                  <label className="teacher-field">Niveau
                    <input value={quizForm.level} onChange={(event) => setQuizForm((previous) => ({ ...previous, level: event.target.value }))} />
                  </label>
                  <label className="teacher-field">Matiere
                    <input value={quizForm.subject} onChange={(event) => setQuizForm((previous) => ({ ...previous, subject: event.target.value }))} />
                  </label>
                </>
              )}

              <label className="teacher-field">Titre du quiz
                <input value={quizForm.title} onChange={(event) => setQuizForm((previous) => ({ ...previous, title: event.target.value }))} />
              </label>
              <label className="teacher-field teacher-field-wide">Description (optionnel)
                <textarea rows={2} value={quizForm.description} onChange={(event) => setQuizForm((previous) => ({ ...previous, description: event.target.value }))} />
              </label>

              <div className="teacher-question-list teacher-field-wide">
                {quizForm.questions.map((question, questionIndex) => (
                  <article key={question.localId} className="teacher-question-card">
                    <div className="teacher-question-head">
                      <h3>Question {questionIndex + 1}</h3>
                      <button className="btn ghost danger-outline" type="button" onClick={() => removeQuizQuestion(question.localId)} disabled={busy || quizForm.questions.length <= 1}>Supprimer</button>
                    </div>

                    <label className="teacher-field teacher-field-wide">Intitule
                      <textarea rows={2} value={question.prompt} onChange={(event) => updateQuizQuestion(question.localId, { prompt: event.target.value })} />
                    </label>

                    <div className="teacher-option-list">
                      {question.options.map((option, optionIndex) => (
                        <div key={`${question.localId}-${optionIndex}`} className="teacher-option-row">
                          <label className="teacher-option-correct">
                            <input type="radio" name={`correct-${question.localId}`} checked={question.correctIndex === optionIndex} onChange={() => updateQuizQuestion(question.localId, { correctIndex: optionIndex })} />
                            <span>Bonne</span>
                          </label>
                          <input value={option} onChange={(event) => {
                            const nextOptions = question.options.map((item, idx) => idx === optionIndex ? event.target.value : item);
                            updateQuizQuestion(question.localId, { options: nextOptions });
                          }} placeholder={`Option ${optionIndex + 1}`} />
                          <button className="btn ghost" type="button" onClick={() => removeQuizOption(question.localId, optionIndex)} disabled={busy || question.options.length <= 2}>Retirer</button>
                        </div>
                      ))}
                    </div>

                    <div className="teacher-inline-actions">
                      <button className="btn ghost" type="button" onClick={() => addQuizOption(question.localId)} disabled={busy}>Ajouter une option</button>
                    </div>
                  </article>
                ))}
              </div>

              <div className="teacher-inline-actions teacher-field-wide">
                <button className="btn ghost" type="button" onClick={addQuizQuestion} disabled={busy}>Ajouter une question</button>
                <button className="btn primary" type="submit" disabled={busy}>{quizForm.id ? "Mettre a jour le quiz" : "Creer le quiz"}</button>
              </div>
            </form>
          </article>

          <article className="teacher-panel">
            <div className="teacher-panel-head">
              <h2>Mes quiz</h2>
              <input className="teacher-search-input" placeholder="Rechercher un quiz..." value={quizSearch} onChange={(event) => setQuizSearch(event.target.value)} />
            </div>

            {filteredQuizzes.length ? (
              <div className="teacher-list">
                {filteredQuizzes.map((quiz) => {
                  const scope: QuizScope = quiz.course_id && quiz.chapter_id ? "lesson" : "standalone";
                  const metric = quizMetrics[quiz.id] || { attempts: 0, avgScorePct: 0, bestScorePct: 0 };
                  const course = quiz.course_id ? courseMap.get(quiz.course_id) : null;
                  const chapter = quiz.chapter_id ? chapterMap.get(quiz.chapter_id) : null;
                  const questionsCount = Array.isArray(quiz.questions) ? quiz.questions.length : 0;

                  return (
                    <article key={quiz.id} className="teacher-item-card">
                      <div className="teacher-item-title">
                        <h3>{quiz.title}</h3>
                        <p>
                          {scope === "lesson"
                            ? `${course?.title || "Cours"} / ${chapter?.title || "Chapitre"}`
                            : `${quiz.level || "-"} - ${quiz.subject || "-"}`}
                        </p>
                        <div className="teacher-meta-row">
                          <span className="teacher-pill">{quiz.published ? "Publie" : "Brouillon"}</span>
                          <span>{questionsCount} questions</span>
                          <span>{metric.attempts} tentatives</span>
                          <span>Score moyen: {metric.avgScorePct.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="teacher-item-actions">
                        <button className="btn ghost" type="button" onClick={() => editQuiz(quiz)} disabled={busy}>Modifier</button>
                        <button className="btn ghost" type="button" onClick={() =>
                          void runAction(async () => {
                            const { error } = quiz.published
                              ? await supabase.rpc("review_content", {
                                  p_kind: "quiz",
                                  p_content_id: quiz.id,
                                  p_decision: "rejected",
                                  p_note: "Depublie depuis l'espace professeur.",
                                })
                              : await supabase.rpc("submit_content_for_review", {
                                  p_kind: "quiz",
                                  p_content_id: quiz.id,
                                });
                            if (error) throw error;
                          }, "Publication du quiz mise a jour.")
                        } disabled={busy}>{quiz.published ? "Depublier" : "Publier"}</button>
                        <button className="btn ghost danger-outline" type="button" onClick={() =>
                          onDelete(`le quiz "${quiz.title}"`, async () => {
                            const { error } = await supabase.from("quizzes").delete().eq("id", quiz.id);
                            if (error) throw error;
                          }, "Quiz supprime.")
                        } disabled={busy}>Supprimer</button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="teacher-empty">Aucun quiz correspondant.</p>
            )}
          </article>
        </section>
      ) : null}
    </div>
  );
}
