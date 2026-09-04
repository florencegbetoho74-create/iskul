import { supabase } from "./supabase";

/**
 * Acces au back-office.
 *
 * Chaque fonction correspond a une procedure `security definer` qui verifie
 * elle-meme le droit d'appel : la console ne decide de rien, elle demande. Un
 * ecran cache cote client n'a jamais protege une donnee.
 *
 * Les formes de retour sont celles declarees par les migrations. Les recopier
 * ici plutot que d'utiliser `any` fait apparaitre a la compilation le jour ou
 * une colonne change de nom.
 */

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args ?? {});
  if (error) throw new Error(translate(error.message));
  return data as T;
}

/** Les codes leves par les procedures deviennent des phrases lisibles. */
function translate(raw: string): string {
  if (raw.includes("admin_only")) return "Cette action est reservee aux administrateurs.";
  if (raw.includes("reviewer_only")) return "Cette action est reservee aux relecteurs.";
  if (raw.includes("auth_required")) return "Votre session a expire. Reconnectez-vous.";
  if (raw.includes("JWT") || raw.includes("401")) return "Votre session a expire. Reconnectez-vous.";
  return raw;
}

/* -------------------------------------------------------------------------- */
/* Vue d'ensemble                                                             */
/* -------------------------------------------------------------------------- */

export type DashboardSnapshot = {
  users: number;
  teachers: number;
  admins: number;
  courses: number;
  coursesPublished: number;
  documents: number;
  documentsPublished: number;
  lives: number;
  livesActive: number;
  quizzes: number;
  quizzesPublished: number;
  messages: number;
  threads: number;
  teacherPortalOpen: boolean;
  teacherPortalMessage: string | null;
};

export function getSnapshot() {
  return rpc<DashboardSnapshot>("admin_dashboard_snapshot");
}

export type PushHealth = {
  pending: number;
  failed: number;
  sent: number;
  oldestPendingMs: number | null;
  lastSentMs: number | null;
};

export function getPushHealth() {
  return rpc<PushHealth>("admin_push_health");
}

/* -------------------------------------------------------------------------- */
/* Comptes                                                                    */
/* -------------------------------------------------------------------------- */

export type AdminUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  is_admin: boolean;
  school: string | null;
  grade: string | null;
  last_seen_ms: number | null;
  created_at_ms: number | null;
  updated_at_ms: number | null;
  courses_count: number;
  books_count: number;
  lives_count: number;
  quizzes_count: number;
};

export function listUsers(search?: string, limit = 100, offset = 0) {
  return rpc<AdminUser[]>("admin_list_users", {
    p_limit: limit,
    p_offset: offset,
    p_search: search?.trim() || null,
  });
}

export function setUserRole(userId: string, role: string) {
  return rpc<void>("admin_set_user_role", { p_user_id: userId, p_role: role });
}

export function setUserAdmin(userId: string, isAdmin: boolean) {
  return rpc<void>("admin_set_user_admin", { p_user_id: userId, p_is_admin: isAdmin });
}

export function setUserReviewer(userId: string, isReviewer: boolean) {
  return rpc<void>("admin_set_user_reviewer", { p_user_id: userId, p_is_reviewer: isReviewer });
}

/* -------------------------------------------------------------------------- */
/* Relecture editoriale                                                       */
/* -------------------------------------------------------------------------- */

export type ReviewItem = {
  content_kind: "course" | "book" | "quiz";
  content_id: string;
  title: string | null;
  level: string | null;
  subject: string | null;
  owner_id: string;
  owner_name: string | null;
  submitted_at_ms: number | null;
};

export function getReviewQueue() {
  return rpc<ReviewItem[]>("review_queue");
}

/** `approve` publie, `reject` renvoie a l'auteur avec un motif. */
export function reviewContent(
  kind: string,
  contentId: string,
  decision: "approve" | "reject",
  note?: string
) {
  return rpc<unknown>("review_content", {
    p_kind: kind,
    p_content_id: contentId,
    p_decision: decision,
    p_note: note?.trim() || null,
  });
}

/* -------------------------------------------------------------------------- */
/* Contenus                                                                   */
/* -------------------------------------------------------------------------- */

export type AdminCourse = {
  id: string;
  title: string | null;
  level: string | null;
  subject: string | null;
  published: boolean;
  owner_id: string;
  owner_name: string | null;
  updated_at_ms: number | null;
};

export type AdminBook = AdminCourse & { price: number | null };

export type AdminQuiz = {
  id: string;
  title: string | null;
  scope: string | null;
  level: string | null;
  subject: string | null;
  published: boolean;
  owner_id: string;
  owner_name: string | null;
  course_title: string | null;
  chapter_title: string | null;
  updated_at_ms: number | null;
  attempts: number;
};

export type AdminLive = {
  id: string;
  title: string | null;
  status: string | null;
  owner_id: string;
  owner_name: string | null;
  start_at_ms: number | null;
  updated_at_ms: number | null;
};

