import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLOR, FONT } from "@/theme/colors";
import { useAuth } from "@/providers/AuthProvider";
import { createCourse } from "@/storage/courses";
import SelectionSheetField from "@/components/SelectionSheetField";
import { GRADE_LEVELS, isKnownGradeLevel } from "@/constants/gradeLevels";
import { COURSE_SUBJECTS, isKnownCourseSubject } from "@/constants/courseSubjects";

const ACCENT = ["#1D4ED8", "#2563EB"] as const;

export default function NewCourse() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState("");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(false);

  const save = async () => {
    if (!user) return;
    if (!title.trim()) {
      Alert.alert("Champs requis", "Merci de completer tous les champs.");
      return;
    }
    if (!isKnownGradeLevel(level)) {
      Alert.alert("Classe requise", "Veuillez selectionner une classe.");
      return;
    }
    if (!isKnownCourseSubject(subject)) {
      Alert.alert("Matiere requise", "Veuillez selectionner une matiere.");
      return;
    }
    try {
      setLoading(true);
      const created = await createCourse({
        title: title.trim(),
        level: level.trim(),
        subject: subject.trim(),
        chapters: [],
        published: false,
        ownerId: user.id,
        ownerName: user.name,
      });
      Alert.alert("Enregistré avec succès", "Passez en edition pour completer.", [
        { text: "OK", onPress: () => router.replace(`/(app)/course/edit/${created.id}`) },
      ]);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Creation impossible.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={styles.title}>Creer un cours</Text>
        <Text style={styles.subtitle}>Les champs ci-dessous definissent la fiche principale.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Titre</Text>
          <TextInput
            placeholder="Ex: Fractions pour la 3e"
            placeholderTextColor={COLOR.sub}
            style={styles.input}
            value={title}
            onChangeText={setTitle}
          />

          <SelectionSheetField
            label="Classe"
            icon="school-outline"
            value={level}
            placeholder="Choisir une classe"
            options={GRADE_LEVELS}
            onChange={setLevel}
            helperText="Selectionnez une classe standard pour une recherche eleve plus propre."
          />

          <SelectionSheetField
            label="Matiere"
            icon="albums-outline"
            value={subject}
            placeholder="Choisir une matiere"
            options={COURSE_SUBJECTS}
            onChange={setSubject}
          />
        </View>

        <Pressable style={[styles.primary, loading && { opacity: 0.7 }]} onPress={save} disabled={loading}>
          <LinearGradient colors={ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryGrad}>
            <Ionicons name="save-outline" size={18} color="#fff" />
            <Text style={styles.primaryText}>{loading ? "Creation..." : "Enregistrer et continuer"}</Text>
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLOR.bg },
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


