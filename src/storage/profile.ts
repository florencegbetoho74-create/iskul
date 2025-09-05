import AsyncStorage from "@react-native-async-storage/async-storage";
import { Profile } from "@/types/profile";

const KEY = "iskul_profiles_v1";

type MapType = Record<string, Profile>; // userId -> profile

async function getMap(): Promise<MapType> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) as MapType : {};
}
async function saveMap(m: MapType) { await AsyncStorage.setItem(KEY, JSON.stringify(m)); }

export async function getProfile(userId: string): Promise<Profile | null> {
  const map = await getMap();
  return map[userId] ?? null;
}

export async function upsertProfile(userId: string, patch: Partial<Profile>) {
  const map = await getMap();
  const prev: Profile = map[userId] ?? { userId, updatedAt: 0 };
  const next: Profile = { ...prev, ...patch, userId, updatedAt: Date.now() };
  map[userId] = next;
  await saveMap(map);
  return next;
}
