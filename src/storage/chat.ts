// @/storage/chat.ts - Supabase implementation
import { supabase } from "@/lib/supabase";
import type { ChatAttachment, Message, Thread } from "@/types/chat";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(value: string, label: string) {
  const v = String(value || "").trim();
  if (!v || !UUID_RE.test(v)) {
    throw new Error(`Identifiant ${label} invalide.`);
  }
  return v;
}

/** Create deterministic thread id to avoid duplicates */
function makeThreadId(teacherId: string, studentId: string, courseId?: string | null) {
  const pair = [teacherId, studentId].sort().join("__");
  const c = courseId?.replace(/[^\w\-]/g, "_") || "none";
  const raw = `${pair}__${c}`;
  return `th_${raw.replace(/[^\w\-]/g, "_").slice(0, 250)}`;
}

function mapThread(row: any): Thread {
  return {
    id: row.id,
    teacherId: row.teacher_id,
    teacherName: row.teacher_name ?? "",
    studentId: row.student_id,
    studentName: row.student_name ?? "",
    participants: row.participants ?? [row.teacher_id, row.student_id],
    courseId: row.course_id ?? null,
    courseTitle: row.course_title ?? null,
    createdAtMs: row.created_at_ms ?? Date.now(),
    lastAtMs: row.last_at_ms ?? Date.now(),
    lastFromId: row.last_from_id ?? "",
    lastText: row.last_text ?? null,
    lastReadAtMs: row.last_read_at_ms ?? {},
  };
}

function mapMessage(row: any): Message {
  return {
    id: row.id,
    fromId: row.from_id,
    text: row.text ?? null,
    attachments: row.attachments ?? [],
    atMs: row.at_ms ?? Date.now(),
  };
}

export function hasUnread(t: Thread, userId: string) {
  const lastRead = t.lastReadAtMs?.[userId] ?? 0;
  return !!(t.lastFromId && t.lastFromId !== userId && (t.lastAtMs ?? 0) > lastRead);
}

export async function startThread(params: {
  teacherId: string;
  teacherName?: string;
  studentId: string;
  studentName?: string;
  courseId?: string | null;
  courseTitle?: string | null;
}): Promise<Thread> {
  const teacherId = assertUuid(params.teacherId, "enseignant");
  const studentId = assertUuid(params.studentId, "eleve");
  const courseId = params.courseId?.trim() || null;
  const courseTitle = params.courseTitle?.trim() || null;
  const id = makeThreadId(teacherId, studentId, courseId);
  const { data } = await supabase.from("chat_threads").select("*").eq("id", id).maybeSingle();
  if (!data) {
    const now = Date.now();
    const payload = {
      id,
      teacher_id: teacherId,
      teacher_name: params.teacherName ?? "",
      student_id: studentId,
      student_name: params.studentName ?? "",
      participants: [teacherId, studentId],
      course_id: courseId,
      course_title: courseTitle,
      created_at_ms: now,
      last_at_ms: now,
      last_from_id: null,
      last_text: null,
      last_read_at_ms: {},
    };
    const { data: created, error } = await supabase.from("chat_threads").insert(payload).select("*").single();
    if (error || !created) throw error || new Error("Thread creation failed.");
    return mapThread(created);
  }
  return mapThread(data);
}

export function watchInbox(userId: string, cb: (rows: Thread[]) => void) {
  let active = true;
  const fetchOnce = async () => {
    const { data } = await supabase
      .from("chat_threads")
      .select("*")
      .contains("participants", [userId])
      .order("last_at_ms", { ascending: false });
    if (!active) return;
    const rows = ((data as any[]) || []).map(mapThread);
    cb(rows);
  };
  fetchOnce();
  const channel = supabase
    .channel(`threads-${userId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "chat_threads" }, () => fetchOnce())
    .subscribe();
  return () => {
    active = false;
    supabase.removeChannel(channel);
  };
}

export function watchThread(threadId: string, cb: (t: Thread | null) => void) {
  let active = true;
  const fetchOnce = async () => {
    const { data } = await supabase.from("chat_threads").select("*").eq("id", threadId).maybeSingle();
    if (!active) return;
    cb(data ? mapThread(data) : null);
  };
  fetchOnce();
  const channel = supabase
    .channel(`thread-${threadId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "chat_threads", filter: `id=eq.${threadId}` },
      () => fetchOnce()
    )
    .subscribe();
  return () => {
    active = false;
    supabase.removeChannel(channel);
  };
}

export function watchMessages(threadId: string, cb: (rows: Message[]) => void) {
  let active = true;
  const fetchOnce = async () => {
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("at_ms", { ascending: true });
    if (!active) return;
    cb(((data as any[]) || []).map(mapMessage));
  };
  fetchOnce();
  const channel = supabase
    .channel(`messages-${threadId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "chat_messages", filter: `thread_id=eq.${threadId}` },
      () => fetchOnce()
    )
    .subscribe();
  return () => {
    active = false;
    supabase.removeChannel(channel);
  };
}

export async function addMessage(
  threadId: string,
  fromId: string,
  text?: string | null,
  attachments?: ChatAttachment[]
): Promise<Message> {
  const atMs = Date.now();
  const m: Omit<Message, "id"> = { fromId, text: text ?? null, attachments: attachments ?? [], atMs };

  const { data: inserted, error: msgError } = await supabase
    .from("chat_messages")
    .insert({
      thread_id: threadId,
      from_id: fromId,
      text: m.text,
      attachments: m.attachments ?? [],
      at_ms: atMs,
    })
    .select("*")
    .single();
  if (msgError || !inserted) throw msgError || new Error("Message insert failed.");

  const lastText =
    text && text.trim()
      ? text.trim().slice(0, 140)
      : attachments?.length
      ? `[att] ${attachments.length} piece(s)`
      : "";
  await supabase
    .from("chat_threads")
    .update({ last_at_ms: atMs, last_from_id: fromId, last_text: lastText })
    .eq("id", threadId);

  return mapMessage(inserted);
}

export async function markRead(threadId: string, userId: string) {
  const { data } = await supabase
    .from("chat_threads")
    .select("last_read_at_ms")
    .eq("id", threadId)
    .maybeSingle();
  const prev = (data as any)?.last_read_at_ms || {};
  const next = { ...prev, [userId]: Date.now() };
  await supabase.from("chat_threads").update({ last_read_at_ms: next }).eq("id", threadId);
}

export async function listThreadsForUser(
  userId: string,
  role?: "student" | "teacher",
  topN = 50
): Promise<(Thread & { unreadForStudent?: number; unreadForTeacher?: number })[]> {
  const { data } = await supabase
    .from("chat_threads")
    .select("*")
    .contains("participants", [userId])
    .order("last_at_ms", { ascending: false })
    .limit(topN);
  const rows = ((data as any[]) || []).map(mapThread);
  const out = rows.map((t) => {
    const base: any = { ...t };
    const unread = hasUnread(t, userId) ? 1 : 0;
    if (role === "student") base.unreadForStudent = unread;
    else if (role === "teacher") base.unreadForTeacher = unread;
    else {
      base.unreadForStudent = unread;
      base.unreadForTeacher = unread;
    }
    return base;
  });
  return out;
}
