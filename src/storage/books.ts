import { supabase } from "@/lib/supabase";
import type { Book } from "@/types/book";

type BookRow = {
  id: string;
  title: string;
  subject?: string | null;
  level?: string | null;
  price?: number | string | null;
  cover_url?: string | null;
  file_url: string;
  owner_id: string;
  owner_name?: string | null;
  published?: boolean | null;
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
    price: row.price != null ? Number(row.price) : undefined,
    coverUrl: toPublicUrl(row.cover_url) ?? null,
    fileUrl: toPublicUrl(row.file_url) || "",
    ownerId: row.owner_id,
    ownerName: row.owner_name ?? undefined,
    published: row.published ?? true,
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
      price: payload.price ?? 0,
      cover_url: payload.coverUrl ?? null,
      file_url: payload.fileUrl,
      owner_id: payload.ownerId,
      owner_name: payload.ownerName ?? null,
      published: payload.published ?? true,
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
  if (patch.price !== undefined) payload.price = patch.price ?? 0;
  if (patch.coverUrl !== undefined) payload.cover_url = patch.coverUrl ?? null;
  if (patch.fileUrl !== undefined) payload.file_url = patch.fileUrl;
  if (patch.published !== undefined) payload.published = patch.published;
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
