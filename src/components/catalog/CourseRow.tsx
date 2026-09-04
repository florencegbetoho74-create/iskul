import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useTheme } from "@/theme/ThemeProvider";
import Text from "@/components/ui/Text";
import StoredImage from "@/components/ui/StoredImage";
import Badge from "@/components/ui/Badge";
import type { Course } from "@/types/course";

export type CourseRowProps = {
  course: Course;
  /** Avancement de l'élève sur ce cours, entre 0 et 1. Absent s'il n'y a pas touche. */
  progress?: number | null;
  /** Vue professeur : le statut editorial remplace l'avancement. */
  showStatus?: boolean;
};

const STATUS_TONE = {
  draft: "neutral",
  in_review: "warning",
  published: "success",
  rejected: "danger",
} as const;

const STATUS_LABEL = {
  draft: "Brouillon",
  in_review: "En relecture",
  published: "Publié",
  rejected: "A corriger",
} as const;

/**
 * Ligne de catalogue.
 *
 * Remplace les arbres deplians par niveau puis matiere : trois niveaux de
 * repliement pour atteindre un cours, c'est trois occasions de se perdre.
 */
export default function CourseRow({ course, progress, showStatus }: CourseRowProps) {
  const { color, space, radius } = useTheme();
  const router = useRouter();

  const chapters = course.chapters?.length ?? 0;
  const started = typeof progress === "number" && progress > 0;

  return (
    <Pressable
      onPress={() => router.push(`/(app)/course/${course.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${course.title}, ${course.subject || "cours"}`}
      style={({ pressed }) => [
        styles.root,
        {
          backgroundColor: color.surface,
          borderColor: color.border,
          borderRadius: radius.lg,
          padding: space.md,
          gap: space.md,
        },
        pressed && { opacity: 0.9 },
      ]}
    >
      <View
        style={[
          styles.thumb,
          { backgroundColor: color.media, borderRadius: radius.md },
        ]}
      >
        {course.coverUrl ? (
          <StoredImage path={course.coverUrl} style={styles.cover} resizeMode="cover" />
        ) : (
          <Ionicons name="play" size={18} color={color.onMedia} />
        )}
      </View>

      <View style={styles.body}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {course.title}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {[course.subject, course.level, `${chapters} lecon${chapters > 1 ? "s" : ""}`]
            .filter(Boolean)
            .join(" · ")}
        </Text>

        {showStatus ? (
          <Badge tone={STATUS_TONE[course.status]} style={{ marginTop: space.xs }}>
            {STATUS_LABEL[course.status]}
          </Badge>
        ) : started ? (
          <View style={[styles.progressRow, { gap: space.sm, marginTop: space.xs }]}>
            <View style={[styles.track, { backgroundColor: color.surfaceSunk }]}>
              <View
                style={[
                  styles.fill,
                  { width: `${Math.round((progress ?? 0) * 100)}%`, backgroundColor: color.primary },
                ]}
              />
            </View>
            <Text variant="caption" tone="primary">
              {Math.round((progress ?? 0) * 100)} %
            </Text>
          </View>
        ) : null}
      </View>

      <Ionicons name="chevron-forward" size={16} color={color.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: "row", alignItems: "center", borderWidth: 1 },
  thumb: { width: 52, height: 52, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  cover: { width: "100%", height: "100%" },
  body: { flex: 1 },
  progressRow: { flexDirection: "row", alignItems: "center" },
  track: { flex: 1, height: 5, borderRadius: 999, overflow: "hidden" },
  fill: { height: 5, borderRadius: 999 },
});
