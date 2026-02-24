import { supabase } from "@/lib/supabase";

export type LessonNote = {
  id: string;
  userId: string;
  courseId: string;
  lessonId: string;
  t: number;
  text: string;
  createdAt: number;
};

function mapRow(row: any): LessonNote {
  return {
    id: row.id,
    userId: row.user_id,
    courseId: row.course_id,
    lessonId: row.chapter_id,
    t: row.t_sec,
    text: row.text,
    createdAt: row.created_at_ms ?? Date.now(),
  };
}

export async function addNote(
  userId: string,
  courseId: string,
  lessonId: string,
  t: number,
  text: string
): Promise<LessonNote> {
  const now = Date.now();
  const { data, error } = await supabase
    .from("lesson_notes")
    .insert({
      user_id: userId,
      course_id: courseId,
      chapter_id: lessonId,
      t_sec: Math.max(0, Math.floor(t)),
      text,
      created_at_ms: now,
    })
    .select("*")
    .single();
  if (error || !data) throw error || new Error("Add note failed.");
  return mapRow(data);
}

export async function listNotes(
  userId: string,
  courseId: string,
  lessonId: string
): Promise<LessonNote[]> {
  const { data, error } = await supabase
    .from("lesson_notes")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .eq("chapter_id", lessonId)
    .order("created_at_ms", { ascending: true });
  if (error || !data) return [];
  return data.map(mapRow);
}

export function watchNotes(
  userId: string,
  courseId: string,
  lessonId: string,
  cb: (rows: LessonNote[]) => void
) {
  let active = true;
  const fetchOnce = async () => {
    const rows = await listNotes(userId, courseId, lessonId);
    if (active) cb(rows);
  };
  fetchOnce();
  const channel = supabase
    .channel(`notes-${userId}-${lessonId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "lesson_notes",
        filter: `user_id=eq.${userId}`,
      },
      () => fetchOnce()
    )
    .subscribe();
  return () => {
    active = false;
    supabase.removeChannel(channel);
  };
}

export async function deleteNote(
  _userId: string,
  _courseId: string,
  _lessonId: string,
  noteId: string
): Promise<void> {
  const { error } = await supabase.from("lesson_notes").delete().eq("id", noteId);
  if (error) throw error;
}
