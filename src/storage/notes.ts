import { db } from "@/lib/firebase";
import {
  addDoc, collection, deleteDoc, doc,
  getDocs, onSnapshot, orderBy, query, where
} from "firebase/firestore";

export type LessonNote = {
  id: string;
  userId: string;
  courseId: string;
  lessonId: string;
  t: number;        // timestamp (sec) dans la vidéo
  text: string;
  createdAt: number;
};

const COL = "notes";

/** Ajoute une note liée à un instant t (en secondes). */
export async function addNote(
  userId: string,
  courseId: string,
  lessonId: string,
  t: number,
  text: string
): Promise<LessonNote> {
  const now = Date.now();
  const ref = await addDoc(collection(db, COL), {
    userId,
    courseId,
    lessonId,
    t: Math.max(0, Math.floor(t)),
    text,
    createdAt: now
  });
  return { id: ref.id, userId, courseId, lessonId, t: Math.floor(t), text, createdAt: now };
}

/** Liste des notes pour une leçon (tri croissant par date). */
export async function listNotes(
  userId: string,
  courseId: string,
  lessonId: string
): Promise<LessonNote[]> {
  const qy = query(
    collection(db, COL),
    where("userId", "==", userId),
    where("courseId", "==", courseId),
    where("lessonId", "==", lessonId),
    orderBy("createdAt", "asc")
  );
  const s = await getDocs(qy);
  return s.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as LessonNote[];
}

/** Abonnement temps réel (optionnel) */
export function watchNotes(
  userId: string,
  courseId: string,
  lessonId: string,
  cb: (rows: LessonNote[]) => void
) {
  const qy = query(
    collection(db, COL),
    where("userId", "==", userId),
    where("courseId", "==", courseId),
    where("lessonId", "==", lessonId),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(qy, snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as LessonNote[])
  );
}

/** Suppression d’une note par id (les Rules vérifient l’auteur) */
export async function deleteNote(
  _userId: string,
  _courseId: string,
  _lessonId: string,
  noteId: string
): Promise<void> {
  await deleteDoc(doc(db, COL, noteId));
}
