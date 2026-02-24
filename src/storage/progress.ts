import { supabase, SUPABASE_READY } from "@/lib/supabase";

export type LessonProgress = {
  id: string;
  userId: string;
  courseId: string;
  lessonId: string;
  watchedSec: number;
  durationSec?: number;
  updatedAt: number;
};

function mapRow(row: any): LessonProgress {
  return {
    id: row.id,
    userId: row.user_id,
    courseId: row.course_id,
    lessonId: row.chapter_id,
    watchedSec: row.watched_sec ?? 0,
    durationSec: row.duration_sec ?? undefined,
    updatedAt: row.updated_at_ms ?? Date.now(),
  };
}

export async function updateLessonProgress(
  userId: string,
  courseId: string,
  lessonId: string,
  patch: { watchedSec?: number; durationSec?: number }
): Promise<void> {
  if (!SUPABASE_READY) return;
  const now = Date.now();
  const payload = {
    user_id: userId,
    course_id: courseId,
    chapter_id: lessonId,
    watched_sec: Math.max(0, Math.floor(patch.watchedSec ?? 0)),
    duration_sec: patch.durationSec != null ? Math.max(0, Math.floor(patch.durationSec)) : null,
    updated_at_ms: now,
  };
  const { error } = await supabase
    .from("lesson_progress")
    .upsert(payload, { onConflict: "user_id,course_id,chapter_id" });
  if (error) throw error;
}

export async function getLessonProgress(
  userId: string,
  courseId: string,
  lessonId: string
): Promise<LessonProgress | null> {
  const { data, error } = await supabase
    .from("lesson_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .eq("chapter_id", lessonId)
    .maybeSingle();
  if (error || !data) return null;
  return mapRow(data);
}

export async function listRecentProgress(
  userId: string,
  topN = 20
): Promise<LessonProgress[]> {
  const { data, error } = await supabase
    .from("lesson_progress")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at_ms", { ascending: false })
    .limit(topN);
  if (error || !data) return [];
  return data.map(mapRow);
}

export function watchRecentProgress(
  userId: string,
  cb: (rows: LessonProgress[]) => void,
  topN = 20
) {
  let active = true;
  const fetchOnce = async () => {
    const rows = await listRecentProgress(userId, topN);
    if (active) cb(rows);
  };
  fetchOnce();
  const channel = supabase
    .channel(`progress-${userId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "lesson_progress", filter: `user_id=eq.${userId}` }, () =>
      fetchOnce()
    )
    .subscribe();
  return () => {
    active = false;
    supabase.removeChannel(channel);
  };
}
