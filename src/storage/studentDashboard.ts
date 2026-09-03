import { SUPABASE_READY, supabase } from "@/lib/supabase";
import {
  EMPTY_STUDENT_DASHBOARD,
  parseStudentDashboard,
  type StudentDashboard,
} from "@/lib/studentDashboard";

export type {
  FreshCourse,
  NextLive,
  PendingQuiz,
  ResumeItem,
  StudentDashboard,
  StudentTotals,
  WeeklyPoint,
} from "@/lib/studentDashboard";

/**
 * Instantane de l'accueil eleve.
 *
 * Une seule requete : reprise, semaine, quiz en attente, prochain live et
 * nouveautes venaient auparavant de six appels separes, ce qui se voit sur une
 * connexion mobile.
 */
export async function getStudentDashboard(days = 7): Promise<StudentDashboard> {
  if (!SUPABASE_READY) return EMPTY_STUDENT_DASHBOARD;

  const { data, error } = await supabase.rpc("student_dashboard", { p_days: days });
  if (error) throw new Error(error.message || "Tableau de bord indisponible.");

  return parseStudentDashboard(data);
}
