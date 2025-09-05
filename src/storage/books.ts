import { db } from "@/lib/firebase";
import {
  collection, addDoc, doc, getDoc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp, query, orderBy, limit as fsLimit
} from "firebase/firestore";
import type { Book } from "@/types/book";

const COL = "books";

export async function addBook(payload: Omit<Book, "id" | "createdAt" | "updatedAt" | "updatedAtMs">) {
  const ref = await addDoc(collection(db, COL), {
    ...payload,
    price: payload.price ?? 0,
    published: payload.published ?? true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now()
  });
  const snap = await getDoc(ref);
  return { id: ref.id, ...(snap.data() as any) } as Book;
}

export async function updateBook(id: string, patch: Partial<Book>) {
  const ref = doc(db, COL, id);
  await updateDoc(ref, { ...patch, updatedAt: serverTimestamp(), updatedAtMs: Date.now() });
}

export async function getBook(id: string): Promise<Book | null> {
  const ref = doc(db, COL, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as any) } as Book;
}

export async function deleteBook(id: string) {
  await deleteDoc(doc(db, COL, id));
}

export function watchBooksOrdered(cb: (rows: Book[]) => void, limitN = 100) {
  const q = query(collection(db, COL), orderBy("updatedAtMs", "desc"), fsLimit(limitN));
  return onSnapshot(q, (ss) => {
    const rows = ss.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as Book));
    cb(rows);
  });
}
