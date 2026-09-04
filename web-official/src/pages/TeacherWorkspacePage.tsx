import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Link } from "react-router-dom";

import { supabase } from "../lib/supabase";
import {
  EMPTY_BOOK_FORM,
  EMPTY_CHAPTER_FORM,
  EMPTY_COURSE_FORM,
  EMPTY_LIVE_FORM,
  EMPTY_OVERVIEW,
  TAB_LABELS,
} from "./teacher/constants";
import {
  clamp01,
  createLocalId,
  dayLabel,
  makeEmptyQuestion,
  makeEmptyQuizForm,
  normalizeQuizQuestions,
  parseDatetimeLocalInput,
  prepareQuizQuestions,
  safeNumber,
  toDateLabel,
  toDatetimeLocalInput,
  toErrorMessage,
} from "./teacher/helpers";
import type {
  BookForm,
  BookRow,
  ChapterForm,
  ChapterInsight,
  ChapterRow,
  CourseForm,
  CourseInsight,
  CourseRow,
  DailyInsight,
  LiveForm,
  LiveRow,
  LiveStatus,
  Notice,
  OverviewMetrics,
  PeriodDays,
  ProfileRow,
  QuizEditorQuestion,
  QuizForm,
  QuizMetrics,
  QuizRow,
  QuizScope,
  TabKey,
  WeakQuestionInsight,
} from "./teacher/types";
import { BarChart, LineChart } from "../components/teacher/Charts";
import OverviewPanel from "./teacher/panels/OverviewPanel";
import CoursesPanel from "./teacher/panels/CoursesPanel";
import BooksPanel from "./teacher/panels/BooksPanel";
import LivesPanel from "./teacher/panels/LivesPanel";
import QuizzesPanel from "./teacher/panels/QuizzesPanel";

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
      courseForm.id ? "Cours mis a jour." : "Cours créé."
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
      quizForm.id ? "Quiz mis a jour." : "Quiz créé."
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
              Créer un compte professeur
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
        <OverviewPanel
          activeLives={activeLives}
          analyticsDays={analyticsDays}
          books={books}
          busy={busy}
          chapterInsights={chapterInsights}
          chartMaxAttempts={chartMaxAttempts}
          chartMaxPct={chartMaxPct}
          completionSeries={completionSeries}
          courseInsights={courseInsights}
          courses={courses}
          dailyInsights={dailyInsights}
          lives={lives}
          overview={overview}
          publishedBooks={publishedBooks}
          publishedCourses={publishedCourses}
          publishedQuizzes={publishedQuizzes}
          quizAttemptsSeries={quizAttemptsSeries}
          quizScoreSeries={quizScoreSeries}
          quizzes={quizzes}
          setAnalyticsDays={setAnalyticsDays}
          setTab={setTab}
          weakQuestions={weakQuestions}
        />
      ) : null}

      {tab === "courses" ? (
        <CoursesPanel
          busy={busy}
          chapterForm={chapterForm}
          chapterRows={chapterRows}
          courseForm={courseForm}
          courseSearch={courseSearch}
          courses={courses}
          editChapter={editChapter}
          editCourse={editCourse}
          filteredCourses={filteredCourses}
          gradeLevels={gradeLevels}
          handleChapterSubmit={handleChapterSubmit}
          handleCourseSubmit={handleCourseSubmit}
          onDelete={onDelete}
          runAction={runAction}
          selectedCourseId={selectedCourseId}
          setChapterForm={setChapterForm}
          setCourseForm={setCourseForm}
          setCourseSearch={setCourseSearch}
          setSelectedCourseId={setSelectedCourseId}
          setTab={setTab}
          subjects={subjects}
        />
      ) : null}

      {tab === "books" ? (
        <BooksPanel
          bookForm={bookForm}
          bookSearch={bookSearch}
          books={books}
          busy={busy}
          editBook={editBook}
          filteredBooks={filteredBooks}
          handleBookSubmit={handleBookSubmit}
          onDelete={onDelete}
          runAction={runAction}
          setBookForm={setBookForm}
          setBookSearch={setBookSearch}
        />
      ) : null}

      {tab === "lives" ? (
        <LivesPanel
          busy={busy}
          editLive={editLive}
          filteredLives={filteredLives}
          handleLiveSubmit={handleLiveSubmit}
          liveForm={liveForm}
          liveSearch={liveSearch}
          lives={lives}
          onDelete={onDelete}
          runAction={runAction}
          setLiveForm={setLiveForm}
          setLiveSearch={setLiveSearch}
        />
      ) : null}

      {tab === "quizzes" ? (
        <QuizzesPanel
          addQuizOption={addQuizOption}
          addQuizQuestion={addQuizQuestion}
          allChapters={allChapters}
          busy={busy}
          chapterMap={chapterMap}
          courseMap={courseMap}
          courses={courses}
          editQuiz={editQuiz}
          filteredQuizzes={filteredQuizzes}
          handleQuizScopeChange={handleQuizScopeChange}
          handleQuizSubmit={handleQuizSubmit}
          onDelete={onDelete}
          quizCourseChapters={quizCourseChapters}
          quizForm={quizForm}
          quizMetrics={quizMetrics}
          quizSearch={quizSearch}
          quizzes={quizzes}
          removeQuizOption={removeQuizOption}
          removeQuizQuestion={removeQuizQuestion}
          runAction={runAction}
          setQuizForm={setQuizForm}
          setQuizSearch={setQuizSearch}
          updateQuizQuestion={updateQuizQuestion}
        />
      ) : null}
    </div>
  );
}
