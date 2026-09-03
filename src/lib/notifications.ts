import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";

Notifications.setNotificationChannelAsync?.("default", {
  name: "default",
  importance: Notifications.AndroidImportance.MAX,
  vibrationPattern: [0, 250, 250, 250],
  lightColor: "#FF231F7C",
});

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const KEY_LAST_PUBLISHED_TS = "notif:last_published_ts";
const KEY_LIVE_SCHEDULED = "notif:live_scheduled";
const KEY_HOMEWORK_DAY = "notif:homework_day";

type CourseNotifInput = {
  id: string;
  title?: string;
  published?: boolean;
  updatedAtMs?: number;
  createdAtMs?: number;
};

type LiveNotifInput = {
  id: string;
  title?: string;
  startAt?: number;
  status?: "scheduled" | "live" | "ended" | string;
};

function userKey(base: string, userId: string) {
  return `${base}:${userId}`;
}

function toNumber(v: unknown) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(key: string, value: unknown) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // silent
  }
}

async function scheduleImmediate(title: string, body: string, data?: Record<string, any>) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: "default", data: data || {} },
    trigger: null,
  });
}

async function scheduleAt(title: string, body: string, whenMs: number, data?: Record<string, any>) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: "default", data: data || {} },
    trigger: new Date(whenMs) as any,
  });
}

function isoDay(ts = Date.now()) {
  return new Date(ts).toISOString().slice(0, 10);
}

export async function ensureNotificationPermission() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    return null;
  }

  const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
  token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  return token;
}

export async function saveUserPushToken(uid: string, token: string) {
  const { data } = await supabase
    .from("profiles")
    .select("expo_push_tokens")
    .eq("id", uid)
    .maybeSingle();
  const prev = (data as any)?.expo_push_tokens || [];
  const next = Array.from(new Set([...(prev || []), token]));
  await supabase.from("profiles").upsert({ id: uid, expo_push_tokens: next }, { onConflict: "id" });
}

export async function scheduleHomeworkReminder(userId: string, hasPendingWork: boolean) {
  if (!hasPendingWork) return;
  const key = userKey(KEY_HOMEWORK_DAY, userId);
  const today = isoDay();
  const last = (await AsyncStorage.getItem(key)) || "";
  if (last === today) return;

  const now = new Date();
  const target = new Date(now);
  target.setHours(19, 30, 0, 0);
  if (target.getTime() <= now.getTime() + 5 * 60_000) {
    target.setDate(target.getDate() + 1);
  }

  await scheduleAt(
    "Rappel de devoir",
    "Tu as du contenu en cours. Termine une lecon ou un quiz ce soir.",
    target.getTime(),
    { type: "homework_reminder" }
  );
  await AsyncStorage.setItem(key, today);
}

/**
 * Rappels programmes sur l'appareil.
 *
 * Les nouveaux cours et le demarrage des lives sont desormais notifies par le
 * serveur : les reprogrammer ici ferait doublon. Ne reste que le rappel de
 * travail en cours, qui depend de l'appareil et non d'un evenement serveur.
 */
export async function primeSmartStudentNotifications(input: {
  userId: string;
  hasPendingWork: boolean;
}) {
  const ok = await ensureNotificationPermission();
  if (!ok) return;
  await scheduleHomeworkReminder(input.userId, input.hasPendingWork);
}
