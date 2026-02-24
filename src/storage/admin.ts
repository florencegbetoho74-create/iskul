import { supabase } from "@/lib/supabase";

export type AdminDashboardSnapshot = {
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
  teacherPortalMessage?: string | null;
};

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  role: "student" | "teacher";
  isAdmin: boolean;
  school?: string | null;
  grade?: string | null;
  lastSeenMs?: number | null;
  createdAtMs?: number | null;
  updatedAtMs?: number | null;
  coursesCount: number;
  booksCount: number;
  livesCount: number;
  quizzesCount: number;
};

export type AdminCourseRow = {
  id: string;
  title: string;
  level?: string | null;
  subject?: string | null;
  published: boolean;
  ownerId: string;
  ownerName: string;
  updatedAtMs?: number | null;
};

export type AdminBookRow = {
  id: string;
  title: string;
  level?: string | null;
  subject?: string | null;
  price?: number | null;
  published: boolean;
  ownerId: string;
  ownerName: string;
  updatedAtMs?: number | null;
};

export type AdminLiveRow = {
  id: string;
  title: string;
  status: "scheduled" | "live" | "ended";
  ownerId: string;
  ownerName: string;
  startAtMs?: number | null;
  updatedAtMs?: number | null;
};

export type AdminQuizRow = {
  id: string;
  title: string;
  scope: "lesson" | "standalone";
  level?: string | null;
  subject?: string | null;
  published: boolean;
  ownerId: string;
  ownerName: string;
  courseTitle?: string | null;
  chapterTitle?: string | null;
  updatedAtMs?: number | null;
  attempts: number;
};

export type AdminMessageRow = {
  id: string;
  teacherName?: string | null;
  studentName?: string | null;
  courseTitle?: string | null;
  lastText?: string | null;
  lastAtMs?: number | null;
  messageCount: number;
};

export type AdminPortalSettings = {
  teacherPortalOpen: boolean;
  teacherPortalMessage?: string | null;
  updatedAtMs?: number | null;
};

function assertNoError(error: any, fallback: string) {
  if (!error) return;
  throw new Error(error?.message || fallback);
}

export async function getAdminDashboard(): Promise<AdminDashboardSnapshot> {
  const { data, error } = await supabase.rpc("admin_dashboard_snapshot");
  assertNoError(error, "Impossible de charger le tableau de bord admin.");

  const row = (data || {}) as any;
  return {
    users: Number(row.users || 0),
    teachers: Number(row.teachers || 0),
    admins: Number(row.admins || 0),
    courses: Number(row.courses || 0),
    coursesPublished: Number(row.coursesPublished || 0),
    documents: Number(row.documents || 0),
    documentsPublished: Number(row.documentsPublished || 0),
    lives: Number(row.lives || 0),
    livesActive: Number(row.livesActive || 0),
    quizzes: Number(row.quizzes || 0),
    quizzesPublished: Number(row.quizzesPublished || 0),
    messages: Number(row.messages || 0),
    threads: Number(row.threads || 0),
    teacherPortalOpen: !!row.teacherPortalOpen,
    teacherPortalMessage: row.teacherPortalMessage ?? null,
  };
}

export async function listAdminUsers(params?: {
  limit?: number;
  offset?: number;
  search?: string;
}): Promise<AdminUserRow[]> {
  const { data, error } = await supabase.rpc("admin_list_users", {
    p_limit: params?.limit ?? 120,
    p_offset: params?.offset ?? 0,
    p_search: params?.search?.trim() || null,
  });
  assertNoError(error, "Impossible de charger les utilisateurs.");
  return ((data as any[]) || []).map((r) => ({
    id: String(r.id),
    name: String(r.name || "Sans nom"),
    email: String(r.email || ""),
    role: r.role === "teacher" ? "teacher" : "student",
    isAdmin: !!r.is_admin,
    school: r.school ?? null,
    grade: r.grade ?? null,
    lastSeenMs: r.last_seen_ms ?? null,
    createdAtMs: r.created_at_ms ?? null,
    updatedAtMs: r.updated_at_ms ?? null,
    coursesCount: Number(r.courses_count || 0),
    booksCount: Number(r.books_count || 0),
    livesCount: Number(r.lives_count || 0),
    quizzesCount: Number(r.quizzes_count || 0),
  }));
}

export async function setAdminUserRole(userId: string, role: "student" | "teacher") {
  const { error } = await supabase.rpc("admin_set_user_role", {
    p_user_id: userId,
    p_role: role,
  });
  assertNoError(error, "Impossible de mettre a jour le role.");
}

export async function setAdminUserAdmin(userId: string, isAdmin: boolean) {
  const { error } = await supabase.rpc("admin_set_user_admin", {
    p_user_id: userId,
    p_is_admin: isAdmin,
  });
  assertNoError(error, "Impossible de mettre a jour les droits admin.");
}

export async function listAdminCourses(params?: {
  limit?: number;
  offset?: number;
  search?: string;
}): Promise<AdminCourseRow[]> {
  const { data, error } = await supabase.rpc("admin_list_courses", {
    p_limit: params?.limit ?? 240,
    p_offset: params?.offset ?? 0,
    p_search: params?.search?.trim() || null,
  });
  assertNoError(error, "Impossible de charger les cours.");
  return ((data as any[]) || []).map((r) => ({
    id: String(r.id),
    title: String(r.title || "Sans titre"),
    level: r.level ?? null,
    subject: r.subject ?? null,
    published: !!r.published,
    ownerId: String(r.owner_id || ""),
    ownerName: String(r.owner_name || "Sans nom"),
    updatedAtMs: r.updated_at_ms ?? null,
  }));
}

