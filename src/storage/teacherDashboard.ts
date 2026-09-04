import { SUPABASE_READY, supabase } from "@/lib/supabase";
import {
  EMPTY_TEACHER_DASHBOARD,
  parseTeacherDashboard,
  type TeacherDashboardSnapshot,
} from "@/lib/teacherAnalytics";

export type {
  TeacherAtRiskLearner,
  TeacherChapterStat,
  TeacherCourseStat,
  TeacherDailyStat,
  TeacherDashboardSnapshot,
  TeacherQuizStat,
  TeacherWeakQuestion,
} from "@/lib/teacherAnalytics";

export type TeacherLearner = {
  userId: string;
  name: string;
  grade?: string | null;
  completionRate: number;
  lessonsStarted: number;
  quizAttempts: number;
  avgScorePct: number;
  lastActiveMs?: number | null;
};

function num(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/**
 * Indicateurs du professeur, calcules en base.
 *
 * Ces agregats ne peuvent pas etre calcules cote client : les politiques RLS de
 * lesson_progress et quiz_attempts ne rendent que les lignes de l'appelant, si
 * bien qu'un professeur recevait zero ligne et voyait tout a zero. La fonction
 * teacher_dashboard verifie qu'il possede bien les contenus avant d'agreger.
 */
export async function getTeacherDashboard(days = 30): Promise<TeacherDashboardSnapshot> {
  if (!SUPABASE_READY) return EMPTY_TEACHER_DASHBOARD;

  const { data, error } = await supabase.rpc("teacher_dashboard", { p_days: days });
  if (error) throw new Error(error.message || "Indicateurs indisponibles.");

  return parseTeacherDashboard(data);
}

/**
 * Eleves ayant travaille sur les contenus du professeur.
 * Pas d'annuaire general : seuls apparaissent ceux qui ont ouvert une de ses
 * lecons ou passe un de ses quiz.
 */
export async function getTeacherLearners(limit = 100): Promise<TeacherLearner[]> {
  if (!SUPABASE_READY) return [];

  const { data, error } = await supabase.rpc("teacher_learners", { p_limit: limit });
  if (error) throw new Error(error.message || "Liste des élèves indisponible.");

  const rows = Array.isArray(data) ? data : [];
  return rows.map((row: any) => ({
    userId: String(row?.user_id ?? ""),
    name: String(row?.name ?? "Élève"),
    grade: row?.grade ?? null,
    completionRate: clamp01(num(row?.completion_rate)),
    lessonsStarted: num(row?.lessons_started),
    quizAttempts: num(row?.quiz_attempts),
    avgScorePct: num(row?.avg_score_pct),
    lastActiveMs: row?.last_active_ms ?? null,
  }));
}
