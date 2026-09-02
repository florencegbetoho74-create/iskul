// src/storage/courses.ts - Supabase implementation
import { supabase } from "@/lib/supabase";
import {
  countryFilter,
  gradeLevelFilter,
  pageRange,
  safePage,
  safeUuid,
  searchFilter,
} from "@/lib/contentFilter";
import type { Course, Chapter, LangKey } from "@/types/course";

type CourseRow = {
  id: string;
  title: string;
  description?: string | null;
  level: string;
  subject: string;
  country_code?: string | null;
  grade_level_id?: string | null;
  subject_id?: string | null;
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
  countryCode: row.country_code ?? null,
  gradeLevelId: row.grade_level_id ?? null,
  subjectId: row.subject_id ?? null,
  coverUrl: row.cover_url ?? null,
  chapters: Array.isArray(row.chapters) ? row.chapters.map(mapChapter) : [],
  published: !!row.published,
  ownerId: row.owner_id ?? "",
  ownerName: row.owner_name ?? undefined,
  createdAtMs: row.created_at_ms ?? Date.now(),
  updatedAtMs: row.updated_at_ms ?? Date.now(),
});

const courseSelect =
  "id,title,description,level,subject,country_code,grade_level_id,subject_id," +
  "cover_url,published,owner_id,owner_name,created_at_ms,updated_at_ms," +
  "chapters ( id, course_id, title, order_index, video_url, video_by_lang )";

export async function createCourse(input: Partial<Course>): Promise<Course> {
  const now = Date.now();
  const payload = {
    title: input.title ?? "",
    description: input.description ?? null,
    level: input.level ?? "",
    subject: input.subject ?? "",
    country_code: input.countryCode ?? null,
    grade_level_id: input.gradeLevelId ?? null,
    subject_id: input.subjectId ?? null,
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
  if (patch.countryCode !== undefined) payload.country_code = patch.countryCode ?? null;
  if (patch.gradeLevelId !== undefined) payload.grade_level_id = patch.gradeLevelId ?? null;
  if (patch.subjectId !== undefined) payload.subject_id = patch.subjectId ?? null;
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

export type ContentScopeQuery = {
  countryCode?: string | null;
  gradeLevelId?: string | null;
  subjectId?: string | null;
  search?: string;
  publishedOnly?: boolean;
  limit?: number;
  offset?: number;
};

const SEARCH_COLUMNS = ["title", "description", "subject", "level"] as const;

/**
 * Cours du perimetre de l'eleve, filtres et pagines cote serveur.
 *
 * L'ancienne approche telechargeait les 120 derniers cours toutes classes
 * confondues puis triait en JavaScript : un eleve de 6e payait le transfert des
 * cours de terminale.
 */
export async function listCoursesScoped(query: ContentScopeQuery = {}): Promise<Course[]> {
  const page = safePage(query);
  let q = supabase.from("courses").select(courseSelect);

  if (query.publishedOnly !== false) q = q.eq("published", true);

  const country = countryFilter(query.countryCode);
  if (country) q = q.or(country);

  const grade = gradeLevelFilter(query.gradeLevelId);
  if (grade) q = q.or(grade);

  const subjectId = safeUuid(query.subjectId);
  if (subjectId) q = q.eq("subject_id", subjectId);

  const search = query.search ? searchFilter(query.search, SEARCH_COLUMNS) : null;
  if (search) q = q.or(search);

  const [from, to] = pageRange(page);
  const { data, error } = await q
    .order("updated_at_ms", { ascending: false })
    .order("order_index", { foreignTable: "chapters", ascending: true })
    .range(from, to);

  if (error || !data) return [];
  return (data as unknown as CourseRow[]).map(mapCourse);
}

/** Un cours est dans le perimetre s'il vise cette classe ou tous les niveaux. */
function rowMatchesScope(row: any, query: ContentScopeQuery): boolean {
  if (!row) return false;
  const grade = safeUuid(query.gradeLevelId);
  if (grade) {
    const rowGrade = row.grade_level_id ?? null;
    if (rowGrade && rowGrade !== grade) return false;
  }
  return true;
}

/**
 * Ecoute les cours du perimetre.
 *
 * L'abonnement precedent rechargeait la liste entiere a chaque ecriture sur
 * `courses` ou `chapters`, ou qu'elle vienne : un professeur enregistrant un
 * chapitre declenchait un rechargement sur tous les appareils connectes. Ici on
 * ne recharge que si la ligne modifiee concerne le perimetre, et on regroupe
 * les rafales.
 */
export function watchCoursesScoped(
  query: ContentScopeQuery,
  cb: (rows: Course[]) => void
) {
  let active = true;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const fetchOnce = async () => {
    const rows = await listCoursesScoped(query);
    if (active) cb(rows);
  };

  const scheduleRefetch = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fetchOnce();
    }, 400);
  };

  fetchOnce();

  const channelKey = [
    query.countryCode || "all",
    query.gradeLevelId || "all",
    query.subjectId || "all",
  ].join(":");

  const channel = supabase
    .channel(`courses-scoped-${channelKey}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "courses" }, (payload) => {
      const row = (payload.new as any) ?? (payload.old as any);
      if (rowMatchesScope(row, query)) scheduleRefetch();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "chapters" }, () => {
      // Un chapitre ne porte pas la classe : on remonte au cours via un
      // rechargement groupe plutot que par une requete supplementaire.
      scheduleRefetch();
    })
    .subscribe();

  return () => {
    active = false;
    if (timer) clearTimeout(timer);
    supabase.removeChannel(channel);
  };
}
