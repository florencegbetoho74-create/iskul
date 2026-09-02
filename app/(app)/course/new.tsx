import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLOR, FONT } from "@/theme/colors";
import { useAuth } from "@/providers/AuthProvider";
import { createCourse } from "@/storage/courses";
import SelectionSheetField from "@/components/SelectionSheetField";
import { useSchoolingOptions } from "@/hooks/useSchoolingOptions";
import { DEFAULT_CONTENT_COUNTRY } from "@/storage/referentials";

const ACCENT = ["#1D4ED8", "#2563EB"] as const;

export default function NewCourse() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [gradeLevelId, setGradeLevelId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [loading, setLoading] = useState(false);

  // Un professeur publie dans le programme de son pays.
  const countryCode = user?.countryCode || DEFAULT_CONTENT_COUNTRY;
  const { gradeLevels, subjects, loadingGrades, scope, error: optionsError } =
    useSchoolingOptions(countryCode);

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

  const save = async () => {
    if (!user) return;
    if (!title.trim()) {
      Alert.alert("Champs requis", "Merci de completer tous les champs.");
      return;
    }
    if (!gradeLevelId) {
      Alert.alert("Classe requise", "Veuillez selectionner une classe.");
      return;
    }
    if (!subjectId) {
      Alert.alert("Matiere requise", "Veuillez selectionner une matiere.");
      return;
    }
    try {
      setLoading(true);
      const created = await createCourse({
        title: title.trim(),
        // level et subject sont derives du referentiel par un trigger : on les
        // envoie quand meme pour satisfaire les colonnes non nulles a l'insert.
        level: gradeLevels.find((l) => l.id === gradeLevelId)?.code ?? "",
        subject: subjectLabel,
        countryCode: scope?.countryCode ?? countryCode,
        gradeLevelId,
        subjectId,
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
            value={gradeLabel}
            placeholder={loadingGrades ? "Chargement du programme..." : "Choisir une classe"}
            options={gradeOptions}
            onChange={(label) => {
              const match = gradeLevels.find((l) => l.label === label);
              if (match) setGradeLevelId(match.id);
            }}
            helperText="Le cours n'apparaitra qu'aux eleves de cette classe."
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

          {optionsError ? <Text style={styles.errorText}>{optionsError}</Text> : null}
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
  errorText: { color: COLOR.danger, fontFamily: FONT.bodyBold, fontSize: 12, marginTop: 4 },
});