const listArgs = (search?: string, limit = 200, offset = 0) => ({
  p_limit: limit,
  p_offset: offset,
  p_search: search?.trim() || null,
});

export const listCourses = (search?: string) =>
  rpc<AdminCourse[]>("admin_list_courses", listArgs(search));
export const listBooks = (search?: string) => rpc<AdminBook[]>("admin_list_books", listArgs(search));
export const listQuizzes = (search?: string) =>
  rpc<AdminQuiz[]>("admin_list_quizzes", listArgs(search));
export const listLives = (search?: string) => rpc<AdminLive[]>("admin_list_lives", listArgs(search));

export const setCoursePublished = (id: string, published: boolean) =>
  rpc<void>("admin_set_course_published", { p_course_id: id, p_published: published });
export const setBookPublished = (id: string, published: boolean) =>
  rpc<void>("admin_set_book_published", { p_book_id: id, p_published: published });
export const setQuizPublished = (id: string, published: boolean) =>
  rpc<void>("admin_set_quiz_published", { p_quiz_id: id, p_published: published });
export const setLiveStatus = (id: string, status: string) =>
  rpc<void>("admin_set_live_status", { p_live_id: id, p_status: status });

/* -------------------------------------------------------------------------- */
/* Contenus non classes                                                       */
/* -------------------------------------------------------------------------- */

export type UnclassifiedItem = {
  kind: string;
  id: string;
  title: string | null;
  level_text: string | null;
  subject_text: string | null;
  owner_id: string | null;
  updated_at_ms: number | null;
};

/**
 * Contenus sans rattachement au referentiel.
 *
 * Ils n'apparaissent dans la portee d'aucun eleve : leur auteur les croit en
 * ligne, personne ne les voit. C'est la liste la plus utile de la console.
 */
export function listUnclassified() {
  return rpc<UnclassifiedItem[]>("admin_unclassified_content");
}

/* -------------------------------------------------------------------------- */
/* Conversations                                                              */
/* -------------------------------------------------------------------------- */

export type AdminThread = {
  id: string;
  teacher_name: string | null;
  student_name: string | null;
  course_title: string | null;
  last_text: string | null;
  last_at_ms: number | null;
  message_count: number;
};

export function listThreads(search?: string) {
  return rpc<AdminThread[]>("admin_list_messages", listArgs(search, 300));
}

/* -------------------------------------------------------------------------- */
/* Portail professeur                                                         */
/* -------------------------------------------------------------------------- */

export type PortalSettings = { open: boolean; message: string | null; updatedAtMs: number | null };

type PortalSettingsRow = {
  teacher_portal_open: boolean;
  teacher_portal_message: string | null;
  updated_at_ms: number | null;
};

/** La procedure rend une table d'une ligne, pas un objet. */
export async function getPortalSettings(): Promise<PortalSettings> {
  const rows = await rpc<PortalSettingsRow[]>("admin_get_portal_settings");
  const row = Array.isArray(rows) ? rows[0] : null;
  return {
    open: row?.teacher_portal_open ?? false,
    message: row?.teacher_portal_message ?? null,
    updatedAtMs: row?.updated_at_ms ?? null,
  };
}

export function updatePortalSettings(open: boolean, message: string | null) {
  return rpc<unknown>("admin_update_portal_settings", {
    p_open: open,
    p_message: message?.trim() || null,
  });
}

/* -------------------------------------------------------------------------- */
/* Roles d'equipe                                                             */
/* -------------------------------------------------------------------------- */

export type StaffRole = "course_reviewer" | "librarian" | "quiz_reviewer" | "live_moderator";

/**
 * Les quatre roles nommes, avec ce qu'ils autorisent en toutes lettres.
 *
 * Le libelle seul ne suffit pas : celui qui attribue un droit doit lire ce
 * qu'il ouvre, pas le deviner.
 */
export const STAFF_ROLES: { key: StaffRole; label: string; grants: string }[] = [
  {
    key: "course_reviewer",
    label: "Relecteur cours",
    grants: "Valide ou renvoie les cours. Ne voit que les cours dans sa file.",
  },
  {
    key: "librarian",
    label: "Bibliothécaire",
    grants: "Valide, publie et dépublie les documents. N'a aucun droit sur les cours.",
  },
  {
    key: "quiz_reviewer",
    label: "Relecteur quiz",
    grants: "Valide ou renvoie les quiz.",
  },
  {
    key: "live_moderator",
    label: "Modérateur live",
    grants: "Change l'état des séances : programmée, en cours, terminée.",
  },
];

export function listStaffRoles() {
  return rpc<{ user_id: string; staff_roles: StaffRole[] }[]>("admin_list_staff_roles");
}

export function setStaffRoles(userId: string, roles: StaffRole[]) {
  return rpc<StaffRole[]>("admin_set_staff_roles", { p_user_id: userId, p_roles: roles });
}
