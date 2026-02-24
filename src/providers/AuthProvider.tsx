// src/providers/AuthProvider.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import * as SecureStore from "expo-secure-store";
import { supabase } from "@/lib/supabase";
import { addTimeSpent } from "@/storage/usage";
import { registerForPushNotificationsAsync, saveUserPushToken } from "@/lib/notifications";

export type Role = "student" | "teacher";
export type User = { id: string; name?: string; email: string; role: Role; isAdmin?: boolean };

type SignInInput = { email: string; password: string };
type SignUpInput = {
  name: string;
  email: string;
  password: string;
  grade?: string;
  school?: string;
};

type AuthContextType = {
  user: User | null;
  canAccessAdmin: boolean;
  initializing: boolean;
  signIn: (input: SignInInput) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  unlockAdminWithCode: (code: string) => Promise<boolean>;
  lockAdminAccess: () => Promise<void>;
  signOut: () => Promise<void>;
  setUser?: React.Dispatch<React.SetStateAction<User | null>>;
};

const AuthContext = createContext<AuthContextType>({} as any);

const isEmail = (s: string) => /^\S+@\S+\.\S+$/.test(s || "");
const ADMIN_ACCESS_CODE = (process.env.EXPO_PUBLIC_ADMIN_ACCESS_CODE || "13091997").trim();
const ADMIN_UNLOCK_STORAGE_KEY = "admin_console_code_unlocked";

type ProfileRow = {
  id: string;
  name?: string | null;
  role?: Role | null;
  is_admin?: boolean | null;
  email?: string | null;
  school?: string | null;
  grade?: string | null;
  subjects?: string[] | null;
};

let profilesSupportsIsAdminColumn: boolean | null = null;

function isMissingIsAdminColumnError(error: any) {
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  return code === "42703" && /profiles\.is_admin/i.test(message);
}

async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const selectWithIsAdmin = profilesSupportsIsAdminColumn !== false;
  const columns = selectWithIsAdmin ? "id, name, role, is_admin, email" : "id, name, role, email";
  const { data, error } = await supabase.from("profiles").select(columns).eq("id", userId).maybeSingle();

  if (error && selectWithIsAdmin && isMissingIsAdminColumnError(error)) {
    profilesSupportsIsAdminColumn = false;
    const fallback = await supabase
      .from("profiles")
      .select("id, name, role, email")
      .eq("id", userId)
      .maybeSingle();
    if (fallback.error) {
      console.error("[Auth] fetchProfile fallback error", fallback.error);
      return null;
    }
    return (fallback.data ? { ...fallback.data, is_admin: false } : null) as ProfileRow | null;
  }

  if (error) {
    console.error("[Auth] fetchProfile error", error);
    return null;
  }
  if (selectWithIsAdmin && profilesSupportsIsAdminColumn === null) {
    profilesSupportsIsAdminColumn = true;
  }
  return data as ProfileRow | null;
}

async function upsertProfile(row: ProfileRow) {
  const payload =
    profilesSupportsIsAdminColumn === false
      ? (() => {
          const { is_admin, ...rest } = row;
          return rest;
        })()
      : row;

  const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
  if (error && isMissingIsAdminColumnError(error)) {
    profilesSupportsIsAdminColumn = false;
    const { is_admin, ...rest } = row;
    const { error: retryError } = await supabase.from("profiles").upsert(rest, { onConflict: "id" });
    if (retryError) {
      console.error("[Auth] upsertProfile fallback error", retryError);
      throw retryError;
    }
    return;
  }
  if (error) {
    console.error("[Auth] upsertProfile error", error);
    throw error;
  }
  if (profilesSupportsIsAdminColumn === null) {
    profilesSupportsIsAdminColumn = true;
  }
}

function mapUser(u: { id: string; email?: string | null; user_metadata?: any }, profile?: ProfileRow | null): User {
  return {
    id: u.id,
    email: u.email || "",
    name: profile?.name || u.user_metadata?.name || u.user_metadata?.full_name || undefined,
    role: profile?.role || "student",
    isAdmin: !!profile?.is_admin,
  };
}

async function touchLastSeen(userId: string) {
  await supabase.from("profiles").upsert(
    { id: userId, last_seen_ms: Date.now() },
    { onConflict: "id" }
  );
}

