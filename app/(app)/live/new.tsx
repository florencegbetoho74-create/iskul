import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLOR, FONT } from "@/theme/colors";
import { useAuth } from "@/providers/AuthProvider";
import { createLive } from "@/storage/lives";
import { useRouter } from "expo-router";

const ACCENT = ["#1D4ED8", "#2563EB"] as const;
const IS_IOS = Platform.OS === "ios";

const fmtDate = (d: Date) =>
  d.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).replace(".", "");
const fmtTime = (d: Date) =>
  d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

export default function NewLive() {
  const { user } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const d = new Date(Date.now() + 30 * 60 * 1000);
  const [startAt, setStartAt] = useState<Date>(d);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [sessionName, setSessionName] = useState("");

  const descRef = useRef<TextInput>(null);
  const sessionRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);

  const onPickDate = (event: any, selected?: Date) => {
    if (!IS_IOS) setShowDatePicker(false);
    if (event?.type === "dismissed") return;
    if (!selected) return;
    const next = new Date(startAt);
    next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    setStartAt(next);
  };

  const onPickTime = (event: any, selected?: Date) => {
    if (!IS_IOS) setShowTimePicker(false);
    if (event?.type === "dismissed") return;
    if (!selected) return;
    const next = new Date(startAt);
    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    setStartAt(next);
  };

  const save = async () => {
    if (!user) return;
    if (!title.trim()) {
      Alert.alert("Champs requis", "Le titre est obligatoire.");
      return;
    }
    const startAtMs = startAt.getTime();
    if (!Number.isFinite(startAtMs)) {
      Alert.alert("Date/heure invalides", "Selectionnez une date et une heure valides.");
      return;
    }
    if (startAtMs < Date.now() - 60000) {
      Alert.alert("Horaire invalide", "Choisissez une heure future.");
      return;
    }
    await createLive({
      title: title.trim(),
      description: desc.trim() || undefined,
      startAt: startAtMs,
      streamingUrl: sessionName.trim() || undefined,
      ownerId: user.id,
      ownerName: user.name,
    });
    Alert.alert("Live programme", "Vous pouvez le demarrer a l'heure prevue.", [
      { text: "OK", onPress: () => router.replace("/(app)/live/mine") },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLOR.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Text style={styles.title}>Programmer un live</Text>
          <Text style={styles.subtitle}>Planifiez un cours en direct via Agora ou via un lien externe.</Text>

          <View style={styles.card}>
            <Text style={styles.label}>Titre</Text>
            <TextInput
              placeholder="Ex: Physique - Terminale"
              placeholderTextColor={COLOR.sub}
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              returnKeyType="next"
              onSubmitEditing={() => descRef.current?.focus()}
            />

            <Text style={styles.label}>Date et heure</Text>
            <View style={styles.dateRow}>
              <Pressable
                style={[styles.input, styles.dateField]}
                onPress={() => {
                  setShowDatePicker(true);
                  setShowTimePicker(false);
                }}
              >
                <Ionicons name="calendar-outline" size={16} color={COLOR.sub} />
                <Text style={styles.dateText}>{fmtDate(startAt)}</Text>
              </Pressable>
              <Pressable
                style={[styles.input, styles.dateField]}
                onPress={() => {
                  setShowTimePicker(true);
                  setShowDatePicker(false);
                }}
              >
                <Ionicons name="time-outline" size={16} color={COLOR.sub} />
                <Text style={styles.dateText}>{fmtTime(startAt)}</Text>
              </Pressable>
            </View>
            <Text style={styles.note}>Heure locale</Text>
            {showDatePicker ? (
              <View style={styles.pickerWrap}>
                <DateTimePicker
                  value={startAt}
                  mode="date"
                  display={IS_IOS ? "spinner" : "default"}
                  onChange={onPickDate}
                />
                {IS_IOS ? (
                  <Pressable style={styles.pickerDone} onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.pickerDoneText}>Valider la date</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {showTimePicker ? (
              <View style={styles.pickerWrap}>
                <DateTimePicker
                  value={startAt}
                  mode="time"
                  display={IS_IOS ? "spinner" : "default"}
                  onChange={onPickTime}
                />
                {IS_IOS ? (
                  <Pressable style={styles.pickerDone} onPress={() => setShowTimePicker(false)}>
                    <Text style={styles.pickerDoneText}>Valider l'heure</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <Text style={styles.label}>Description</Text>
            <TextInput
              ref={descRef}
              placeholder="Description (optionnel)"
              placeholderTextColor={COLOR.sub}
              style={[styles.input, { minHeight: 90 }]}
              value={desc}
              onChangeText={setDesc}
              multiline
            />

            <Text style={styles.label}>Code de session ou lien externe</Text>
            <TextInput
              ref={sessionRef}
              placeholder="Ex: PHYSIQUE-TLE ou https://meet.google.com/..."
              placeholderTextColor={COLOR.sub}
              style={styles.input}
              value={sessionName}
              onChangeText={setSessionName}
              autoCapitalize="none"
              autoCorrect={false}
              selectTextOnFocus
              onFocus={() => scrollRef.current?.scrollToEnd({ animated: true })}
            />
            <Text style={styles.note}>Laissez vide pour generer automatiquement un code Agora.</Text>
          </View>

          <Pressable style={styles.primary} onPress={save}>
            <LinearGradient colors={ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryGrad}>
              <Ionicons name="calendar" size={18} color="#fff" />
              <Text style={styles.primaryText}>Enregistrer</Text>
            </LinearGradient>
          </Pressable>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { color: COLOR.text, fontSize: 22, fontFamily: FONT.heading },
  subtitle: { color: COLOR.sub, marginTop: 6, fontFamily: FONT.body },

  card: {
    marginTop: 16,
    backgroundColor: COLOR.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLOR.border,
    padding: 14,
    gap: 10,
  },
  label: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 12 },
  input: {
    backgroundColor: COLOR.muted,
    color: COLOR.text,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLOR.border,
    fontFamily: FONT.body,
  },
  dateRow: { flexDirection: "row", gap: 10 },
  dateField: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  dateText: { color: COLOR.text, fontFamily: FONT.body },
  note: { color: COLOR.sub, fontFamily: FONT.body, fontSize: 12 },
  pickerWrap: { marginTop: 6, backgroundColor: COLOR.muted, borderRadius: 12, borderWidth: 1, borderColor: COLOR.border, padding: 8 },
  pickerDone: {
    marginTop: 8,
    alignSelf: "flex-end",
    backgroundColor: COLOR.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLOR.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pickerDoneText: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 12 },

  primary: { marginTop: 16, borderRadius: 14, overflow: "hidden" },
  primaryGrad: {
    padding: 14,
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
  },
  primaryText: { color: "#fff", fontFamily: FONT.bodyBold },
});


