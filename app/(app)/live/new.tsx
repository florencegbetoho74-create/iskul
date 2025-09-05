import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLOR } from "@/theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/providers/AuthProvider";
import { createLive } from "@/storage/lives";
import { useRouter } from "expo-router";

function toEpoch(dateStr: string, timeStr: string) {
  try {
    const iso = `${dateStr.trim()}T${timeStr.trim()}:00`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d.getTime();
  } catch { return null; }
}

export default function NewLive() {
  const { user } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  // valeurs par défaut: +30 min
  const d = new Date(Date.now() + 30 * 60 * 1000);
  const [dateStr, setDateStr] = useState(d.toISOString().slice(0,10)); // YYYY-MM-DD
  const [timeStr, setTimeStr] = useState(d.toTimeString().slice(0,5)); // HH:mm
  const [url, setUrl] = useState("");

  const timeRef = useRef<TextInput>(null);
  const descRef = useRef<TextInput>(null);
  const urlRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);

  const save = async () => {
    if (!user) return;
    if (!title.trim() || !dateStr || !timeStr) {
      Alert.alert("Champs requis", "Titre, date et heure sont obligatoires.");
      return;
    }
    const startAt = toEpoch(dateStr, timeStr);
    if (!startAt) {
      Alert.alert("Date/heure invalides", "Utilisez le format YYYY-MM-DD et HH:mm.");
      return;
    }
    const item = await createLive({
      title: title.trim(),
      description: desc.trim() || undefined,
      startAt,
      streamingUrl: url.trim() || undefined,
      ownerId: user.id,
      ownerName: user.name
    });
    Alert.alert("Live programmé", "Vous pouvez le démarrer à l'heure prévue.", [
      { text: "OK", onPress: () => router.replace("/(app)/live/mine") }
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLOR.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <Text style={styles.title}>Programmer un direct</Text>

          <TextInput
            placeholder="Titre (ex: Physique - Terminale)"
            placeholderTextColor="#6b7280"
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            returnKeyType="next"
            onSubmitEditing={() => timeRef.current?.focus()}
          />

          <View style={{ flexDirection: "row", gap: 10 }}>
            <TextInput
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#6b7280"
              style={[styles.input, { flex: 1 }]}
              value={dateStr}
              onChangeText={setDateStr}
              returnKeyType="next"
              onSubmitEditing={() => timeRef.current?.focus()}
            />
            <TextInput
              ref={timeRef}
              placeholder="HH:mm"
              placeholderTextColor="#6b7280"
              style={[styles.input, { width: 110 }]}
              value={timeStr}
              onChangeText={setTimeStr}
              returnKeyType="next"
              onSubmitEditing={() => descRef.current?.focus()}
            />
          </View>

          <TextInput
            ref={descRef}
            placeholder="Description (optionnel)"
            placeholderTextColor="#6b7280"
            style={[styles.input, { minHeight: 90 }]}
            value={desc}
            onChangeText={setDesc}
            multiline
          />

          <TextInput
            ref={urlRef}
            placeholder="URL du flux (mp4/HLS) ou YouTube Live"
            placeholderTextColor="#6b7280"
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            keyboardType="url"
            textContentType="URL"
            autoCapitalize="none"
            autoCorrect={false}
            selectTextOnFocus
            onFocus={() => scrollRef.current?.scrollToEnd({ animated: true })}
          />

          <TouchableOpacity style={styles.primary} onPress={save}>
            <Ionicons name="calendar" size={18} color="#fff" />
            <Text style={styles.primaryText}>Enregistrer</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { color: COLOR.text, fontSize: 20, fontWeight: "800", marginBottom: 8 },
  input: { backgroundColor: "#1A1B1E", color: COLOR.text, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLOR.border },
  primary: { backgroundColor: COLOR.primary, borderRadius: 14, padding: 14, alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "center" },
  primaryText: { color: "#fff", fontWeight: "800" }
});
