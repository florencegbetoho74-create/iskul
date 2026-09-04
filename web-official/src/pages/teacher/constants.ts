/** Valeurs de depart des formulaires et libelles des onglets. */

import type {
  BookForm,
  ChapterForm,
  CourseForm,
  LiveForm,
  OverviewMetrics,
  TabKey,
} from "./types";

export const TAB_LABELS: Record<TabKey, string> = {
  overview: "Vue d'ensemble",
  courses: "Cours",
  books: "Bibliotheque",
  lives: "Lives",
  quizzes: "Quiz",
};

export const EMPTY_OVERVIEW: OverviewMetrics = {
  learners: 0,
  completionRatePct: 0,
  quizAttempts: 0,
  quizAvgScorePct: 0,
  atRiskLearners: 0,
};

export const EMPTY_COURSE_FORM: CourseForm = {
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

export const EMPTY_CHAPTER_FORM: ChapterForm = {
  videoByLang: {},
  id: null,
  title: "",
  order: "",
  videoUrl: "",
};

export const EMPTY_BOOK_FORM: BookForm = {
  id: null,
  title: "",
  level: "",
  subject: "",
  price: "0",
  coverUrl: "",
  fileUrl: "",
  published: false,
};

export const EMPTY_LIVE_FORM: LiveForm = {
  id: null,
  title: "",
  description: "",
  startAt: "",
  streamingUrl: "",
  status: "scheduled",
};
