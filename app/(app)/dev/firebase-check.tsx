import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { COLOR } from "@/theme/colors";
import { useAuth } from "@/providers/AuthProvider";
import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import * as FileSystem from "expo-file-system";
import { uploadOne } from "@/lib/upload";

export default function FirebaseCheck() {
  const { user } = useAuth();
  const [busy, setBusy] = useState<null | "fs" | "st">(null);
  const uid = user?.id;

  const testFirestore = async () => {
    if (!uid) return Alert.alert("Auth", "Connecte-toi d'abord.");
    try {
      setBusy("fs");
      const ref = doc(db, "profiles", uid);
      await setDoc(ref, { pingAt: Date.now() }, { merge: true });
      const snap = await getDoc(ref);
      Alert.alert("Firestore", snap.exists() ? "Write + read OK ✅" : "Échec lecture ❌");
    } catch (e: any) {
      Alert.alert("Firestore", e?.message || "Erreur Firestore");
    } finally {
      setBusy(null);
    }
  };

  const testStorage = async () => {
    if (!uid) return Alert.alert("Auth", "Connecte-toi d'abord.");
    try {
      setBusy("st");
      const path = FileSystem.cacheDirectory + "iskul_test.txt";
      await FileSystem.writeAsStringAsync(path, `hello from iSkul @ ${new Date().toISOString()}`);
      const up = await uploadOne({ uri: path, name: "iskul_test.txt", contentType: "text/plain" }, `debug/${uid}`);
      Alert.alert("Storage", `Upload OK ✅\nURL:\n${up.url}`);
    } catch (e: any) {
      Alert.alert("Storage", e?.message || "Erreur Storage");
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Firebase Check</Text>
      <Text style={{ color: COLOR.sub, marginBottom: 10 }}>{uid ? `UID: ${uid}` : "Non connecté"}</Text>

      <TouchableOpacity style={[styles.btn, busy && { opacity: 0.7 }]} onPress={testFirestore} disabled={!!busy}>
        {busy === "fs" ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>Tester Firestore</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={[styles.btn, busy && { opacity: 0.7 }]} onPress={testStorage} disabled={!!busy}>
        {busy === "st" ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>Tester Storage</Text>}
      </TouchableOpacity>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex:1, backgroundColor: COLOR.bg, padding:16, gap:12, justifyContent:"center" },
  title: { color: COLOR.text, fontSize: 22, fontWeight: "900", marginBottom: 8 },
  btn: { backgroundColor: COLOR.primary, borderRadius: 12, padding: 14, alignItems: "center" },
  btnTxt: { color:"#fff", fontWeight:"800" }
});
