import { db } from "@/lib/firebase";
import {
  doc, getDoc, setDoc, updateDoc, onSnapshot,
  collection, addDoc, query, where, orderBy
} from "firebase/firestore";
import type { ChatAttachment, Message, Thread } from "@/types/chat";

/** Crée un id déterministe pour éviter les doublons */
function makeThreadId(teacherId: string, studentId: string, courseId?: string | null) {
  const pair = [teacherId, studentId].sort().join("__");
  const c = courseId?.replace(/[^\w\-]/g, "_") || "none";
  const raw = `${pair}__${c}`;
  return `th_${raw.replace(/[^\w\-]/g, "_").slice(0, 250)}`;
}

function mapThread(d: any): Thread {
  const data = d.data ? d.data() : d;
  return {
    id: d.id ?? data.id,
    teacherId: data.teacherId,
    teacherName: data.teacherName ?? "",
    studentId: data.studentId,
    studentName: data.studentName ?? "",
    participants: Array.isArray(data.participants) ? data.participants : [data.teacherId, data.studentId],
    courseId: data.courseId ?? null,
    courseTitle: data.courseTitle ?? null,
    createdAtMs: data.createdAtMs ?? Date.now(),
    lastAtMs: data.lastAtMs ?? Date.now(),
    lastFromId: data.lastFromId ?? "",
    lastText: data.lastText ?? null,
    lastReadAtMs: data.lastReadAtMs ?? {}
  };
}

/** Crée (ou récupère) un thread 1:1 */
export async function startThread(params: {
  teacherId: string; teacherName?: string;
  studentId: string; studentName?: string;
  courseId?: string | null; courseTitle?: string | null;
}): Promise<Thread> {
  const id = makeThreadId(params.teacherId, params.studentId, params.courseId);
  const ref = doc(db, "threads", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const now = Date.now();
    const payload: Thread = {
      id,
      teacherId: params.teacherId,
      teacherName: params.teacherName ?? "",
      studentId: params.studentId,
      studentName: params.studentName ?? "",
      participants: [params.teacherId, params.studentId],
      courseId: params.courseId ?? null,
      courseTitle: params.courseTitle ?? null,
      createdAtMs: now,
      lastAtMs: now,
      lastFromId: "",
      lastText: null,
      lastReadAtMs: {}
    };
    await setDoc(ref, payload as any);
    return payload;
  }
  return mapThread({ id: snap.id, ...snap.data() });
}

/** Inbox temps réel pour un utilisateur */
export function watchInbox(userId: string, cb: (rows: Thread[]) => void) {
  const qy = query(collection(db, "threads"), where("participants", "array-contains", userId));
  return onSnapshot(qy, (ss) => {
    const rows = ss.docs.map((d) => mapThread(d));
    rows.sort((a, b) => (b.lastAtMs ?? 0) - (a.lastAtMs ?? 0)); // tri client (évite index composite)
    cb(rows);
  });
}

/** Thread en temps réel */
export function watchThread(threadId: string, cb: (t: Thread | null) => void) {
  const ref = doc(db, "threads", threadId);
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) return cb(null);
    cb(mapThread({ id: snap.id, ...snap.data() }));
  });
}

/** Messages en temps réel (triés ascendant) */
export function watchMessages(threadId: string, cb: (rows: Message[]) => void) {
  const qy = query(collection(db, "threads", threadId, "messages"), orderBy("atMs", "asc"));
  return onSnapshot(qy, (ss) => {
    const rows = ss.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Message[];
    cb(rows);
  });
}

/** Envoie un message (+ MAJ du thread) */
export async function addMessage(
  threadId: string,
  fromId: string,
  text?: string | null,
  attachments?: ChatAttachment[]
) {
  const atMs = Date.now();
  const m: Omit<Message, "id"> = { fromId, text: text ?? null, attachments: attachments ?? [], atMs };
  await addDoc(collection(db, "threads", threadId, "messages"), m as any);

  // MAJ meta du thread
  const ref = doc(db, "threads", threadId);
  const lastText = (text && text.trim()) ? text.trim().slice(0, 140) : (attachments?.length ? `📎 ${attachments.length} pièce(s)` : "");
  await updateDoc(ref, {
    lastAtMs: atMs,
    lastFromId: fromId,
    lastText
  } as any);
}

/** Marque comme lu pour un utilisateur (timestamp) */
export async function markRead(threadId: string, userId: string) {
  const ref = doc(db, "threads", threadId);
  await updateDoc(ref, { [`lastReadAtMs.${userId}`]: Date.now() } as any);
}

/** Petit helper de confort pour l’UI : y a-t-il du non-lu ? */
export function hasUnread(t: Thread, userId: string) {
  const lastRead = t.lastReadAtMs?.[userId] ?? 0;
  return (t.lastFromId && t.lastFromId !== userId && (t.lastAtMs ?? 0) > lastRead);
}
