import { db } from "@/lib/firebase";
import { addDoc, collection, doc, getDoc, getDocs, orderBy, query, updateDoc, where } from "firebase/firestore";

const COL = "lives";

export async function createLive(input: any) {
  const now = Date.now();
  const payload = { ...input, status: "scheduled", createdAt: now, updatedAt: now };
  const ref = await addDoc(collection(db, COL), payload);
  return { id: ref.id, ...payload };
}

export async function listMine(ownerId: string) {
  const q = query(collection(db, COL), where("ownerId", "==", ownerId), orderBy("startAt", "asc"));
  const s = await getDocs(q);
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function listUpcoming(now = Date.now()) {
  const q = query(collection(db, COL), where("startAt", ">=", now - 2 * 60 * 60 * 1000), orderBy("startAt", "asc"));
  const s = await getDocs(q);
  return s.docs.map(d => ({ id: d.id, ...d.data() })).filter((l: any) => l.status !== "ended");
}

export async function getLive(id: string) {
  const snap = await getDoc(doc(db, COL, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function updateLive(id: string, patch: any) {
  const ref = doc(db, COL, id);
  await updateDoc(ref, { ...patch, updatedAt: Date.now() });
  const snap = await getDoc(ref);
  return { id, ...snap.data() };
}

export async function setStatus(id: string, status: "scheduled" | "live" | "ended") {
  return updateLive(id, { status });
}
