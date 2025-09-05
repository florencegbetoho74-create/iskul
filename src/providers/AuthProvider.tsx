import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

export type Role = "student" | "teacher";
export type AppUser = { id: string; email: string; name: string; role: Role };

type AuthContextType = {
  user: AppUser | null;
  initializing: boolean;
  signIn: (p: { email?: string; password?: string }) => Promise<void>;
  signUp: (p: { name?: string; email?: string; password?: string; role?: Role }) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

async function fetchUser(uid: string): Promise<AppUser | null> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const d = snap.data() as any;
  return {
    id: uid,
    email: d.email || "",
    name: d.name || "",
    role: (d.role as Role) || "student",
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setInitializing(false);
        return;
      }
      const prof = await fetchUser(u.uid);
      if (prof) setUser(prof);
      else {
        const minimal: AppUser = { id: u.uid, email: u.email || "", name: u.displayName || "", role: "student" };
        await setDoc(doc(db, "users", u.uid), minimal, { merge: true });
        setUser(minimal);
      }
      setInitializing(false);
    });
    return () => unsub();
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    user,
    initializing,

    async signIn({ email, password }) {
      const e = String(email ?? "").trim();
      const p = String(password ?? "").trim();
      if (!e || !p) throw new Error("Email et mot de passe requis.");
      await signInWithEmailAndPassword(auth, e, p);
    },

    async signUp({ name, email, password, role }) {
      const nm = String(name ?? "").trim();
      const e  = String(email ?? "").trim();
      const p  = String(password ?? "").trim();
      const r: Role = (role as Role) || "student";
      if (!nm || !e || !p) throw new Error("Nom, email et mot de passe requis.");
      const cred = await createUserWithEmailAndPassword(auth, e, p);
      try { await updateProfile(cred.user, { displayName: nm }); } catch {}
      await setDoc(doc(db, "users", cred.user.uid), {
        name: nm, email: e, role: r, createdAtMs: Date.now(),
      }, { merge: true });
    },

    async signOut() { await fbSignOut(auth); }
  }), [user, initializing]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
