import { supabase } from "@/lib/supabase";

type UsageRow = {
  day: string;
  time_spent_ms?: number | null;
  courses_viewed?: number | null;
  lessons_viewed?: number | null;
  documents_opened?: number | null;
  lives_joined?: number | null;
};

type UsageSummary = {
  timeSpentMs: number;
  coursesViewed: number;
  lessonsViewed: number;
  documentsOpened: number;
  livesJoined: number;
  quizAttempts: number;
};

function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function toNumber(v: unknown) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

async function upsertUsage(userId: string, patch: Partial<UsageSummary>) {
  const day = dayKey();
  const { data } = await supabase
    .from("student_usage_daily")
    .select("day,time_spent_ms,courses_viewed,lessons_viewed,documents_opened,lives_joined")
    .eq("user_id", userId)
    .eq("day", day)
    .maybeSingle();

  const row = (data as UsageRow | null) || null;
  const next = {
    user_id: userId,
    day,
    time_spent_ms: toNumber(row?.time_spent_ms) + toNumber(patch.timeSpentMs),
    courses_viewed: toNumber(row?.courses_viewed) + toNumber(patch.coursesViewed),
    lessons_viewed: toNumber(row?.lessons_viewed) + toNumber(patch.lessonsViewed),
    documents_opened: toNumber(row?.documents_opened) + toNumber(patch.documentsOpened),
    lives_joined: toNumber(row?.lives_joined) + toNumber(patch.livesJoined),
  };

  await supabase.from("student_usage_daily").upsert(next, { onConflict: "user_id,day" });
}

export async function addTimeSpent(userId: string, deltaMs: number) {
  if (!userId) return;
  if (!Number.isFinite(deltaMs) || deltaMs < 1000) return;
  await upsertUsage(userId, { timeSpentMs: Math.round(deltaMs) });
}

export async function addCourseView(userId: string) {
  if (!userId) return;
  await upsertUsage(userId, { coursesViewed: 1 });
}

export async function addLessonView(userId: string) {
  if (!userId) return;
  await upsertUsage(userId, { lessonsViewed: 1 });
}

export async function addDocumentOpen(userId: string) {
  if (!userId) return;
  await upsertUsage(userId, { documentsOpened: 1 });
}

export async function addLiveJoin(userId: string) {
  if (!userId) return;
  await upsertUsage(userId, { livesJoined: 1 });
}

export async function getUsageSummary(userId: string, days = 7): Promise<UsageSummary> {
  if (!userId) {
    return { timeSpentMs: 0, coursesViewed: 0, lessonsViewed: 0, documentsOpened: 0, livesJoined: 0, quizAttempts: 0 };
  }
  const since = new Date();
  since.setDate(since.getDate() - Math.max(0, days - 1));
  const sinceKey = dayKey(since);
  const sinceMs = since.getTime();

  const [{ data }, quizCount] = await Promise.all([
    supabase
      .from("student_usage_daily")
      .select("day,time_spent_ms,courses_viewed,lessons_viewed,documents_opened,lives_joined")
      .eq("user_id", userId)
      .gte("day", sinceKey),
    supabase
      .from("quiz_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at_ms", sinceMs),
  ]);

  const rows = (data as UsageRow[] | null) || [];
  const base = rows.reduce(
    (acc, row) => ({
      timeSpentMs: acc.timeSpentMs + toNumber(row.time_spent_ms),
      coursesViewed: acc.coursesViewed + toNumber(row.courses_viewed),
      lessonsViewed: acc.lessonsViewed + toNumber(row.lessons_viewed),
      documentsOpened: acc.documentsOpened + toNumber(row.documents_opened),
      livesJoined: acc.livesJoined + toNumber(row.lives_joined),
    }),
    { timeSpentMs: 0, coursesViewed: 0, lessonsViewed: 0, documentsOpened: 0, livesJoined: 0 }
  );
  const quizAttempts = quizCount?.error ? 0 : Number(quizCount?.count || 0);
  return { ...base, quizAttempts };
}
