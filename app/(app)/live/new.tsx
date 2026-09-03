import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { useThemedStyles } from "@/theme/useStyles";
import type { Theme } from "@/theme/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";
import { createLive } from "@/storage/lives";
import { useRouter } from "expo-router";
import SelectionSheetField from "@/components/SelectionSheetField";
import { useSchoolingOptions } from "@/hooks/useSchoolingOptions";
import { DEFAULT_CONTENT_COUNTRY } from "@/storage/referentials";

/** Degrade d'accent derive du theme. */
const accentGradient = (t: Theme): readonly [string, string] => [
  t.color.primary,
  t.color.primaryPressed,
];
const IS_IOS = Platform.OS === "ios";

const fmtDate = (d: Date) =>
  d.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).replace(".", "");
const fmtTime = (d: Date) =>
  d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

export default function NewLive() {
  const { styles, theme } = useThemedStyles(makeStyles);
  const { user } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const d = new Date(Date.now() + 30 * 60 * 1000);
  const [startAt, setStartAt] = useState<Date>(d);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [gradeLevelId, setGradeLevelId] = useState("");
  const [subjectId, setSubjectId] = useState("");

  const countryCode = user?.countryCode || DEFAULT_CONTENT_COUNTRY;
  const { gradeLevels, subjects, loadingGrades, scope } = useSchoolingOptions(countryCode);

  const gradeOptions = useMemo(() => gradeLevels.map((l) => l.label), [gradeLevels]);
  const subjectOptions = useMemo(() => subjects.map((x) => x.label), [subjects]);
  const gradeLabel = useMemo(
    () => gradeLevels.find((l) => l.id === gradeLevelId)?.label ?? "",
    [gradeLevels, gradeLevelId]
  );
  const subjectLabel = useMemo(
    () => subjects.find((x) => x.id === subjectId)?.label ?? "",
    [subjects, subjectId]
  );

  useEffect(() => {
    if (gradeLevelId && !gradeLevels.some((l) => l.id === gradeLevelId)) setGradeLevelId("");
    if (subjectId && !subjects.some((x) => x.id === subjectId)) setSubjectId("");
  }, [gradeLevels, subjects, gradeLevelId, subjectId]);

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
      countryCode: scope?.countryCode ?? countryCode,
      gradeLevelId: gradeLevelId || null,
      subjectId: subjectId || null,
    });
    Alert.alert("Live programme", "Vous pouvez le demarrer a l'heure prevue.", [
      { text: "OK", onPress: () => router.replace("/(app)/live/mine") },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.bg }}>
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
              placeholderTextColor={theme.color.textMuted}
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
                <Ionicons name="calendar-outline" size={16} color={theme.color.textMuted} />
                <Text style={styles.dateText}>{fmtDate(startAt)}</Text>
              </Pressable>
              <Pressable
                style={[styles.input, styles.dateField]}
                onPress={() => {
                  setShowTimePicker(true);
                  setShowDatePicker(false);
                }}
              >
                <Ionicons name="time-outline" size={16} color={theme.color.textMuted} />
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

            <SelectionSheetField
              label="Classe"
              icon="school-outline"
              value={gradeLabel}
              placeholder={loadingGrades ? "Chargement du programme..." : "Choisir une classe"}
              options={gradeOptions}
              onChange={(label) => {
                const match = gradeLevels.find((l) => l.label === label);
                if (match) setGradeLevelId(match.id);
              }}
              helperText="Laissez vide pour une seance ouverte a toutes les classes."
            />

            <SelectionSheetField
              label="Matiere"
              icon="albums-outline"
              value={subjectLabel}
              placeholder={loadingGrades ? "Chargement du programme..." : "Choisir une matiere"}
              options={subjectOptions}
              onChange={(label) => {
                const match = subjects.find((x) => x.label === label);
                if (match) setSubjectId(match.id);
              }}
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              ref={descRef}
              placeholder="Description (optionnel)"
              placeholderTextColor={theme.color.textMuted}
              style={[styles.input, { minHeight: 90 }]}
              value={desc}
              onChangeText={setDesc}
              multiline
            />

            <Text style={styles.label}>Code de session ou lien externe</Text>
            <TextInput
              ref={sessionRef}
              placeholder="Ex: PHYSIQUE-TLE ou https://meet.google.com/..."
              placeholderTextColor={theme.color.textMuted}
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
            <LinearGradient colors={accentGradient(theme)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryGrad}>
              <Ionicons name="calendar" size={18} color={theme.color.textOnPrimary} />
              <Text style={styles.primaryText}>Enregistrer</Text>
            </LinearGradient>
          </Pressable>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  title: { color: t.color.text, fontSize: 22, fontFamily: t.type.title.fontFamily },
  subtitle: { color: t.color.textMuted, marginTop: 6, fontFamily: t.type.body.fontFamily },

  card: {
    marginTop: 16,
    backgroundColor: t.color.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: t.color.border,
    padding: 14,
    gap: 10,
  },
  label: { color: t.color.text, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 12 },
  input: {
    backgroundColor: t.color.surfaceSunk,
    color: t.color.text,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: t.color.border,
    fontFamily: t.type.body.fontFamily,
  },
  dateRow: { flexDirection: "row", gap: 10 },
  dateField: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  dateText: { color: t.color.text, fontFamily: t.type.body.fontFamily },
  note: { color: t.color.textMuted, fontFamily: t.type.body.fontFamily, fontSize: 12 },
  pickerWrap: { marginTop: 6, backgroundColor: t.color.surfaceSunk, borderRadius: 12, borderWidth: 1, borderColor: t.color.border, padding: 8 },
  pickerDone: {
    marginTop: 8,
    alignSelf: "flex-end",
    backgroundColor: t.color.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: t.color.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pickerDoneText: { color: t.color.text, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 12 },

  primary: { marginTop: 16, borderRadius: 14, overflow: "hidden" },
  primaryGrad: {
    padding: 14,
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
  },
  primaryText: { color: t.color.textOnPrimary, fontFamily: t.type.bodyStrong.fontFamily },
});


