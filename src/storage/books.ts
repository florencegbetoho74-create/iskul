import { supabase } from "@/lib/supabase";
import {
  countryFilter,
  gradeLevelFilter,
  pageRange,
  safePage,
  safeUuid,
  searchFilter,
} from "@/lib/contentFilter";
import { parseContentStatus } from "@/lib/contentStatus";
import type { Book } from "@/types/book";

type BookRow = {
  id: string;
  title: string;
  subject?: string | null;
  level?: string | null;
  country_code?: string | null;
  grade_level_id?: string | null;
  subject_id?: string | null;
  document_type_id?: string | null;
  exam_name?: string | null;
  exam_year?: number | null;
  exam_session?: string | null;
  author?: string | null;
  price?: number | string | null;
  cover_url?: string | null;
  file_url: string;
  owner_id: string;
  owner_name?: string | null;
  published?: boolean | null;
  status?: string | null;
  review_note?: string | null;
  created_at_ms?: number | null;
  updated_at_ms?: number | null;
};

const STORAGE_BUCKET =
  (process.env.EXPO_PUBLIC_SUPABASE_BUCKET ||
    process.env.NEXT_PUBLIC_SUPABASE_BUCKET ||
    "iskul").trim();

function toPublicUrl(raw?: string | null): string | null {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const cleaned = raw.replace(/^\/+/, "");
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(cleaned);
  return data?.publicUrl || raw;
}

function mapBook(row: BookRow): Book {
  return {
    id: row.id,
    title: row.title ?? "",
    subject: row.subject ?? undefined,
    level: row.level ?? undefined,
    countryCode: row.country_code ?? null,
    gradeLevelId: row.grade_level_id ?? null,
    subjectId: row.subject_id ?? null,
    documentTypeId: row.document_type_id ?? null,
    examName: row.exam_name ?? null,
    examYear: row.exam_year ?? null,
    examSession: row.exam_session ?? null,
    author: row.author ?? null,
    price: row.price != null ? Number(row.price) : undefined,
    coverUrl: toPublicUrl(row.cover_url) ?? null,
    fileUrl: toPublicUrl(row.file_url) || "",
    ownerId: row.owner_id,
    ownerName: row.owner_name ?? undefined,
    published: row.published ?? false,
    status: parseContentStatus(row.status),
    reviewNote: row.review_note ?? null,
    createdAtMs: row.created_at_ms ?? row.updated_at_ms ?? Date.now(),
    updatedAtMs: row.updated_at_ms ?? row.created_at_ms ?? Date.now(),
  };
}

export async function addBook(payload: Omit<Book, "id" | "createdAt" | "updatedAt" | "updatedAtMs">) {
  const now = Date.now();
  const { data, error } = await supabase
    .from("books")
    .insert({
      title: payload.title,
      subject: payload.subject ?? null,
      level: payload.level ?? null,
      country_code: payload.countryCode ?? null,
      grade_level_id: payload.gradeLevelId ?? null,
      subject_id: payload.subjectId ?? null,
      document_type_id: payload.documentTypeId ?? null,
      exam_name: payload.examName ?? null,
      exam_year: payload.examYear ?? null,
      exam_session: payload.examSession ?? null,
      author: payload.author ?? null,
      price: payload.price ?? 0,
      cover_url: payload.coverUrl ?? null,
      file_url: payload.fileUrl,
      owner_id: payload.ownerId,
      owner_name: payload.ownerName ?? null,
      created_at_ms: now,
      updated_at_ms: now,
    })
    .select("*")
    .single();
  if (error || !data) throw error || new Error("Add book failed.");
  return mapBook(data as BookRow);
}

export async function updateBook(id: string, patch: Partial<Book>) {
  const payload: Record<string, any> = { updated_at_ms: Date.now() };
  if (patch.title !== undefined) payload.title = patch.title;
  if (patch.subject !== undefined) payload.subject = patch.subject ?? null;
  if (patch.level !== undefined) payload.level = patch.level ?? null;
  if (patch.countryCode !== undefined) payload.country_code = patch.countryCode ?? null;
  if (patch.gradeLevelId !== undefined) payload.grade_level_id = patch.gradeLevelId ?? null;
  if (patch.subjectId !== undefined) payload.subject_id = patch.subjectId ?? null;
  if (patch.documentTypeId !== undefined)
    payload.document_type_id = patch.documentTypeId ?? null;
  if (patch.examName !== undefined) payload.exam_name = patch.examName ?? null;
  if (patch.examYear !== undefined) payload.exam_year = patch.examYear ?? null;
  if (patch.examSession !== undefined) payload.exam_session = patch.examSession ?? null;
  if (patch.author !== undefined) payload.author = patch.author ?? null;
  if (patch.price !== undefined) payload.price = patch.price ?? 0;
  if (patch.coverUrl !== undefined) payload.cover_url = patch.coverUrl ?? null;
  if (patch.fileUrl !== undefined) payload.file_url = patch.fileUrl;
  const { error } = await supabase.from("books").update(payload).eq("id", id);
  if (error) throw error;
}