function mapAuthError(e: any): string {
  const msg = String(e?.message || "");
  if (msg.includes("Invalid login")) return "Identifiants incorrects.";
  if (msg.includes("Email rate limit")) return "Trop de tentatives. Reessayez plus tard.";
  if (msg.includes("User already registered")) return "Cette adresse email est deja utilisee.";
  if (msg.includes("Password should be at least")) return "Mot de passe trop faible (6 caracteres min.).";
  if (msg.includes("Email not confirmed")) return "Email non confirme. Desactivez la confirmation dans Supabase Auth.";
  return e?.message || "Erreur d'authentification.";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [adminCodeUnlocked, setAdminCodeUnlocked] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const canAccessAdmin = !!user && adminCodeUnlocked;

  useEffect(() => {
    let mounted = true;
    let initCompleted = false;
    let initTimeout: ReturnType<typeof setTimeout> | null = null;

    const hydrateProfile = async (authUser: { id: string; email?: string | null; user_metadata?: any }) => {
      try {
        const profile = await fetchProfile(authUser.id);
        if (!mounted) return;
        if (profile) {
          setUser(mapUser(authUser as any, profile));
          return;
        }
        const fallback: ProfileRow = {
          id: authUser.id,
          name: authUser.user_metadata?.name || authUser.user_metadata?.full_name || null,
          email: authUser.email || null,
          role: "student",
          is_admin: false,
        };
        await upsertProfile(fallback);
        if (!mounted) return;
        setUser(mapUser(authUser as any, fallback));
      } catch (e) {
        console.error("[Auth] hydrateProfile error", e);
      }
    };

    const init = async () => {
      try {
        console.log("AUTH init: start");
        const { data, error } = await supabase.auth.getSession();
        console.log("AUTH getSession: ok", { hasSession: !!data?.session, error });
        const session = data?.session;
        if (session?.user && mounted) {
          setUser(mapUser(session.user as any, null));
          hydrateProfile(session.user);
        }
      } catch (e) {
        console.error("AUTH getSession: crash", e);
      } finally {
        initCompleted = true;
        if (initTimeout) {
          clearTimeout(initTimeout);
          initTimeout = null;
        }
        console.log("AUTH init: done -> initializing=false");
        if (mounted) {
          setInitializing(false);
        }
      }
    };

    initTimeout = setTimeout(() => {
      if (!initCompleted && mounted) {
        console.warn("[Auth] init still running, forcing ready flag");
        setInitializing(false);
      }
    }, 5000);

    init();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      console.log("AUTH state change", { event, hasSession: !!session?.user });
      if (session?.user) {
        setUser(mapUser(session.user as any, null));
        hydrateProfile(session.user);
        const token = session.access_token;
        if (token) await SecureStore.setItemAsync("auth_token", token).catch(() => {});
      } else {
        setUser(null);
        setAdminCodeUnlocked(false);
        await SecureStore.deleteItemAsync(ADMIN_UNLOCK_STORAGE_KEY).catch(() => {});
        await SecureStore.deleteItemAsync("auth_token").catch(() => {});
      }
      setInitializing(false);
    });

    return () => {
      mounted = false;
      if (initTimeout) {
        clearTimeout(initTimeout);
        initTimeout = null;
      }
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    touchLastSeen(user.id).catch(() => {});
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") touchLastSeen(user.id).catch(() => {});
    });
    const interval = setInterval(() => {
      touchLastSeen(user.id).catch(() => {});
    }, 60000);
    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setAdminCodeUnlocked(false);
      return;
    }
    SecureStore.getItemAsync(ADMIN_UNLOCK_STORAGE_KEY)
      .then((v) => {
        setAdminCodeUnlocked(v === "1");
      })
      .catch(() => {
        setAdminCodeUnlocked(false);
      });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    let lastActive = Date.now();
    let isActive = AppState.currentState === "active";

    const flush = async () => {
      if (!isActive) return;
      const now = Date.now();
      const delta = now - lastActive;
      lastActive = now;
      if (delta > 5000) {
        await addTimeSpent(user.id, delta).catch(() => {});
      }
    };

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        isActive = true;
        lastActive = Date.now();
      } else {
        flush().catch(() => {});
        isActive = false;
      }
    });

    const interval = setInterval(() => {
      if (isActive) flush().catch(() => {});
    }, 5 * 60 * 1000);

    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const token = await registerForPushNotificationsAsync().catch(() => null);
      if (!token || cancelled) return;
      await saveUserPushToken(user.id, token).catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const signIn = async ({ email, password }: SignInInput) => {
    if (!email.trim() || !password.trim()) throw new Error("Email et mot de passe requis.");
    if (!isEmail(email)) throw new Error("Adresse email invalide.");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });
      if (error) throw error;

      const authUser = data.user;
      if (authUser) {
        let profile = await fetchProfile(authUser.id);
        if (!profile) {
          profile = {
            id: authUser.id,
            name: authUser.user_metadata?.name || authUser.user_metadata?.full_name || undefined,
            email: authUser.email || undefined,
            role: "student",
            is_admin: false,
          };
          await upsertProfile(profile);
        }
        setUser(mapUser(authUser as any, profile));
      }
    } catch (e) {
      throw new Error(mapAuthError(e));
    }
  };

  const signUp = async ({ name, email, password, grade, school }: SignUpInput) => {
    if (!name.trim() || !email.trim() || !password.trim()) throw new Error("Tous les champs sont requis.");
    if (!isEmail(email)) throw new Error("Adresse email invalide.");
    if (!grade?.trim()) throw new Error("La classe est requise.");
    if (!school?.trim()) throw new Error("L'etablissement est requis.");
    try {
      const trimmedName = name.trim();
      const trimmedEmail = email.trim();
      const trimmedGrade = grade?.trim();
      const trimmedSchool = school?.trim();

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: password.trim(),
        options: {
          data: {
            name: trimmedName,
            grade: trimmedGrade,
            school: trimmedSchool,
          },
        },
      });
      if (error) throw error;

      const authUser = data.user;
      if (authUser) {
        const profile: ProfileRow = {
          id: authUser.id,
          name: trimmedName,
          email: trimmedEmail,
          role: "student",
          is_admin: false,
          school: trimmedSchool || undefined,
          grade: trimmedGrade || undefined,
        };
        await upsertProfile(profile);

        let signedInUser = authUser;
        if (!data.session) {
          const signInRes = await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password: password.trim(),
          });
          if (signInRes.error) throw signInRes.error;
          if (signInRes.data.user) signedInUser = signInRes.data.user;
        }

        setUser(mapUser(signedInUser as any, profile));
      }
    } catch (e) {
      throw new Error(mapAuthError(e));
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut().catch(() => {});
    setUser(null);
    setAdminCodeUnlocked(false);
    await SecureStore.deleteItemAsync(ADMIN_UNLOCK_STORAGE_KEY).catch(() => {});
    await SecureStore.deleteItemAsync("auth_token").catch(() => {});
  };

  const resetPassword = async (email: string) => {
    const cleanEmail = String(email || "").trim();
    if (!cleanEmail) throw new Error("Email requis.");
    if (!isEmail(cleanEmail)) throw new Error("Adresse email invalide.");

    try {
      const redirectTo = String(
        process.env.EXPO_PUBLIC_PASSWORD_RESET_REDIRECT || "iskul://reset-password"
      ).trim();
      const { error } = await supabase.auth.resetPasswordForEmail(
        cleanEmail,
        redirectTo ? { redirectTo } : undefined
      );
      if (error) throw error;
    } catch (e) {
      throw new Error(mapAuthError(e));
    }
  };

  const unlockAdminWithCode = async (code: string) => {
    if (!user) return false;
    const provided = String(code || "").trim();
    if (!provided) return false;
    if (provided !== ADMIN_ACCESS_CODE) return false;
    setAdminCodeUnlocked(true);
    await SecureStore.setItemAsync(ADMIN_UNLOCK_STORAGE_KEY, "1").catch(() => {});
    return true;
  };

  const lockAdminAccess = async () => {
    setAdminCodeUnlocked(false);
    await SecureStore.deleteItemAsync(ADMIN_UNLOCK_STORAGE_KEY).catch(() => {});
  };

  const value = useMemo(
    () => ({
      user,
      canAccessAdmin,
      initializing,
      signIn,
      signUp,
      resetPassword,
      unlockAdminWithCode,
      lockAdminAccess,
      signOut,
      setUser,
    }),
    [user, canAccessAdmin, initializing]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
