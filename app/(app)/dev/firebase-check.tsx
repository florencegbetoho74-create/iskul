import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { COLOR } from "@/theme/colors";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabase";
import * as FileSystem from "expo-file-system/legacy";
import { uploadOne } from "@/lib/upload";

export default function SupabaseCheck() {
  const { user } = useAuth();
  const [busy, setBusy] = useState<null | "db" | "st">(null);
  const uid = user?.id;

  const testDatabase = async () => {
    if (!uid) return Alert.alert("Auth", "Connecte-toi d'abord.");
    try {
      setBusy("db");
      const { error } = await supabase.from("profiles").upsert({ id: uid, last_seen_ms: Date.now() });
      if (error) throw error;
      const { data } = await supabase.from("profiles").select("id").eq("id", uid).single();
      Alert.alert("Supabase DB", data?.id ? "Write + read OK." : "Read failed.");
    } catch (e: any) {
      Alert.alert("Supabase DB", e?.message || "Erreur DB");
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
      Alert.alert("Supabase Storage", `Upload OK.\nURL:\n${up.url}`);
    } catch (e: any) {
      Alert.alert("Supabase Storage", e?.message || "Erreur Storage");
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Supabase Check</Text>
      <Text style={{ color: COLOR.sub, marginBottom: 10 }}>{uid ? `UID: ${uid}` : "Non connecte"}</Text>

      <TouchableOpacity style={[styles.btn, busy && { opacity: 0.7 }]} onPress={testDatabase} disabled={!!busy}>
        {busy === "db" ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>Tester DB</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={[styles.btn, busy && { opacity: 0.7 }]} onPress={testStorage} disabled={!!busy}>
        {busy === "st" ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>Tester Storage</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLOR.bg, padding: 16, gap: 12, justifyContent: "center" },
  title: { color: COLOR.text, fontSize: 22, fontWeight: "900", marginBottom: 8 },
  btn: { backgroundColor: COLOR.primary, borderRadius: 12, padding: 14, alignItems: "center" },
  btnTxt: { color: "#fff", fontWeight: "800" },
});
