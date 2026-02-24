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

export async function notifyNewPublishedCourses(userId: string, courses: CourseNotifInput[]) {
  const key = userKey(KEY_LAST_PUBLISHED_TS, userId);
  const published = (courses || []).filter((c) => !!c?.published);
  if (!published.length) return;

  const newest = published.reduce((max, c) => {
    const ts = Math.max(toNumber(c.updatedAtMs), toNumber(c.createdAtMs));
    return ts > max ? ts : max;
  }, 0);
  if (!newest) return;

  const previous = toNumber(await AsyncStorage.getItem(key));
  if (!previous) {
    await AsyncStorage.setItem(key, String(newest));
    return;
  }

  const count = published.filter((c) => Math.max(toNumber(c.updatedAtMs), toNumber(c.createdAtMs)) > previous).length;
  if (count > 0) {
    const top = published
      .filter((c) => Math.max(toNumber(c.updatedAtMs), toNumber(c.createdAtMs)) > previous)
      .sort((a, b) => Math.max(toNumber(b.updatedAtMs), toNumber(b.createdAtMs)) - Math.max(toNumber(a.updatedAtMs), toNumber(a.createdAtMs)))[0];
    const body = count === 1 && top?.title
      ? `Nouveau cours: ${top.title}`
      : `${count} nouveaux cours sont disponibles.`;
    await scheduleImmediate("Nouveaux cours disponibles", body, { type: "new_course" });
  }
  await AsyncStorage.setItem(key, String(newest));
}

export async function scheduleLiveReminders(userId: string, lives: LiveNotifInput[]) {
  const key = userKey(KEY_LIVE_SCHEDULED, userId);
  const now = Date.now();
  const scheduled = await readJson<Record<string, number>>(key, {});
  const nextMap: Record<string, number> = { ...scheduled };

  for (const live of lives || []) {
    if (!live?.id) continue;
    if (live.status === "ended") continue;
    const startAt = toNumber(live.startAt);
    if (!startAt) continue;
    if (startAt <= now) continue;
    if (startAt - now > 48 * 3600_000) continue;

    if (toNumber(nextMap[live.id]) >= startAt) continue;

    const reminderAt = Math.max(now + 20_000, startAt - 10 * 60_000);
    const title = live.title?.trim() ? live.title.trim() : "Votre live";
    await scheduleAt(
      "Live bientot",
      `${title} commence bientot. Rejoins la session a l'heure.`,
      reminderAt,
      { type: "live_reminder", liveId: live.id }
    );
    nextMap[live.id] = startAt;
  }

  await writeJson(key, nextMap);
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

export async function primeSmartStudentNotifications(input: {
  userId: string;
  courses: CourseNotifInput[];
  lives: LiveNotifInput[];
  hasPendingWork: boolean;
}) {
  const ok = await ensureNotificationPermission();
  if (!ok) return;
  await notifyNewPublishedCourses(input.userId, input.courses);
  await scheduleLiveReminders(input.userId, input.lives);
  await scheduleHomeworkReminder(input.userId, input.hasPendingWork);
}
