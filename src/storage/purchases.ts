import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, getDocs, query, collection, where } from "firebase/firestore";

const COL = "purchases";

function pid(userId: string, bookId: string) { return `${userId}_${bookId}`; }

export async function hasPurchased(userId: string, bookId: string) {
  const snap = await getDoc(doc(db, COL, pid(userId, bookId)));
  return snap.exists();
}

export async function addPurchase(userId: string, bookId: string) {
  await setDoc(doc(db, COL, pid(userId, bookId)), {
    userId, bookId, createdAt: Date.now()
  }, { merge: true });
}

export async function listPurchased(userId: string) {
  const q = query(collection(db, COL), where("userId", "==", userId));
  const s = await getDocs(q);
  return s.docs.map(d => d.data().bookId as string);
}