export async function setAdminCoursePublished(courseId: string, published: boolean) {
  const { error } = await supabase.rpc("admin_set_course_published", {
    p_course_id: courseId,
    p_published: published,
  });
  assertNoError(error, "Impossible de modifier la publication du cours.");
}

export async function listAdminBooks(params?: {
  limit?: number;
  offset?: number;
  search?: string;
}): Promise<AdminBookRow[]> {
  const { data, error } = await supabase.rpc("admin_list_books", {
    p_limit: params?.limit ?? 240,
    p_offset: params?.offset ?? 0,
    p_search: params?.search?.trim() || null,
  });
  assertNoError(error, "Impossible de charger les documents.");
  return ((data as any[]) || []).map((r) => ({
    id: String(r.id),
    title: String(r.title || "Sans titre"),
    level: r.level ?? null,
    subject: r.subject ?? null,
    price: r.price == null ? null : Number(r.price),
    published: !!r.published,
    ownerId: String(r.owner_id || ""),
    ownerName: String(r.owner_name || "Sans nom"),
    updatedAtMs: r.updated_at_ms ?? null,
  }));
}

export async function setAdminBookPublished(bookId: string, published: boolean) {
  const { error } = await supabase.rpc("admin_set_book_published", {
    p_book_id: bookId,
    p_published: published,
  });
  assertNoError(error, "Impossible de modifier la publication du document.");
}

export async function listAdminLives(params?: {
  limit?: number;
  offset?: number;
  search?: string;
}): Promise<AdminLiveRow[]> {
  const { data, error } = await supabase.rpc("admin_list_lives", {
    p_limit: params?.limit ?? 240,
    p_offset: params?.offset ?? 0,
    p_search: params?.search?.trim() || null,
  });
  assertNoError(error, "Impossible de charger les lives.");
  return ((data as any[]) || []).map((r) => ({
    id: String(r.id),
    title: String(r.title || "Sans titre"),
    status: r.status === "live" || r.status === "ended" ? r.status : "scheduled",
    ownerId: String(r.owner_id || ""),
    ownerName: String(r.owner_name || "Sans nom"),
    startAtMs: r.start_at_ms ?? null,
    updatedAtMs: r.updated_at_ms ?? null,
  }));
}

export async function setAdminLiveStatus(liveId: string, status: "scheduled" | "live" | "ended") {
  const { error } = await supabase.rpc("admin_set_live_status", {
    p_live_id: liveId,
    p_status: status,
  });
  assertNoError(error, "Impossible de modifier le statut du live.");
}

export async function listAdminQuizzes(params?: {
  limit?: number;
  offset?: number;
  search?: string;
}): Promise<AdminQuizRow[]> {
  const { data, error } = await supabase.rpc("admin_list_quizzes", {
    p_limit: params?.limit ?? 240,
    p_offset: params?.offset ?? 0,
    p_search: params?.search?.trim() || null,
  });
  assertNoError(error, "Impossible de charger les quiz.");
  return ((data as any[]) || []).map((r) => ({
    id: String(r.id),
    title: String(r.title || "Sans titre"),
    scope: r.scope === "lesson" ? "lesson" : "standalone",
    level: r.level ?? null,
    subject: r.subject ?? null,
    published: !!r.published,
    ownerId: String(r.owner_id || ""),
    ownerName: String(r.owner_name || "Sans nom"),
    courseTitle: r.course_title ?? null,
    chapterTitle: r.chapter_title ?? null,
    updatedAtMs: r.updated_at_ms ?? null,
    attempts: Number(r.attempts || 0),
  }));
}

export async function setAdminQuizPublished(quizId: string, published: boolean) {
  const { error } = await supabase.rpc("admin_set_quiz_published", {
    p_quiz_id: quizId,
    p_published: published,
  });
  assertNoError(error, "Impossible de modifier la publication du quiz.");
}

export async function listAdminMessages(params?: {
  limit?: number;
  offset?: number;
  search?: string;
}): Promise<AdminMessageRow[]> {
  const { data, error } = await supabase.rpc("admin_list_messages", {
    p_limit: params?.limit ?? 300,
    p_offset: params?.offset ?? 0,
    p_search: params?.search?.trim() || null,
  });
  assertNoError(error, "Impossible de charger les messages.");
  return ((data as any[]) || []).map((r) => ({
    id: String(r.id),
    teacherName: r.teacher_name ?? null,
    studentName: r.student_name ?? null,
    courseTitle: r.course_title ?? null,
    lastText: r.last_text ?? null,
    lastAtMs: r.last_at_ms ?? null,
    messageCount: Number(r.message_count || 0),
  }));
}

export async function getAdminPortalSettings(): Promise<AdminPortalSettings> {
  const { data, error } = await supabase.rpc("admin_get_portal_settings");
  assertNoError(error, "Impossible de charger les reglages du portail.");
  const row = (((data as any[]) || [])[0] || {}) as any;
  return {
    teacherPortalOpen: !!row.teacher_portal_open,
    teacherPortalMessage: row.teacher_portal_message ?? null,
    updatedAtMs: row.updated_at_ms ?? null,
  };
}

export async function updateAdminPortalSettings(input: { teacherPortalOpen: boolean; teacherPortalMessage?: string | null }) {
  const { error } = await supabase.rpc("admin_update_portal_settings", {
    p_open: input.teacherPortalOpen,
    p_message: input.teacherPortalMessage ?? null,
  });
  assertNoError(error, "Impossible de mettre a jour les reglages du portail.");
}
