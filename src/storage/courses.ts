// src/storage/courses.ts - Supabase implementation
import { supabase } from "@/lib/supabase";
import type { Course, Chapter, LangKey } from "@/types/course";

type CourseRow = {
  id: string;
  title: string;
  description?: string | null;
  level: string;
  subject: string;
  cover_url?: string | null;
  published: boolean;
  owner_id: string;
  owner_name?: string | null;
  created_at_ms?: number | null;
  updated_at_ms?: number | null;
  chapters?: ChapterRow[] | null;
};

type ChapterRow = {
  id: string;
  course_id: string;
  title: string;
  order_index?: number | null;
  video_url?: string | null;
  video_by_lang?: Partial<Record<LangKey, string>> | null;
};

const mapChapter = (row: ChapterRow): Chapter => ({
  id: row.id,
  title: row.title,
  order: row.order_index ?? undefined,
  videoUrl: row.video_url ?? undefined,
  videoByLang: row.video_by_lang ?? undefined,
});

const mapCourse = (row: CourseRow): Course => ({
  id: row.id,
  title: row.title ?? "",
  description: row.description ?? undefined,
  level: row.level ?? "",
  subject: row.subject ?? "",
  coverUrl: row.cover_url ?? null,
  chapters: Array.isArray(row.chapters) ? row.chapters.map(mapChapter) : [],
  published: !!row.published,
  ownerId: row.owner_id ?? "",
  ownerName: row.owner_name ?? undefined,
  createdAtMs: row.created_at_ms ?? Date.now(),
  updatedAtMs: row.updated_at_ms ?? Date.now(),
});

const courseSelect =
  "id,title,description,level,subject,cover_url,published,owner_id,owner_name,created_at_ms,updated_at_ms," +
  "chapters ( id, course_id, title, order_index, video_url, video_by_lang )";

export async function createCourse(input: Partial<Course>): Promise<Course> {
  const now = Date.now();
  const payload = {
    title: input.title ?? "",
    description: input.description ?? null,
    level: input.level ?? "",
    subject: input.subject ?? "",
    cover_url: input.coverUrl ?? null,
    published: !!input.published,
    owner_id: input.ownerId!,
    owner_name: input.ownerName ?? null,
    created_at_ms: now,
    updated_at_ms: now,
  };
  const { data, error } = await supabase.from("courses").insert(payload).select(courseSelect).single();
  if (error || !data) throw error || new Error("Create course failed.");
  return mapCourse(data as unknown as CourseRow);
}

export async function updateCourse(id: string, patch: Partial<Course>) {
  const payload: Record<string, any> = {
    updated_at_ms: Date.now(),
  };
  if (patch.title !== undefined) payload.title = patch.title;
  if (patch.description !== undefined) payload.description = patch.description ?? null;
  if (patch.level !== undefined) payload.level = patch.level;
  if (patch.subject !== undefined) payload.subject = patch.subject;
  if (patch.coverUrl !== undefined) payload.cover_url = patch.coverUrl ?? null;
  if (patch.published !== undefined) payload.published = patch.published;
  if (patch.ownerName !== undefined) payload.owner_name = patch.ownerName ?? null;

  const { data, error } = await supabase
    .from("courses")
    .update(payload)
    .eq("id", id)
    .select(courseSelect)
    .single();
  if (error || !data) throw error || new Error("Update course failed.");
  return mapCourse(data as unknown as CourseRow);
}

export async function deleteCourse(id: string) {
  const { error } = await supabase.from("courses").delete().eq("id", id);
  if (error) throw error;
}

export async function getCourse(id: string): Promise<Course | null> {
  const { data, error } = await supabase.from("courses").select(courseSelect).eq("id", id).single();
  if (error || !data) return null;
  return mapCourse(data as unknown as CourseRow);
}

async function listCoursesOrdered(topN = 50): Promise<Course[]> {
  const { data, error } = await supabase
    .from("courses")
    .select(courseSelect)
    .order("updated_at_ms", { ascending: false })
    .order("order_index", { foreignTable: "chapters", ascending: true })
    .limit(topN);
  if (error || !data) return [];
  return (data as unknown as CourseRow[]).map(mapCourse);
}

export function watchCoursesOrdered(cb: (rows: Course[]) => void, topN = 50) {
  let active = true;
  const fetchOnce = async () => {
    const rows = await listCoursesOrdered(topN);
    if (active) cb(rows);
  };
  fetchOnce();

  const channel = supabase
    .channel("courses-watch")
    .on("postgres_changes", { event: "*", schema: "public", table: "courses" }, () => fetchOnce())
    .on("postgres_changes", { event: "*", schema: "public", table: "chapters" }, () => fetchOnce())
    .subscribe();

  return () => {
    active = false;
    supabase.removeChannel(channel);
  };
}

export function watchByOwner(ownerId: string, cb: (rows: Course[]) => void) {
  let active = true;
  const fetchOnce = async () => {
    const { data } = await supabase
      .from("courses")
      .select(courseSelect)
      .eq("owner_id", ownerId)
      .order("updated_at_ms", { ascending: false })
      .order("order_index", { foreignTable: "chapters", ascending: true });
    const rows = (data as CourseRow[] | null) || [];
    if (active) cb(rows.map(mapCourse));
  };
  fetchOnce();

  const channel = supabase
    .channel(`courses-owner-${ownerId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "courses", filter: `owner_id=eq.${ownerId}` }, () => fetchOnce())
    .on("postgres_changes", { event: "*", schema: "public", table: "chapters" }, () => fetchOnce())
    .subscribe();
  return () => {
    active = false;
    supabase.removeChannel(channel);
  };
}

export async function listByOwner(ownerId: string): Promise<Course[]> {
  const { data, error } = await supabase
    .from("courses")
    .select(courseSelect)
    .eq("owner_id", ownerId)
    .order("updated_at_ms", { ascending: false })
    .order("order_index", { foreignTable: "chapters", ascending: true });
  if (error || !data) return [];
  return (data as unknown as CourseRow[]).map(mapCourse);
}

export async function addChapter(
  courseId: string,
  input: {
    title: string;
    videoUrl?: string | null;
    videoByLang?: Partial<Record<LangKey, string>>;
    order?: number;
  }
) {
  const cleanByLang: Partial<Record<LangKey, string>> = {};
  if (input.videoByLang) {
    Object.entries(input.videoByLang).forEach(([k, v]) => {
      const val = String(v || "").trim();
      if (val) cleanByLang[k as LangKey] = val;
    });
  }
  const { data: last } = await supabase
    .from("chapters")
    .select("order_index")
    .eq("course_id", courseId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = input.order ?? ((last as any)?.order_index ?? 0) + 1;
  const payload = {
    course_id: courseId,
    title: input.title,
    order_index: nextOrder,
    video_url: input.videoUrl ?? null,
    video_by_lang: Object.keys(cleanByLang).length ? cleanByLang : null,
  };
  const { data, error } = await supabase.from("chapters").insert(payload).select("*").single();
  if (error || !data) throw error || new Error("Add chapter failed.");
  return mapChapter(data as ChapterRow);
}

export async function deleteChapter(courseId: string, chapterId: string) {
  const { error } = await supabase.from("chapters").delete().eq("id", chapterId).eq("course_id", courseId);
  if (error) throw error;
}
