import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { db } from "@/lib/firebase";
import { doc, setDoc, updateDoc, arrayUnion } from "firebase/firestore";

// canal Android
Notifications.setNotificationChannelAsync?.("default", {
  name: "default",
  importance: Notifications.AndroidImportance.MAX,
  vibrationPattern: [0, 250, 250, 250],
  lightColor: "#FF231F7C",
});

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

  // Expo Go / Client installé
  const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
  token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  return token;
}

/** Sauvegarde le token dans users/{uid}.expoPushTokens = array */
export async function saveUserPushToken(uid: string, token: string) {
  const ref = doc(db, "users", uid);
  await setDoc(ref, { expoPushTokens: [token] }, { merge: true });
  await updateDoc(ref, { expoPushTokens: arrayUnion(token) });
}
