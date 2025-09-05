import { db } from "@/lib/firebase";
import {
  doc, setDoc, getDoc,
  collection, query, where, orderBy, limit as qLimit, getDocs, onSnapshot
} from "firebase/firestore";

export type LessonProgress = {
  id: string;            // userId__courseId__lessonId
  userId: string;
  courseId: string;
  lessonId: string;
  watchedSec: number;    // secondes vues
  durationSec?: number;  // durée totale (si connue)
  updatedAt: number;
};

const COL = "progress";
const pid = (userId: string, courseId: string, lessonId: string) =>
  `${userId}__${courseId}__${lessonId}`;

/**
 * Upsert de la progression d'une leçon.
 * Ecrit toujours userId / courseId / lessonId pour satisfaire les rules.
 */
export async function updateLessonProgress(
  userId: string,
  courseId: string,
  lessonId: string,
  patch: { watchedSec?: number; durationSec?: number }
): Promise<void> {
  const id = pid(userId, courseId, lessonId);
  const now = Date.now();
  await setDoc(
    doc(db, COL, id),
    {
      id,
      userId,
      courseId,
      lessonId,
      watchedSec: Math.max(0, Math.floor(patch.watchedSec ?? 0)),
      ...(patch.durationSec != null
        ? { durationSec: Math.max(0, Math.floor(patch.durationSec)) }
        : {}),
      updatedAt: now
    },
    { merge: true }
  );
}

export async function getLessonProgress(
  userId: string,
  courseId: string,
  lessonId: string
): Promise<LessonProgress | null> {
  const id = pid(userId, courseId, lessonId);
  const snap = await getDoc(doc(db, COL, id));
  return snap.exists()
    ? ({ id, ...(snap.data() as any) } as LessonProgress)
    : null;
}

/** Dernières leçons regardées (pour l’Accueil: “Reprendre”) */
export async function listRecentProgress(
  userId: string,
  topN = 20
): Promise<LessonProgress[]> {
  const qy = query(
    collection(db, COL),
    where("userId", "==", userId),
    orderBy("updatedAt", "desc"),
    qLimit(topN)
  );
  const s = await getDocs(qy);
  return s.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as LessonProgress[];
}

/** Variante temps réel si tu veux animer “Reprendre” en live */
export function watchRecentProgress(
  userId: string,
  cb: (rows: LessonProgress[]) => void,
  topN = 20
) {
  const qy = query(
    collection(db, COL),
    where("userId", "==", userId),
    orderBy("updatedAt", "desc"),
    qLimit(topN)
  );
  return onSnapshot(qy, snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as LessonProgress[])
  );
}
