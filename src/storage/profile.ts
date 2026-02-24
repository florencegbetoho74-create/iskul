import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/profile";

type ProfileRow = {
  id: string;
  role?: "student" | "teacher" | null;
  name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  email?: string | null;
  phone?: string | null;
  school?: string | null;
  grade?: string | null;
  subjects?: string[] | null;
  expo_push_tokens?: string[] | null;
  last_seen_ms?: number | null;
  updated_at_ms?: number | null;
};

function mapRow(row: ProfileRow): Profile {
  return {
    userId: row.id,
    role: row.role ?? undefined,
    name: row.name ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    bio: row.bio ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    school: row.school ?? undefined,
    grade: row.grade ?? undefined,
    subjects: row.subjects ?? undefined,
    expoPushTokens: row.expo_push_tokens ?? undefined,
    lastSeenMs: row.last_seen_ms ?? undefined,
    updatedAt: row.updated_at_ms ?? Date.now(),
  };
}

function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const out: any = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== undefined) out[k] = v;
  });
  return out;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, role, name, avatar_url, bio, email, phone, school, grade, subjects, expo_push_tokens, last_seen_ms, updated_at_ms"
    )
    .eq("id", userId)
    .single();
  if (error || !data) return null;
  return mapRow(data as ProfileRow);
}

export async function upsertProfile(userId: string, patch: Partial<Profile>) {
  const payload = stripUndefined({
    id: userId,
    role: patch.role,
    name: patch.name,
    avatar_url: patch.avatarUrl,
    bio: patch.bio,
    email: patch.email,
    phone: patch.phone,
    school: patch.school,
    grade: patch.grade,
    subjects: patch.subjects,
    expo_push_tokens: patch.expoPushTokens,
    last_seen_ms: patch.lastSeenMs,
  });
  const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
  if (error) throw error;
  const next = await getProfile(userId);
  return next;
}

export function watchProfile(userId: string, cb: (p: Profile | null) => void) {
  let active = true;
  const fetchOnce = async () => {
    const row = await getProfile(userId);
    if (active) cb(row);
  };
  fetchOnce();
  const channel = supabase
    .channel(`profile-${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
      () => fetchOnce()
    )
    .subscribe();
  return () => {
    active = false;
    supabase.removeChannel(channel);
  };
}
