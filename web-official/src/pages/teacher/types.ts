/**
 * Formes des donnees de l'espace professeur.
 *
 * Vingt-quatre types ouvraient un fichier de deux mille deux cents lignes :
 * on ne pouvait pas lire une fonction sans faire defiler leurs declarations.
 */

import type { VideoByLang } from "../../lib/referentials";

export type TabKey = "overview" | "courses" | "books" | "lives" | "quizzes";

export type QuizScope = "standalone" | "lesson";

export type ProfileRow = {
  id: string;
  name: string | null;
  role: string | null;
  school: string | null;
  email: string | null;
  is_admin: boolean | null;
};

export type CourseRow = {
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

export type ChapterRow = {
  id: string;
  course_id: string;
  title: string;
  order_index: number;
  video_url: string | null;
  video_by_lang: Record<string, string> | null;
  updated_at_ms: number | null;
};

export type BookRow = {
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

export type LiveStatus = "scheduled" | "live" | "ended";

export type LiveRow = {
  id: string;
  title: string;
  description: string | null;
  status: LiveStatus;
  start_at_ms: number;
  streaming_url: string | null;
  updated_at_ms: number | null;
};

export type QuizRawQuestion = {
  id?: string;
  prompt?: string;
  options?: unknown;
  correctIndices?: unknown;
  correctIndex?: unknown;
};

export type QuizRow = {
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

export type QuizMetrics = {
  attempts: number;
  avgScorePct: number;
  bestScorePct: number;
};

export type OverviewMetrics = {
  learners: number;
  completionRatePct: number;
  quizAttempts: number;
  quizAvgScorePct: number;
  atRiskLearners: number;
};

export type DailyInsight = {
  day: string;
  completionRatePct: number;
  quizAttempts: number;
  quizAvgScorePct: number;
  activeLearners: number;
};

export type CourseInsight = {
  courseId: string;
  title: string;
  learners: number;
  completionRatePct: number;
  quizAttempts: number;
  quizAvgScorePct: number;
};

export type ChapterInsight = {
  chapterId: string;
  courseId: string;
  title: string;
  courseTitle: string;
  learners: number;
  completionRatePct: number;
  quizAttempts: number;
  quizAvgScorePct: number;
};

export type WeakQuestionInsight = {
  key: string;
  quizId: string;
  quizTitle: string;
  courseTitle: string;
  chapterTitle: string;
  prompt: string;
  attempts: number;
  accuracyPct: number;
};

export type PeriodDays = 7 | 30 | 90;

export type CourseForm = {
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

export type ChapterForm = {
  id: string | null;
  title: string;
  order: string;
  videoUrl: string;
  videoByLang: VideoByLang;
};

export type BookForm = {
  id: string | null;
  title: string;
  level: string;
  subject: string;
  price: string;
  coverUrl: string;
  fileUrl: string;
  published: boolean;
};

export type LiveForm = {
  id: string | null;
  title: string;
  description: string;
  startAt: string;
  streamingUrl: string;
  status: LiveStatus;
};

export type QuizEditorQuestion = {
  localId: string;
  prompt: string;
  options: string[];
  correctIndex: number;
};

export type QuizForm = {
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

export type Notice = {
  kind: "success" | "error";
  text: string;
} | null;
