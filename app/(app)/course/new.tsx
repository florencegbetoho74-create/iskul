import React, { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/theme/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";
import Text from "@/components/ui/Text";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import { createCourse } from "@/storage/courses";
import SelectionSheetField from "@/components/SelectionSheetField";
import { useSchoolingOptions } from "@/hooks/useSchoolingOptions";
import { DEFAULT_CONTENT_COUNTRY } from "@/storage/referentials";

type Errors = { title?: string; grade?: string; subject?: string };

/**
 * Creation d'un cours.
 *
 * L'ecran ne demande que ce qui identifie le cours dans le programme. Tout le
 * reste -- chapitres, videos, relecture -- appartient a l'editeur.
 */
export default function NewCourse() {
  const { color, space } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState("");
  const [gradeLevelId, setGradeLevelId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

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
    if (!user || saving) return;

    // Ce qui manque s'affiche sur le champ concerne : une alerte fait sortir de
    // l'ecran pour dire ce qui s'y trouve deja.
    const next: Errors = {};
    if (!title.trim()) next.title = "Donnez un titre au cours.";
    if (!gradeLevelId) next.grade = "Choisissez la classe visee.";
    if (!subjectId) next.subject = "Choisissez la matiere.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setFailure(null);
    setSaving(true);
    try {
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
      router.replace(`/(app)/course/edit/${created.id}`);
    } catch (e: any) {
      setFailure(e?.message || "Creation impossible.");
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: color.bg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.head, { paddingTop: insets.top + space.md, paddingHorizontal: space.lg, gap: space.sm }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Revenir"
        >
          <Ionicons name="chevron-back" size={22} color={color.text} />
        </Pressable>
        <Text variant="heading">Nouveau cours</Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: space.lg,
          paddingBottom: insets.bottom + space.xxl,
          gap: space.lg,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Field
          label="Titre"
          required
          placeholder="Les fractions"
          value={title}
          onChangeText={(v) => {
            setTitle(v);
            if (errors.title) setErrors((e) => ({ ...e, title: undefined }));
          }}
          error={errors.title}
          returnKeyType="done"
        />

        <View>
          <SelectionSheetField
            label="Classe"
            icon="school-outline"
            value={gradeLabel}
            placeholder={loadingGrades ? "Chargement du programme..." : "Choisir une classe"}
            options={gradeOptions}
            onChange={(label) => {
              const match = gradeLevels.find((l) => l.label === label);
              if (match) setGradeLevelId(match.id);
              setErrors((e) => ({ ...e, grade: undefined }));
            }}
            helperText="Le cours n'apparaitra qu'aux eleves de cette classe."
          />
          {errors.grade ? (
            <Text variant="caption" tone="danger">
              {errors.grade}
            </Text>
          ) : null}
        </View>

        <View>
          <SelectionSheetField
            label="Matiere"
            icon="albums-outline"
            value={subjectLabel}
            placeholder={loadingGrades ? "Chargement du programme..." : "Choisir une matiere"}
            options={subjectOptions}
            onChange={(label) => {
              const match = subjects.find((x) => x.label === label);
              if (match) setSubjectId(match.id);
              setErrors((e) => ({ ...e, subject: undefined }));
            }}
          />
          {errors.subject ? (
            <Text variant="caption" tone="danger">
              {errors.subject}
            </Text>
          ) : null}
        </View>

        {optionsError || failure ? (
          <Text variant="caption" tone="danger">
            {failure || optionsError}
          </Text>
        ) : null}

        <Button onPress={save} icon="arrow-forward" loading={saving} block>
          {saving ? "Creation..." : "Creer et ajouter les chapitres"}
        </Button>

        <Text variant="caption" tone="muted">
          Le cours reste un brouillon tant que vous ne l'envoyez pas en relecture.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center" },
});
