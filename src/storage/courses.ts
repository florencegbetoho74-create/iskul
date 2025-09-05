import { db } from "@/lib/firebase";
import {
  addDoc, collection, deleteDoc, doc, getDoc,
  onSnapshot, orderBy, query, updateDoc, limit as qLimit, where
} from "firebase/firestore";
import type { Course, Chapter } from "@/types/course";

const COL = "courses";

function mapDoc(d: any): Course {
  const data = d.data ? d.data() : d;
  return {
    id: d.id ?? data.id,
    title: data.title ?? "",
    level: data.level ?? "",
    subject: data.subject ?? "",
    coverUrl: data.coverUrl ?? null,
    chapters: Array.isArray(data.chapters) ? data.chapters : [],
    published: !!data.published,
    ownerId: data.ownerId ?? "",
    ownerName: data.ownerName ?? "",
    createdAtMs: data.createdAtMs ?? Date.now(),
    updatedAtMs: data.updatedAtMs ?? Date.now()
  };
}

export async function createCourse(input: Partial<Course>): Promise<Course> {
  const now = Date.now();
  const payload = {
    title: input.title ?? "",
    level: input.level ?? "",
    subject: input.subject ?? "",
    coverUrl: input.coverUrl ?? null,
    chapters: Array.isArray(input.chapters) ? input.chapters : [],
    published: !!input.published,
    ownerId: input.ownerId!,
    ownerName: input.ownerName ?? "",
    createdAtMs: now,
    updatedAtMs: now
  };
  const ref = await addDoc(collection(db, COL), payload as any);
  return mapDoc({ id: ref.id, ...payload });
}

export async function updateCourse(id: string, patch: Partial<Course>) {
  const ref = doc(db, COL, id);
  await updateDoc(ref, { ...patch, updatedAtMs: Date.now() });
  const snap = await getDoc(ref);
  return snap.exists() ? mapDoc({ id, ...snap.data() }) : null;
}

export async function deleteCourse(id: string) {
  await deleteDoc(doc(db, COL, id));
}

export async function getCourse(id: string): Promise<Course | null> {
  const snap = await getDoc(doc(db, COL, id));
  return snap.exists() ? mapDoc({ id: snap.id, ...snap.data() }) : null;
}

/** Temps réel : récupère les derniers cours (sans filtre serveur) */
export function watchCoursesOrdered(cb: (rows: Course[]) => void, topN = 50) {
  const qy = query(collection(db, COL), orderBy("updatedAtMs", "desc"), qLimit(topN));
  return onSnapshot(qy, (snap) => cb(snap.docs.map((d) => mapDoc(d))));
}

/** ✅ Temps réel : tous les cours d’un professeur (sans index composite) */
export function watchByOwner(ownerId: string, cb: (rows: Course[]) => void) {
  const qy = query(collection(db, COL), where("ownerId", "==", ownerId));
  return onSnapshot(qy, (snap) => {
    const rows = snap.docs.map((d) => mapDoc(d));
    // Tri côté client pour éviter de forcer un index composite en dev
    rows.sort((a, b) => (b.updatedAtMs ?? 0) - (a.updatedAtMs ?? 0));
    cb(rows);
  });
}

/* ===== Chapitres ===== */

function genId() {
  return (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).toUpperCase();
}

export async function addChapter(courseId: string, input: { title: string; videoUrl?: string | null; order?: number }) {
  const ref = doc(db, COL, courseId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Cours introuvable");
  const data = snap.data() as any;
  const cur: Chapter[] = Array.isArray(data.chapters) ? data.chapters : [];
  const ch: Chapter = {
    id: genId(),
    title: input.title,
    videoUrl: input.videoUrl ?? undefined,
    order: input.order ?? (cur.length ? Math.max(...cur.map((c: any) => c?.order ?? 0)) + 1 : 1)
  };
  const next = [...cur, ch];
  await updateDoc(ref, { chapters: next, updatedAtMs: Date.now() });
  return ch;
}

export async function deleteChapter(courseId: string, chapterId: string) {
  const ref = doc(db, COL, courseId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data() as any;
  const cur: Chapter[] = Array.isArray(data.chapters) ? data.chapters : [];
  const next = cur.filter((c) => c.id !== chapterId);
  await updateDoc(ref, { chapters: next, updatedAtMs: Date.now() });
}