export async function getBook(id: string): Promise<Book | null> {
  const { data, error } = await supabase.from("books").select("*").eq("id", id).single();
  if (error || !data) return null;
  return mapBook(data as BookRow);
}

export async function deleteBook(id: string) {
  const { error } = await supabase.from("books").delete().eq("id", id);
  if (error) throw error;
}

export function watchBooksOrdered(cb: (rows: Book[]) => void, limitN = 100) {
  let active = true;
  const fetchOnce = async () => {
    const { data } = await supabase
      .from("books")
      .select("*")
      .order("updated_at_ms", { ascending: false })
      .limit(limitN);
    if (active) cb(((data as BookRow[]) || []).map(mapBook));
  };
  fetchOnce();
  const channel = supabase
    .channel("books-watch")
    .on("postgres_changes", { event: "*", schema: "public", table: "books" }, () => fetchOnce())
    .subscribe();
  return () => {
    active = false;
    supabase.removeChannel(channel);
  };
}

export async function listBooksByOwner(ownerId: string): Promise<Book[]> {
  const { data, error } = await supabase
    .from("books")
    .select("*")
    .eq("owner_id", ownerId)
    .order("updated_at_ms", { ascending: false });
  if (error || !data) return [];
  return (data as BookRow[]).map(mapBook);
}

export type BookScopeQuery = {
  countryCode?: string | null;
  gradeLevelId?: string | null;
  subjectId?: string | null;
  documentTypeId?: string | null;
  search?: string;
  limit?: number;
  offset?: number;
};

const BOOK_SEARCH_COLUMNS = [
  "title",
  "subject",
  "level",
  "owner_name",
  "author",
  "exam_name",
] as const;

/** Documents du perimetre de l'eleve, filtres et pagines cote serveur. */
export async function listBooksScoped(query: BookScopeQuery = {}): Promise<Book[]> {
  const page = safePage(query);
  let q = supabase.from("books").select("*").eq("published", true);

  const country = countryFilter(query.countryCode);
  if (country) q = q.or(country);

  const grade = gradeLevelFilter(query.gradeLevelId);
  if (grade) q = q.or(grade);

  const subjectId = safeUuid(query.subjectId);
  if (subjectId) q = q.eq("subject_id", subjectId);

  const documentTypeId = safeUuid(query.documentTypeId);
  if (documentTypeId) q = q.eq("document_type_id", documentTypeId);

  const search = query.search ? searchFilter(query.search, BOOK_SEARCH_COLUMNS) : null;
  if (search) q = q.or(search);

  const [from, to] = pageRange(page);
  const { data, error } = await q.order("updated_at_ms", { ascending: false }).range(from, to);
  if (error || !data) return [];
  return (data as BookRow[]).map(mapBook);
}

/**
 * Ecoute les documents du perimetre, avec regroupement des rafales.
 * L'ancien abonnement rechargeait 200 documents a chaque ecriture, d'ou qu'elle
 * vienne.
 */
export function watchBooksScoped(query: BookScopeQuery, cb: (rows: Book[]) => void) {
  let active = true;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const fetchOnce = async () => {
    const rows = await listBooksScoped(query);
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

  const grade = safeUuid(query.gradeLevelId);
  const channelKey = [query.countryCode || "all", grade || "all"].join(":");

  const channel = supabase
    .channel(`books-scoped-${channelKey}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "books" }, (payload) => {
      const row = (payload.new as any) ?? (payload.old as any);
      const rowGrade = row?.grade_level_id ?? null;
      // Un document "tous niveaux" concerne aussi cet eleve.
      if (!grade || !rowGrade || rowGrade === grade) scheduleRefetch();
    })
    .subscribe();

  return () => {
    active = false;
    if (timer) clearTimeout(timer);
    supabase.removeChannel(channel);
  };
}
